import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { newId } from "@/lib/ids";

// COST: model=claude-haiku-4-5 | trigger=counterpart turn | est_in=450 est_out=30
// est_usd_per_call=0.0006 | cap=8/user/day | kill_switch=KILL_SWITCH_SCREEN | logged_to=ai_calls kind='screen'
export const SCREEN_MODEL = "claude-haiku-4-5-20251001";
export const SCREEN_PROMPT_VERSION = "v1";
export const SCREEN_DAILY_CAP = 8;
const INPUT_COST_PER_TOKEN = 1 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 5 / 1_000_000;

export const SCREEN_RESULTS = ["ok", "harassment", "personal_info", "off_topic", "spam"] as const;
export type ScreenResult = (typeof SCREEN_RESULTS)[number];

const ScreenSchema = z.object({
  result: z.enum(SCREEN_RESULTS),
  reason: z.string().max(200).default(""),
});

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Lazily read and memoised rather than at module scope: a throw at module
// scope takes the whole Lambda down on import, which cost a production
// incident once already (see docs/decisions.md, the og-fonts ENOENT).
let promptTemplate: string | undefined;
function getPrompt(): string {
  promptTemplate ??= readFileSync(
    join(process.cwd(), `content/prompts/screen.${SCREEN_PROMPT_VERSION}.md`),
    "utf-8"
  );
  return promptTemplate;
}

export interface ScreenCallResult {
  result: ScreenResult;
  reason: string;
  latencyMs: number;
  costUsd: number;
}

export async function screenTurn(params: {
  quotedClaim: string;
  body: string;
}): Promise<ScreenCallResult> {
  const userTurn = `<quoted_claim>\n${params.quotedClaim}\n</quoted_claim>\n\n<reply>\n${params.body}\n</reply>\n\nClassify the reply. Respond with JSON only.`;

  const start = Date.now();
  const response = await getClient().messages.create({
    model: SCREEN_MODEL,
    max_tokens: 60,
    system: getPrompt(),
    messages: [{ role: "user", content: userTurn }],
  });
  const latencyMs = Date.now() - start;
  const costUsd =
    response.usage.input_tokens * INPUT_COST_PER_TOKEN +
    response.usage.output_tokens * OUTPUT_COST_PER_TOKEN;

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "";
  const raw = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

  // A screen that cannot be parsed is not a pass. The caller stores the
  // turn as `pending` and delivers nothing, which is the whole point of
  // screening before delivery rather than after.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ScreenError(`Screen response was not valid JSON: ${raw.slice(0, 120)}`, costUsd, latencyMs);
  }
  const result = ScreenSchema.safeParse(parsed);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ScreenError(summary, costUsd, latencyMs);
  }

  return { ...result.data, latencyMs, costUsd };
}

export class ScreenError extends Error {
  constructor(
    message: string,
    public costUsd: number,
    public latencyMs: number
  ) {
    super(message);
  }
}

export async function logScreenCall(params: {
  userId: string | null;
  costUsd: number;
  latencyMs: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_calls").insert({
    id: newId(),
    user_id: params.userId,
    kind: "screen",
    model: SCREEN_MODEL,
    cost_usd: params.costUsd,
    latency_ms: params.latencyMs,
    debate_id: null,
    prompt_version: SCREEN_PROMPT_VERSION,
  });
  if (error) {
    console.error("[ai_calls] failed to log screen call:", error.message);
  }
}

// Screens and logs in one step. The log happens whether or not the response
// validated — Anthropic billed for the tokens either way, and the call has
// to count toward the daily cap and the monthly budget.
export async function screenAndLog(params: {
  quotedClaim: string;
  body: string;
  userId: string;
}): Promise<ScreenCallResult> {
  try {
    const result = await screenTurn(params);
    await logScreenCall({ userId: params.userId, costUsd: result.costUsd, latencyMs: result.latencyMs });
    return result;
  } catch (err) {
    if (err instanceof ScreenError) {
      await logScreenCall({ userId: params.userId, costUsd: err.costUsd, latencyMs: err.latencyMs });
    }
    throw err;
  }
}
