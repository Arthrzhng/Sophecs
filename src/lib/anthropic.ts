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
import { fidelityCriteriaFor, hasFidelityCriteria } from "@/lib/judge/rubric";
import { fillPlaceholders } from "@/lib/judge/fill-placeholder";
import { PUBLISHED_SCHOOL_IDS } from "@/lib/school-registry";
import type { SchoolId } from "@/lib/types";

// COST: model=claude-sonnet-5 | trigger=debate submission | est_in=1700 est_out=650
// est_usd_per_call=0.0098 | cap=5/user/day | kill_switch=KILL_SWITCH_JUDGE | logged_to=ai_calls
// retries=2 on a reply that fails validation, each attempt logged (see judgeWithRetries):
// a submission makes at most 3 calls. The cap counts arguments, not calls: a judged
// submission counts once however many attempts it took, and one that ends without a
// verdict not at all (counts_toward_cap, migration 0019). /api/judge also holds every
// reader to 20 judge calls a day, retries included (Arthur, 2026-11-05)
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
    asSent(PROMPT_VERSION, readFileSync(join(process.cwd(), `content/prompts/judge.${PROMPT_VERSION}.md`), "utf-8")),
  ],
]);

function promptTemplateFor(version: RunnablePromptVersion): string {
  const cached = promptTemplates.get(version);
  if (cached !== undefined) return cached;
  const raw = readFileSync(
    join(process.cwd(), `content/prompts/judge.${version}.md`),
    "utf-8"
  );
  const template = asSent(version, raw);
  promptTemplates.set(version, template);
  return template;
}

// Every prompt is sent exactly as read, its head comment included.
// Arthur, 2026-11-05: "Strip comments from judge.v3.md before it is sent
// (v3 only)"; reversed on 2026-11-06: "send the old head comment again,
// exactly as the 4 Nov prompt sent it. This reverses my ruling 12; the
// judge evidently relies on it." Without the comment v3's strong cases
// scored ten points lower in every check of 2026-11-06
// (docs/decisions.md, "Judge v3: the head comment sent again, by
// Arthur's reversal of ruling 12"). The function stays so both reads
// above keep one place that decides what is sent.
export function asSent(_version: RunnablePromptVersion, raw: string): string {
  return raw;
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

// Three call sites for the Anthropic API in this repo, not two as this
// comment said: /api/judge (via judgeDebate below), tests/judge/run-golden.ts,
// which calls this function directly rather than going through HTTP, and
// src/lib/screen.ts, which screens counterpart replies on a different
// model — see the Phase 2 checklist's `grep -rn "anthropic"` requirement,
// which is what found the third.
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
  promptVersion: RunnablePromptVersion = PROMPT_VERSION,
  // Golden runs only, and production never passes it either. Criteria for
  // a draft school, which the golden runner reads from the draft criteria
  // file in content/prompts, because Arthur ruled that the approved draft
  // criteria stay out of rubric.ts until he publishes those schools:
  // /api/judge keeps refusing them meanwhile. Neither the file nor the
  // runner's loader is named here: a confinement test fails on any mention
  // of either anywhere in src/, comments included, so that a read cannot
  // hide inside something that looks like a comment.
  //
  // It can only fill a gap, never replace live criteria. A school that has
  // criteria in rubric.ts is always judged against them, and passing this
  // for one throws, so no caller can use it to change what a live school's
  // request contains.
  draftCriteria?: string
): Promise<JudgeCallResult> {
  if (draftCriteria !== undefined && hasFidelityCriteria(school)) {
    throw new Error(
      `draft criteria refused for "${school}": it has live criteria, and a ` +
        `live school is always judged against them`
    );
  }
  // Reading criteria for a school with none still throws, by design, so
  // without draftCriteria a draft school fails exactly as before. v1 and
  // v2 get rubric.ts's criteria unchanged; v3 adds the vocabulary
  // paragraph Arthur ruled on 2026-10-26 (see rubric.ts).
  const criteria = draftCriteria ?? fidelityCriteriaFor(school, promptVersion);

  // {{RUBRIC}} is in every version. {{RIVAL_SCHOOLS}} is v3 and later, so
  // it is optional, and its absence leaves v2 byte for byte what it was.
  // Both are filled in one pass over the template as sent: see
  // src/lib/judge/fill-placeholder.ts for the three defects that shape.
  const system = fillPlaceholders(promptTemplateFor(promptVersion), {
    "{{RUBRIC}}": { value: criteria, required: true },
    "{{RIVAL_SCHOOLS}}": { value: RIVAL_SCHOOLS_BLOCK, required: false },
  });
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
    // The length, not the text. This message is logged to ai_calls and to
    // the production log, and a reply cut off partway is mostly the judge
    // paraphrasing the argument.
    throw new JudgeValidationError(
      `Model response was not valid JSON (${raw.length} characters)`,
      costUsd,
      latencyMs
    );
  }

  // Arthur's ruling of 2026-11-05 accepts null for these two fields on an
  // original (schema.ts), where a v3 reply sometimes carries them. The
  // schema cannot tell an original from a revision, so a revision's null is
  // refused here, as it was before the ruling: on a revision both fields
  // are the verdict's answer, and production's v2 revisions stay exactly
  // as they were (tests/judge-null-revision-fields.test.ts).
  if (revisionOf && typeof parsed === "object" && parsed !== null && (parsed as { rejected?: unknown }).rejected === false) {
    const nulls = (["objection_answered", "improvement_note"] as const).filter(
      (field) => (parsed as Record<string, unknown>)[field] === null
    );
    if (nulls.length > 0) {
      throw new JudgeValidationError(
        nulls.map((field) => `${field}: null on a revision`).join("; "),
        costUsd,
        latencyMs
      );
    }
  }

  const result = VerdictSchema.safeParse(parsed);
  if (!result.success) {
    // Name the offending field rather than dumping the whole zod issue
    // array. Word-cap breaches are the common failure here, and the raw
    // message is a multi-line JSON blob that tells neither the golden-set
    // table nor a production log which cap was missed.
    //
    // zod 3's wording for a wrong enum value quoted the value it got
    // ("received '...'"), which is the model's text. zod 4 names the
    // options only; the clause is still cut, should a wording quote it
    // again: the summary is logged, and it names a field and a rule, never
    // what the judge wrote (tests/model-reply-parsing.test.ts).
    const summary = result.error.issues
      .map(
        (issue) =>
          `${issue.path.join(".") || "(root)"}: ${issue.message.replace(/,? received '[^]*$/, "")}`
      )
      .join("; ");
    throw new JudgeValidationError(summary, costUsd, latencyMs);
  }

  return { verdict: result.data, latencyMs, costUsd };
}

/**
 * How many times one submission may call the judge: the first call and up
 * to two retries. Arthur's ruling of 2026-11-03, raising it from one retry.
 */
export const MAX_JUDGE_ATTEMPTS = 3;

/** One billed call to the judge, as whoever made it logs it. */
export interface JudgeAttempt {
  /** 1 for the first call, 2 and 3 for the retries. There is never a fourth. */
  attempt: 1 | 2 | 3;
  costUsd: number;
  latencyMs: number;
  /** The reply, when it validated; null when it did not. */
  verdict: ModelVerdict | null;
  /** Why the reply did not validate; null when it did. */
  error: string | null;
}

type Settled = { ok: true; result: JudgeCallResult } | { ok: false; error: JudgeValidationError };

async function settle(call: () => Promise<JudgeCallResult>): Promise<Settled> {
  try {
    return { ok: true, result: await call() };
  } catch (err) {
    // Only a reply that came back and failed validation is retried. An
    // error from the API or the network propagates exactly as before.
    if (err instanceof JudgeValidationError) return { ok: false, error: err };
    throw err;
  }
}

function attemptOf(attempt: 1 | 2 | 3, settled: Settled): JudgeAttempt {
  return settled.ok
    ? {
        attempt,
        costUsd: settled.result.costUsd,
        latencyMs: settled.result.latencyMs,
        verdict: settled.result.verdict,
        error: null,
      }
    : {
        attempt,
        costUsd: settled.error.costUsd,
        latencyMs: settled.error.latencyMs,
        verdict: null,
        error: settled.error.message,
      };
}

/**
 * Make a judge call, and make it again, up to twice more, while the reply
 * fails validation.
 *
 * Arthur's rulings of 2026-11-03, for every prompt version: a reply that
 * breaks the schema, most often a `verdict_line` over its 20-word cap, is
 * sent again rather than failing the submission. First one retry; later
 * that day, after a golden run where one sample failed twice, two. Never
 * more than `MAX_JUDGE_ATTEMPTS` calls, and the reply is never cut down to
 * fit: when the last reply also fails, that failure is thrown, and a reply
 * that validates is returned as it came.
 *
 * Every billed call goes to `logAttempt` before anything else happens, the
 * failed ones included, because Anthropic bills them either way:
 * `judgeDebate` writes each one to ai_calls, and the golden runner to its
 * run file.
 */
export async function judgeWithRetries(
  call: () => Promise<JudgeCallResult>,
  logAttempt: (attempt: JudgeAttempt) => Promise<void>
): Promise<JudgeCallResult> {
  let failure: JudgeValidationError | null = null;
  for (let attempt = 1; attempt <= MAX_JUDGE_ATTEMPTS; attempt++) {
    const settled = await settle(call);
    await logAttempt(attemptOf(attempt as JudgeAttempt["attempt"], settled));
    if (settled.ok) return settled.result;
    failure = settled.error;
  }
  throw failure as JudgeValidationError;
}

/**
 * Writes one ai_calls row and returns its id, so a caller that later learns
 * the call should not count toward the daily cap can say so.
 *
 * `validationError` is why a judge reply failed validation, and is written
 * only when it did. It names the field and the cap that was missed (see
 * `callJudgeModel`), never any of the reply's or the argument's text, so
 * it is safe to keep: that is the logging Arthur asked for on a submission
 * whose every reply fails.
 */
export async function logAiCall(params: {
  userId: string | null;
  debateId: string | null;
  kind: "judge" | "golden" | "judge_allowlist";
  costUsd: number;
  latencyMs: number;
  validationError?: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const id = newId();
  const row: Record<string, unknown> = {
    id,
    user_id: params.userId,
    kind: params.kind,
    model: MODEL,
    cost_usd: params.costUsd,
    latency_ms: params.latencyMs,
    debate_id: params.debateId,
    prompt_version: PROMPT_VERSION,
  };
  if (params.validationError) row.validation_error = params.validationError;
  const { error } = await admin.from("ai_calls").insert(row);
  // "Every call is logged, no exceptions" only holds if a failed log write
  // is at least visible. Found by the golden set silently showing 0 rows
  // in this sandbox (a network-egress restriction, not a real bug) — with
  // no error check, the same silent loss would happen for a real, tricky
  // Supabase failure in production. Not retried here; surfaced instead.
  if (error) {
    console.error(`[ai_calls] failed to log ${params.kind} call:`, error.message);
  }
  return id;
}

/**
 * Takes calls out of the daily cap: all of a failed submission's, and a
 * judged submission's retries (every call but the one that validated).
 *
 * Arthur's rulings of 2026-11-03 and 2026-11-05 (item 8): a submission that
 * ends without a verdict does not use one of the reader's arguments for the
 * day, and retries never do. The calls stay in ai_calls, and in the monthly
 * budget and the daily call ceiling, because they were billed; only the
 * cap stops counting them. Errors are reported, not thrown: on a failure
 * the reader is already being told judging failed, and on a verdict they
 * get it; either way a failure here costs them a cap slot, not the result.
 *
 * Returns whether the calls are out of the cap, true when there were none
 * to take out, so the reader is only told the attempt did not use one of
 * their arguments when that is so.
 */
export async function excludeFromDailyCap(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const admin = createAdminClient();
  const { error } = await admin.from("ai_calls").update({ counts_toward_cap: false }).in("id", ids);
  if (error) {
    console.error(`[ai_calls] failed to take ${ids.length} call(s) out of the daily cap:`, error.message);
    return false;
  }
  return true;
}

// The errors judgeDebate threw after taking the submission's calls out of
// the daily cap. A set beside the error rather than a field on it, so the
// error the caller logs is exactly the one that was thrown.
const TAKEN_OFF_CAP = new WeakSet<object>();

/**
 * Whether a submission that judgeDebate failed was taken out of the daily
 * cap. False for an error judgeDebate did not throw, and for one whose
 * calls could not be taken out: /api/judge then leaves out the sentence
 * that says the attempt did not use one of the reader's arguments.
 */
export function wasTakenOffDailyCap(err: unknown): boolean {
  return typeof err === "object" && err !== null && TAKEN_OFF_CAP.has(err);
}

// Used by /api/judge: calls the model and logs the call in one step, tied
// to the debate/user it's for. kind defaults to "judge"; the allowlist path
// passes "judge_allowlist" so those calls are distinguishable in ai_calls.
//
// Each attempt is its own ai_calls row, the ones that failed validation
// included, so every billed call counts toward the monthly budget and the
// route's daily call ceiling. A submission that ends with a verdict counts
// toward the five-argument cap once: the attempts before the one that
// validated are taken out of it (Arthur's ruling of 2026-11-05: "Retries
// must not use a reader's arguments"). The route checks the cap once,
// before the call. A
// submission that ends without one, every reply failing validation or the
// API failing, has its calls taken out of the cap (Arthur's ruling of
// 2026-11-03): the reader is told it did not use one of their arguments,
// and only when that is true (wasTakenOffDailyCap). Each failed reply's
// row carries why it failed.
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
  const logged: string[] = [];
  let judged: JudgeCallResult;
  try {
    judged = await judgeWithRetries(
      () => callJudgeModel(params.motion, params.school, params.argument, params.revisionOf),
      async (attempt) => {
        logged.push(
          await logAiCall({
            userId: params.userId,
            debateId: params.debateId,
            kind,
            costUsd: attempt.costUsd,
            latencyMs: attempt.latencyMs,
            validationError: attempt.error,
          })
        );
      }
    );
  } catch (err) {
    const offCap = await excludeFromDailyCap(logged);
    if (offCap && typeof err === "object" && err !== null) TAKEN_OFF_CAP.add(err);
    throw err;
  }
  // Outside the try, so nothing here can send a judged submission down the
  // failure path. The last row is the call that validated; any before it
  // were retries. If taking them out fails, the reader loses a slot for the
  // day, which excludeFromDailyCap reports; the verdict stands either way.
  await excludeFromDailyCap(logged.slice(0, -1));
  return judged;
}

export { PROMPT_VERSION };
