import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/ids";
import { VerdictSchema, PROMPT_VERSION, type ModelVerdict } from "@/lib/judge/schema";
import { FIDELITY_CRITERIA } from "@/lib/judge/rubric";
import type { SchoolId } from "@/lib/types";

// COST: model=claude-sonnet-5 | trigger=debate submission | est_in=1600 est_out=500
// est_usd_per_call=0.0082 | cap=5/user/day | kill_switch=KILL_SWITCH_JUDGE | logged_to=ai_calls
export const MODEL = "claude-sonnet-5";
const INPUT_COST_PER_TOKEN = 2 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 10 / 1_000_000;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Read once at module scope, not per call.
const promptTemplate = readFileSync(join(process.cwd(), "content/prompts/judge.v1.md"), "utf-8");

// Carries cost/latency even on failure — the tokens were still billed by
// Anthropic even if the response didn't parse, and "every call is logged,
// no exceptions" (see judgeDebate below) means this must be logged too.
export class JudgeValidationError extends Error {
  constructor(
    message: string,
    public costUsd: number,
    public latencyMs: number
  ) {
    super(message);
  }
}

export interface JudgeCallResult {
  verdict: ModelVerdict;
  latencyMs: number;
  costUsd: number;
}

// The only two call sites for the Anthropic API in this repo: /api/judge
// (via judgeDebate below) and tests/judge/run-golden.ts, which calls this
// function directly rather than going through HTTP — see the Phase 2
// checklist's `grep -rn "anthropic"` requirement.
export async function callJudgeModel(
  motion: string,
  school: SchoolId,
  argument: string
): Promise<JudgeCallResult> {
  const system = promptTemplate.replace("{{RUBRIC}}", FIDELITY_CRITERIA[school]);
  const userTurn = `Motion: ${motion}\nSchool: ${school}\n\n<argument>\n${argument}\n</argument>\n\nRespond with JSON only, matching the schema in your instructions.`;

  // No temperature: claude-sonnet-5 rejects it outright ("temperature is
  // deprecated for this model", confirmed against the real API) — the
  // brief's temperature: 0.2 was written against claude-sonnet-4-6.
  // Thinking explicitly disabled: sonnet-5 defaults to extended thinking,
  // which otherwise consumes the entire max_tokens budget on hidden
  // reasoning before producing any visible output (confirmed against the
  // real API — a live call came back with stop_reason "max_tokens" and
  // zero text). See docs/decisions.md.
  const start = Date.now();
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 700,
    thinking: { type: "disabled" },
    system,
    messages: [{ role: "user", content: userTurn }],
  });
  const latencyMs = Date.now() - start;

  // Computed before validation, on purpose — Anthropic bills for the tokens
  // regardless of whether the response turns out to be well-formed JSON.
  const costUsd =
    response.usage.input_tokens * INPUT_COST_PER_TOKEN +
    response.usage.output_tokens * OUTPUT_COST_PER_TOKEN;

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "";
  // The model wraps JSON in a ```json fence sometimes despite being told
  // not to (confirmed against the real API) — stripped defensively rather
  // than fighting the prompt further for a formatting quirk that doesn't
  // affect judgment quality.
  const raw = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new JudgeValidationError(
      `Model response was not valid JSON: ${raw.slice(0, 200)}`,
      costUsd,
      latencyMs
    );
  }

  const result = VerdictSchema.safeParse(parsed);
  if (!result.success) {
    throw new JudgeValidationError(result.error.message, costUsd, latencyMs);
  }

  return { verdict: result.data, latencyMs, costUsd };
}

export async function logAiCall(params: {
  userId: string | null;
  debateId: string | null;
  kind: "judge" | "golden";
  costUsd: number;
  latencyMs: number;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("ai_calls").insert({
    id: newId(),
    user_id: params.userId,
    kind: params.kind,
    model: MODEL,
    cost_usd: params.costUsd,
    latency_ms: params.latencyMs,
    debate_id: params.debateId,
  });
}

// Used by /api/judge: calls the model and logs the call as kind "judge" in
// one step, tied to the debate/user it's for.
export async function judgeDebate(params: {
  motion: string;
  school: SchoolId;
  argument: string;
  userId: string;
  debateId: string;
}): Promise<JudgeCallResult> {
  try {
    const result = await callJudgeModel(params.motion, params.school, params.argument);
    await logAiCall({
      userId: params.userId,
      debateId: params.debateId,
      kind: "judge",
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
    });
    return result;
  } catch (err) {
    if (err instanceof JudgeValidationError) {
      // The model was actually called and billed — log it even though the
      // response didn't validate, so it still counts toward the daily cap
      // and the monthly budget.
      await logAiCall({
        userId: params.userId,
        debateId: params.debateId,
        kind: "judge",
        costUsd: err.costUsd,
        latencyMs: err.latencyMs,
      });
    }
    throw err;
  }
}

export { PROMPT_VERSION };
