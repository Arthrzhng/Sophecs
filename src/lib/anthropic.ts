import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/ids";
import {
  VerdictSchema,
  PROMPT_VERSION,
  type ModelVerdict,
  type PromptVersion,
} from "@/lib/judge/schema";
import { FIDELITY_CRITERIA } from "@/lib/judge/rubric";
import { PUBLISHED_SCHOOL_IDS } from "@/lib/school-registry";
import type { SchoolId } from "@/lib/types";

// COST: model=claude-sonnet-5 | trigger=debate submission | est_in=1700 est_out=650
// est_usd_per_call=0.0098 | cap=5/user/day | kill_switch=KILL_SWITCH_JUDGE | logged_to=ai_calls
export const MODEL = "claude-sonnet-5";
const INPUT_COST_PER_TOKEN = 2 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 10 / 1_000_000;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * The prompt versions a call can run against.
 *
 * Deliberately not `PromptVersion` from judge/schema.ts: that type is every
 * version a verdict has ever been *stored* under, and v3 has never been
 * stored. This is every version that has a file to read.
 */
export type RunnablePromptVersion = PromptVersion | "v3";

// Read once per version, not per call. The default is still read at module
// scope, so production's path is exactly what it was; any other version is
// read on first use and cached beside it. Only tests/judge/run-golden.ts
// ever asks for another, and only so a prompt can be measured before it
// becomes the default — see the golden-set discipline in CONTRIBUTING.md.
const promptTemplates = new Map<string, string>([
  [
    PROMPT_VERSION,
    readFileSync(join(process.cwd(), `content/prompts/judge.${PROMPT_VERSION}.md`), "utf-8"),
  ],
]);

function promptTemplateFor(version: RunnablePromptVersion): string {
  const cached = promptTemplates.get(version);
  if (cached !== undefined) return cached;
  const template = readFileSync(
    join(process.cwd(), `content/prompts/judge.${version}.md`),
    "utf-8"
  );
  promptTemplates.set(version, template);
  return template;
}

// The schools an `unanswered_objection` may name, for v3's
// `{{RIVAL_SCHOOLS}}`. Built from the same list the verdict schema's enum
// is built from, so the prompt cannot offer the model a school zod would
// then reject.
//
// v2 contains no such placeholder, so this substitution is a no-op there
// and the v2 request stays byte for byte what it was. That is pinned by
// the six fixtures in tests/judge-request.test.ts, which is the test the
// brief cares about most while judging is live.
const RIVAL_SCHOOLS_BLOCK = PUBLISHED_SCHOOL_IDS.map((id) => `- \`${id}\``).join("\n");

/**
 * Fill a placeholder that must appear at most once in the prompt.
 *
 * `String.prototype.replace` with a string pattern fills the FIRST
 * occurrence and says nothing about the rest, and a prompt file is sent to
 * the model whole, header comment included. judge.v3.md named both of its
 * placeholders in that comment before using them, so the naive call filled
 * the mention in the comment and left the real placeholder standing: the
 * model would have been asked to score against a rubric that was still a
 * template, and nothing would have said so.
 *
 * Throwing is the fix rather than `replaceAll`, which would send the
 * criteria twice. Caught by tests/judge-request.test.ts, which is also
 * what stops it coming back.
 */
function fillOnce(
  template: string,
  placeholder: string,
  value: string,
  required: boolean
): string {
  const occurrences = template.split(placeholder).length - 1;
  if (occurrences > 1) {
    throw new Error(
      `judge prompt names ${placeholder} ${occurrences} times; it must appear at most once`
    );
  }
  if (occurrences === 0) {
    if (required) throw new Error(`judge prompt is missing ${placeholder}`);
    return template;
  }
  return template.replace(placeholder, value);
}

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
export interface RevisionContext {
  originalArgument: string;
  objectionClaim: string;
}

export async function callJudgeModel(
  motion: string,
  school: SchoolId,
  argument: string,
  revisionOf?: RevisionContext,
  // Production never passes this. `/api/judge` and `judgeDebate` leave it
  // alone, so the only version they can reach is `PROMPT_VERSION`.
  promptVersion: RunnablePromptVersion = PROMPT_VERSION
): Promise<JudgeCallResult> {
  // {{RUBRIC}} is in every version. {{RIVAL_SCHOOLS}} is v3 and later, so
  // it is optional and its absence leaves v2 byte for byte what it was.
  const system = fillOnce(
    fillOnce(promptTemplateFor(promptVersion), "{{RUBRIC}}", FIDELITY_CRITERIA[school], true),
    "{{RIVAL_SCHOOLS}}",
    RIVAL_SCHOOLS_BLOCK,
    false
  );
  // The v2 prompt keys its revision instructions off the presence of these
  // two tags, so they are only emitted for an actual revision.
  const revisionBlock = revisionOf
    ? `\n<original_argument>\n${revisionOf.originalArgument}\n</original_argument>\n\n<objection>\n${revisionOf.objectionClaim}\n</objection>\n`
    : "";
  const userTurn = `Motion: ${motion}\nSchool: ${school}\n${revisionBlock}\n<argument>\n${argument}\n</argument>\n\nRespond with JSON only, matching the schema in your instructions.`;

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
    max_tokens: 850,
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
    // Name the offending field rather than dumping the whole zod issue
    // array. Word-cap breaches are the common failure here, and the raw
    // message is a multi-line JSON blob that tells neither the golden-set
    // table nor a production log which cap was missed.
    const summary = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new JudgeValidationError(summary, costUsd, latencyMs);
  }

  return { verdict: result.data, latencyMs, costUsd };
}

export async function logAiCall(params: {
  userId: string | null;
  debateId: string | null;
  kind: "judge" | "golden" | "judge_allowlist";
  costUsd: number;
  latencyMs: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_calls").insert({
    id: newId(),
    user_id: params.userId,
    kind: params.kind,
    model: MODEL,
    cost_usd: params.costUsd,
    latency_ms: params.latencyMs,
    debate_id: params.debateId,
    prompt_version: PROMPT_VERSION,
  });
  // "Every call is logged, no exceptions" only holds if a failed log write
  // is at least visible. Found by the golden set silently showing 0 rows
  // in this sandbox (a network-egress restriction, not a real bug) — with
  // no error check, the same silent loss would happen for a real, tricky
  // Supabase failure in production. Not retried here; surfaced instead.
  if (error) {
    console.error(`[ai_calls] failed to log ${params.kind} call:`, error.message);
  }
}

// Used by /api/judge: calls the model and logs the call in one step, tied
// to the debate/user it's for. kind defaults to "judge"; the allowlist path
// passes "judge_allowlist" so those calls are distinguishable in ai_calls.
export async function judgeDebate(params: {
  motion: string;
  school: SchoolId;
  argument: string;
  userId: string;
  debateId: string;
  kind?: "judge" | "judge_allowlist";
  revisionOf?: RevisionContext;
}): Promise<JudgeCallResult> {
  const kind = params.kind ?? "judge";
  try {
    const result = await callJudgeModel(
      params.motion,
      params.school,
      params.argument,
      params.revisionOf
    );
    await logAiCall({
      userId: params.userId,
      debateId: params.debateId,
      kind,
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
        kind,
        costUsd: err.costUsd,
        latencyMs: err.latencyMs,
      });
    }
    throw err;
  }
}

export { PROMPT_VERSION };
