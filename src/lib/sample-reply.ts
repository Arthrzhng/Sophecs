import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL } from "@/lib/anthropic";
import { budgetState } from "@/lib/budget";
import { authorForSeq, MAX_SEQ, quoteSourceForSeq } from "@/lib/counterpart";
import { newId } from "@/lib/ids";
import { fidelityCriteriaFor } from "@/lib/judge/rubric";
import { PROMPT_VERSION } from "@/lib/judge/schema";
import { getSchool } from "@/lib/schools";
import { logScreenCall, screenTurn, ScreenError, SCREEN_DAILY_CAP } from "@/lib/screen";
import {
  parseSampleReply,
  retryNote,
  sampleReplyUserTurn,
  SAMPLE_REPLY_PROMPT_VERSION,
  SAMPLE_REPLY_SYSTEM,
  type SampleReplyTurn,
} from "@/lib/sample-reply-prompt";
import { motionForDebate } from "@/lib/motion-text";
import type { SchoolId } from "@/lib/types";

// COST: model=claude-sonnet-5 (the judge's, src/lib/anthropic.ts) | trigger=a reader's delivered reply
// in an exchange with a sample account | measured in=about 3,500 (the judge's v3 criteria) out=about 300 |
// est_usd_per_reply=0.012 with its screen (tests/sample-reply/run-eval.ts, 12 replies, 2026-11-09), so
// the ceiling holds about 1,250 replies a month | cap=the reader's SCREEN_DAILY_CAP: a sample's reply is one of the reader's 8
// screened replies a day, and the reader may cause at most 16 writing calls a day, retries included |
// ceiling=SAMPLE_REPLY_CEILING_USD a month, both kinds, inside AI_MONTHLY_BUDGET_USD |
// flag=SAMPLE_REPLIES (build time, next.config.ts) | kill_switch=KILL_SWITCH_SCREEN, since every reply is
// screened | logged_to=ai_calls kind='sample_reply' for the writing and 'screen' for its screen, both
// under the reader's user_id and marked for_sample (migration 0029) | retries=one more writing call
// when an answer breaks the reply rules; none by the SDK.
//
// The ceiling is read before each reply, never cached, and is not a
// reservation: replies written at the same moment can each pass it, so it
// can be overshot by the replies in flight, at most about $0.035 each (two
// writing calls at MAX_TOKENS and a screen). An exchange has at most one
// reply in flight, since the sample's turn is claimed before the writing
// call (claimTurn); so a reader can have one in flight for each exchange
// they have open with a sample, and the reader's daily room can be passed
// by those too.
//
// Arthur, 2026-11-08, item 1. docs/sample-activity.md, "Sample replies", has the design.

/** Arthur, 2026-11-08: "Its own spending ceiling of $15 a month inside the $50 budget." */
export const SAMPLE_REPLY_CEILING_USD = 15;
/** Writing calls a reader may cause in 24 hours, retries included: two for each screened reply. */
export const SAMPLE_REPLY_DAILY_CALLS = 2 * SCREEN_DAILY_CAP;

const INPUT_COST_PER_TOKEN = 2 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 10 / 1_000_000;
const MAX_TOKENS = 900;
// Inside the exchange page's 60-second function: two writing calls and a
// screen at their limits come to 54 seconds.
const WRITE_TIMEOUT_MS = 22_000;
const SCREEN_TIMEOUT_MS = 10_000;
// A call that timed out or lost its connection may still have been billed:
// it is logged at its most, so the ceiling and the budget never miss it.
// The input is counted at three characters a token, more than English
// takes, and the output at MAX_TOKENS. The screen's most: its prompt and a
// reply at the longest, about 900 tokens in and 60 out, rounded up.
const CHARS_PER_TOKEN_AT_MOST = 3;
const SCREEN_COST_AT_MOST_USD = 0.002;
// The sample's turn is claimed for this long before the writing call, by
// moving the exchange's last_turn_at this far ahead (claimTurn). Longer
// than the exchange page's 60-second function, so a claim outlives the
// request that made it only when that request died, and then for a minute
// at most.
const CLAIM_MS = 120_000;
// A claim is a last_turn_at in the future. This much leeway is left for
// clocks on different functions, so an ordinary last_turn_at is never
// taken for one.
const CLAIM_SKEW_MS = 10_000;

/**
 * The flag. Written into the build as a constant (next.config.ts), like
 * SIX_SCHOOLS, so a client component that says what samples do agrees with
 * the server that makes them do it.
 */
export function sampleRepliesOn(): boolean {
  return process.env.SAMPLE_REPLIES === "1";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** This UTC month's spend on sample replies, or null when it could not be read. */
export async function sampleReplySpend(admin: SupabaseClient): Promise<number | null> {
  try {
    // This UTC month's calls marked for_sample, as the database counts the
    // month (migration 0029), read fresh every time.
    const { data, error } = await admin.rpc("ai_sample_spend_this_month");
    const total = Number(data);
    if (error || data === null || data === undefined || !Number.isFinite(total)) {
      console.error("[sample-reply] the month's spend could not be read:", error?.message ?? `got ${String(data)}`);
      return null;
    }
    return total;
  } catch (err) {
    console.error("[sample-reply] the month's spend could not be read:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Why a sample cannot reply now, or null when it can, as far as anything
 * but the reader is concerned. Fails closed: a budget or ceiling that
 * cannot be read stops replies as one that is reached does.
 */
export type Unavailable = "off" | "paused" | "budget" | "ceiling" | "unread";
export async function samplesUnavailable(admin: SupabaseClient): Promise<Unavailable | null> {
  if (!sampleRepliesOn()) return "off";
  if (process.env.KILL_SWITCH_SCREEN === "true") return "paused";
  const budget = await budgetState();
  if (budget === "over") return "budget";
  if (budget === "unread") return "unread";
  const spent = await sampleReplySpend(admin);
  if (spent === null) return "unread";
  return spent >= SAMPLE_REPLY_CEILING_USD ? "ceiling" : null;
}

/**
 * Whether the reader has room today for a sample's reply: one of their
 * SCREEN_DAILY_CAP screened replies a day, counted as the turn route and
 * the re-screening job count them (a sample's reply's screen is logged as
 * the reader's), and fewer than SAMPLE_REPLY_DAILY_CALLS writing calls.
 * null when it could not be read.
 */
async function readerHasRoom(admin: SupabaseClient, readerId: string, now: Date): Promise<boolean | null> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [screens, writes] = await Promise.all([
    admin
      .from("ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", readerId)
      .eq("kind", "screen")
      .gte("created_at", since),
    admin
      .from("ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", readerId)
      .eq("kind", "sample_reply")
      .gte("created_at", since),
  ]);
  if (screens.error || writes.error || screens.count === null || writes.count === null) return null;
  return screens.count < SCREEN_DAILY_CAP && writes.count < SAMPLE_REPLY_DAILY_CALLS;
}

async function logCall(
  admin: SupabaseClient,
  params: { userId: string; costUsd: number; latencyMs: number; validationError?: string }
): Promise<boolean> {
  const { error } = await admin.from("ai_calls").insert({
    id: newId(),
    user_id: params.userId,
    kind: "sample_reply",
    model: MODEL,
    cost_usd: params.costUsd,
    latency_ms: params.latencyMs,
    debate_id: null,
    for_sample: true,
    prompt_version: SAMPLE_REPLY_PROMPT_VERSION,
    validation_error: params.validationError ?? null,
  });
  if (error) console.error("[ai_calls] failed to log a sample reply call:", error.message);
  return !error;
}

export type SampleReplyResult =
  | { ok: true; seq: number; complete: boolean }
  | { ok: false; reason: Unavailable | "cap" | "not_due" | "writing" | "failed" | "held" };

interface ExchangeRow {
  id: string;
  topic_slug: string;
  debate_a: string;
  debate_b: string;
  user_a: string | null;
  user_b: string | null;
  school_a: string;
  school_b: string;
  status: string;
  next_turn: string | null;
  last_turn_at: string;
}

/**
 * Whether the other party of this exchange, seen from the reader, is a
 * sample account. Read from profiles.is_sample, which only the seed tooling
 * sets (migration 0023), never from anything a reader supplies.
 *
 * Throws when it cannot be read: the page then shows its error rather than
 * a sample without its tag, presented as a person.
 */
export async function counterpartIsSample(admin: SupabaseClient, counterpartId: string | null): Promise<boolean> {
  if (!counterpartId) return false;
  const { data, error } = await admin.from("profiles").select("is_sample").eq("id", counterpartId).maybeSingle();
  if (error) throw new Error(`[sample-reply] whether the counterpart is a sample account could not be read: ${error.message}`);
  return Boolean(data?.is_sample);
}

/**
 * Whether the exchange page asks for the sample's reply: the replies on,
 * the counterpart a sample, the exchange open and the sample's turn, after
 * a delivered reply. A sample's reply delivered whose hand-over did not go
 * through is due too, so the request can hand the turn over (replyAsSample).
 */
export function sampleReplyDue(params: {
  theirIsSample: boolean;
  status: string;
  nextTurn: string | null;
  theirUserId: string | null;
  lastTurn: { screen_result: string } | undefined;
}): boolean {
  return (
    sampleRepliesOn() &&
    params.theirIsSample &&
    params.status === "open" &&
    params.theirUserId !== null &&
    params.nextTurn === params.theirUserId &&
    params.lastTurn?.screen_result === "ok"
  );
}

/**
 * Writes, screens and delivers a sample account's next reply in an
 * exchange with a reader, when it is the sample's turn.
 *
 * Order of checks: the exchange is the reader's, with a sample, open and
 * the sample's turn, the reader's last reply delivered; then the flag, the
 * kill switch, the budget, the ceiling and the reader's daily room; then
 * the turn claimed, the writing call, its reply held to a reader's rules,
 * the screen, and delivery. Nothing is written to `turns` until the screen
 * has passed, so a reply that fails anywhere leaves the exchange as it
 * was, the claim given back and the sample's turn still due, and the next
 * request tries again within the same caps.
 *
 * A second request while one is writing finds the turn claimed and makes
 * no call ("writing"): a reload, or a second tab, costs nothing.
 */
export async function replyAsSample(
  admin: SupabaseClient,
  exchangeId: string,
  readerId: string,
  now = new Date()
): Promise<SampleReplyResult> {
  const { data: exchange } = await admin
    .from("exchanges")
    .select("id, topic_slug, debate_a, debate_b, user_a, user_b, school_a, school_b, status, next_turn, last_turn_at")
    .eq("id", exchangeId)
    .maybeSingle<ExchangeRow>();
  if (!exchange || (exchange.user_a !== readerId && exchange.user_b !== readerId)) return { ok: false, reason: "not_due" };
  const readerIsA = exchange.user_a === readerId;
  const sampleId = readerIsA ? exchange.user_b : exchange.user_a;
  if (!sampleId || exchange.status !== "open" || exchange.next_turn !== sampleId) return { ok: false, reason: "not_due" };

  const [sampleProfile, readerProfile] = await Promise.all([
    admin.from("profiles").select("is_sample").eq("id", sampleId).maybeSingle(),
    admin.from("profiles").select("is_sample").eq("id", readerId).maybeSingle(),
  ]);
  // Only ever a sample's side, and only ever for a reader.
  if (!sampleProfile.data?.is_sample || readerProfile.data?.is_sample !== false) return { ok: false, reason: "not_due" };

  const { data: turnRows, error: turnsError } = await admin
    .from("turns")
    .select("seq, author_id, quoted_claim, body, screen_result")
    .eq("exchange_id", exchange.id)
    .order("seq", { ascending: true });
  if (turnsError || !turnRows) return { ok: false, reason: "failed" };
  const turns = turnRows as { seq: number; author_id: string | null; quoted_claim: string; body: string; screen_result: string }[];
  const last = turns[turns.length - 1];

  // A sample's reply delivered whose hand-over did not go through: hand
  // the turn to the reader now, rather than leave the exchange stuck.
  if (last && last.author_id === sampleId && last.screen_result === "ok") {
    await handOver(admin, exchange, sampleId, readerId, last.seq, now);
    return { ok: false, reason: "not_due" };
  }
  const seq = turns.length + 1;
  if (
    seq > MAX_SEQ ||
    authorForSeq(seq, exchange.user_a ?? "", exchange.user_b ?? "") !== sampleId ||
    !last ||
    last.author_id !== readerId ||
    last.screen_result !== "ok"
  ) {
    return { ok: false, reason: "not_due" };
  }

  const unavailable = await samplesUnavailable(admin);
  if (unavailable) return { ok: false, reason: unavailable };
  const room = await readerHasRoom(admin, readerId, now);
  if (room === null) return { ok: false, reason: "unread" };
  if (!room) return { ok: false, reason: "cap" };

  const readerDebateId = readerIsA ? exchange.debate_a : exchange.debate_b;
  const sampleDebateId = readerIsA ? exchange.debate_b : exchange.debate_a;
  const [{ data: topic }, { data: debates }] = await Promise.all([
    admin.from("debate_topics").select("motion").eq("slug", exchange.topic_slug).maybeSingle(),
    admin.from("debates").select("id, argument, motion_text").in("id", [readerDebateId, sampleDebateId]),
  ]);
  const byId = new Map((debates ?? []).map((d) => [d.id as string, d]));
  const readerArgument = (byId.get(readerDebateId)?.argument as string | null) ?? "";
  const sampleArgument = (byId.get(sampleDebateId)?.argument as string | null) ?? "";
  if (!topic || !readerArgument || !sampleArgument) return { ok: false, reason: "failed" };
  const openerDebate = byId.get(exchange.debate_a);
  const motion = motionForDebate((openerDebate?.motion_text as string | null) ?? null, topic.motion as string);

  const sampleSchool = (readerIsA ? exchange.school_b : exchange.school_a) as SchoolId;
  const readerSchool = (readerIsA ? exchange.school_a : exchange.school_b) as SchoolId;
  const source = quoteSourceForSeq(seq) === "argument" ? readerArgument : last.body;
  const school = getSchool(sampleSchool);
  const userTurn = sampleReplyUserTurn({
    motion,
    // The criteria the judge holds the school to, under the judge's own
    // prompt version: on a six-school build the three newer schools have
    // criteria only there.
    school: { name: school.name, oneLine: school.one_line, criteria: fidelityCriteriaFor(sampleSchool, PROMPT_VERSION) },
    readerSchool: getSchool(readerSchool).name,
    sampleArgument,
    readerArgument,
    // Only what was delivered: a reply held by the screen or taken down is
    // not part of the exchange.
    turns: turns.filter((t) => t.screen_result === "ok").map<SampleReplyTurn>((t) => ({
      seq: t.seq,
      bySample: t.author_id === sampleId,
      quotedClaim: t.quoted_claim,
      body: t.body,
    })),
    seq,
    source,
  });

  const handedOverAt = exchange.last_turn_at;
  const lease = await claimTurn(admin, exchange.id, sampleId, now);
  if (!lease) return { ok: false, reason: "writing" };
  let delivered = false;
  try {
    const result = await writeAndDeliver(admin, { exchange, sampleId, readerId, seq, source, userTurn, now });
    delivered = result.ok;
    return result;
  } finally {
    // Given back on every way out but delivery, an exception included. The
    // hand-over on delivery has already replaced it.
    if (!delivered) await releaseTurn(admin, exchange.id, sampleId, lease, handedOverAt);
  }
}

/** The writing call, the screen and delivery, once the turn is claimed. */
async function writeAndDeliver(
  admin: SupabaseClient,
  ctx: { exchange: ExchangeRow; sampleId: string; readerId: string; seq: number; source: string; userTurn: string; now: Date }
): Promise<SampleReplyResult> {
  const { exchange, sampleId, readerId, seq, source, userTurn, now } = ctx;
  // Write it: one call, and one more if the answer breaks a rule.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userTurn }];
  let reply: { quotedClaim: string; body: string } | null = null;
  for (let attempt = 1; attempt <= 2 && !reply; attempt++) {
    const start = Date.now();
    let response: Anthropic.Message;
    try {
      response = await getClient().messages.create(
        { model: MODEL, max_tokens: MAX_TOKENS, system: SAMPLE_REPLY_SYSTEM, messages },
        { timeout: WRITE_TIMEOUT_MS, maxRetries: 0 }
      );
    } catch (err) {
      console.error("[sample-reply] the writing call failed:", err instanceof Error ? err.message : String(err));
      // An answer with an HTTP status (a refusal, an overload) was not
      // billed. One without (a timeout, a lost connection) may have been,
      // so it is logged at its most.
      if (!hasStatus(err)) {
        const chars = SAMPLE_REPLY_SYSTEM.length + messages.reduce((n, m) => n + String(m.content).length, 0);
        await logCall(admin, {
          userId: readerId,
          costUsd: Math.ceil(chars / CHARS_PER_TOKEN_AT_MOST) * INPUT_COST_PER_TOKEN + MAX_TOKENS * OUTPUT_COST_PER_TOKEN,
          latencyMs: Date.now() - start,
          validationError: "no answer (timed out or the connection was lost): logged at its most",
        });
      }
      return { ok: false, reason: "failed" };
    }
    const latencyMs = Date.now() - start;
    const costUsd = response.usage.input_tokens * INPUT_COST_PER_TOKEN + response.usage.output_tokens * OUTPUT_COST_PER_TOKEN;
    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const parsed = parseSampleReply(raw, source);
    const logged = await logCall(admin, {
      userId: readerId,
      costUsd,
      latencyMs,
      validationError: parsed.ok ? undefined : parsed.problem,
    });
    // A call that could not be logged is spend the ceiling cannot see:
    // stop here rather than spend more unseen.
    if (!logged) return { ok: false, reason: "failed" };
    if (parsed.ok) reply = { quotedClaim: parsed.quotedClaim, body: parsed.body };
    else messages.push({ role: "assistant", content: raw || "{}" }, { role: "user", content: retryNote(parsed.problem) });
  }
  if (!reply) return { ok: false, reason: "failed" };

  // The screen a reader's reply gets, logged as one of the reader's
  // screens, marked as made for a sample (migration 0029).
  let screen;
  try {
    screen = await screenTurn(reply, { timeout: SCREEN_TIMEOUT_MS, maxRetries: 0 });
  } catch (err) {
    if (err instanceof ScreenError) {
      await logScreenCall({ userId: readerId, costUsd: err.costUsd, latencyMs: err.latencyMs, forSample: true });
    } else if (!hasStatus(err)) {
      // As with the writing call: no answer may still have been billed.
      await logScreenCall({ userId: readerId, costUsd: SCREEN_COST_AT_MOST_USD, latencyMs: SCREEN_TIMEOUT_MS, forSample: true });
    }
    console.error("[sample-reply] the screen failed:", err instanceof Error ? err.message : String(err));
    return { ok: false, reason: "failed" };
  }
  // As with the writing call: spend the ceiling cannot see stops here.
  if (!(await logScreenCall({ userId: readerId, costUsd: screen.costUsd, latencyMs: screen.latencyMs, forSample: true }))) {
    return { ok: false, reason: "failed" };
  }
  if (screen.result !== "ok") {
    console.error(`[sample-reply] a reply in ${exchange.id} was held by the screen: ${screen.result}`);
    return { ok: false, reason: "held" };
  }

  const { error: insertError } = await admin.from("turns").insert({
    id: newId(),
    exchange_id: exchange.id,
    author_id: sampleId,
    seq,
    quoted_claim: reply.quotedClaim,
    body: reply.body,
    screen_result: "ok",
  });
  // The unique (exchange_id, seq) index: another request delivered first.
  if (insertError) return { ok: false, reason: "not_due" };
  const complete = await handOver(admin, exchange, sampleId, readerId, seq, now);
  return { ok: true, seq, complete };
}

/** Whether an error carries an HTTP status: the API answered, and did not bill. */
function hasStatus(err: unknown): boolean {
  return typeof err === "object" && err !== null && typeof (err as { status?: unknown }).status === "number";
}

/**
 * Claims the sample's turn for one request, in one conditional update:
 * last_turn_at moves CLAIM_MS ahead, only while the turn is still the
 * sample's and not already claimed (a last_turn_at in the future). The
 * claim, or null when another request holds it or the turn has moved on.
 *
 * last_turn_at, rather than a new column, so this needs no migration. Read
 * elsewhere it only starts the lapse clock (src/lib/counterpart.ts), which
 * a time ahead holds for the claim's length, and orders /me's list.
 */
async function claimTurn(admin: SupabaseClient, exchangeId: string, sampleId: string, now: Date): Promise<string | null> {
  const lease = new Date(now.getTime() + CLAIM_MS).toISOString();
  const { data, error } = await admin
    .from("exchanges")
    .update({ last_turn_at: lease })
    .eq("id", exchangeId)
    .eq("status", "open")
    .eq("next_turn", sampleId)
    .lte("last_turn_at", new Date(now.getTime() + CLAIM_SKEW_MS).toISOString())
    .select("id");
  if (error) {
    console.error(`[sample-reply] the turn in ${exchangeId} could not be claimed:`, error.message);
    return null;
  }
  return data && data.length > 0 ? lease : null;
}

/** Gives the claim back: last_turn_at as it was, only while the claim is still this one. */
async function releaseTurn(
  admin: SupabaseClient,
  exchangeId: string,
  sampleId: string,
  lease: string,
  handedOverAt: string
): Promise<void> {
  const { error } = await admin
    .from("exchanges")
    .update({ last_turn_at: handedOverAt })
    .eq("id", exchangeId)
    .eq("next_turn", sampleId)
    .eq("last_turn_at", lease);
  // Not given back, it lapses on its own CLAIM_MS after it was made.
  if (error) console.error(`[sample-reply] the claim in ${exchangeId} could not be given back:`, error.message);
}

/** The turn passes to the reader, or the exchange completes. Only while it is still the sample's. */
async function handOver(
  admin: SupabaseClient,
  exchange: ExchangeRow,
  sampleId: string,
  readerId: string,
  seq: number,
  now: Date
): Promise<boolean> {
  const complete = seq === MAX_SEQ;
  const { error } = await admin
    .from("exchanges")
    .update({
      next_turn: complete ? null : readerId,
      last_turn_at: now.toISOString(),
      ...(complete ? { status: "complete" } : {}),
    })
    .eq("id", exchange.id)
    .eq("status", "open")
    .eq("next_turn", sampleId);
  if (error) console.error(`[sample-reply] the hand-over in ${exchange.id} failed:`, error.message);
  return complete;
}

/**
 * The reader is told plainly why a sample is not replying (Arthur,
 * 2026-11-08: "when reached, samples stop replying and the reader is told
 * plainly"). Every sentence names the account as what it is.
 */
export function sampleReplyMessage(reason: Exclude<SampleReplyResult, { ok: true }>["reason"]): string | null {
  switch (reason) {
    case "ceiling":
      return "Sample accounts have stopped replying for this month: the AI that writes the replies has used its monthly allowance. Sample accounts reply again from the 1st.";
    case "budget":
      return "Sample accounts have stopped replying for this month: the site has used its monthly allowance for AI. Sample accounts reply again from the 1st.";
    case "cap":
      return "You've reached today's limit on replies, and a sample account's reply counts toward it. Open this exchange again tomorrow and the sample account will reply.";
    case "off":
    case "paused":
    case "unread":
      return "Sample accounts are not replying right now. Try again later.";
    case "held":
    case "failed":
      return "The sample account's reply could not be written this time. Try again in a minute.";
    case "not_due":
    case "writing":
      return null;
  }
}
