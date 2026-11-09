// The AI behind sample accounts (Arthur, 2026-11-08, item 1): when a
// reader argues with a sample, one AI writes the sample's side, screened
// as a reader's reply is, counted toward the reader's daily cap and the
// monthly budget, within its own ceiling, behind its own flag.
// src/lib/sample-reply.ts and src/lib/sample-reply-prompt.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));
vi.mock("@/lib/anthropic", () => ({ MODEL: "claude-sonnet-5" }));
let budget: "ok" | "over" | "unread" = "ok";
vi.mock("@/lib/budget", () => ({ budgetState: async () => budget }));
const screenTurn = vi.fn();
const screenLogs: Record<string, unknown>[] = [];
let screenLogOk = true;
vi.mock("@/lib/screen", () => {
  class ScreenError extends Error {
    constructor(message: string, public costUsd: number, public latencyMs: number) {
      super(message);
    }
  }
  return {
    SCREEN_DAILY_CAP: 8,
    ScreenError,
    screenTurn: (...args: unknown[]) => screenTurn(...args),
    logScreenCall: async (p: Record<string, unknown>) => (screenLogs.push(p), screenLogOk),
  };
});

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let rpc: { data: unknown; error: unknown } = { data: 0, error: null };
const rpcCalls: { name: string; args: unknown }[] = [];
let failInsertInto: string | null = null;

// Enough of supabase-js for this module.
function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let head = false;
  let single = false;
  let patch: Row | null = null;
  let inserting: Row | null = null;
  let order: string | null = null;
  const b: Record<string, unknown> = {};
  b.select = (_c?: string, o?: { head?: boolean }) => ((head = Boolean(o?.head)), b);
  b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
  b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
  b.gte = (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b);
  b.order = (c: string) => ((order = c), b);
  b.update = (p: Row) => ((patch = p), b);
  b.insert = (row: Row) => ((inserting = row), b);
  b.maybeSingle = () => ((single = true), b);
  b.then = (resolve: (v: unknown) => unknown) => {
    if (inserting) {
      if (failInsertInto === table) return resolve({ error: { message: "insert failed" } });
      const row = inserting;
      if (table === "turns" && (tables.turns ?? []).some((t) => t.exchange_id === row.exchange_id && t.seq === row.seq))
        return resolve({ error: { message: "duplicate key value violates unique constraint" } });
      (tables[table] ??= []).push({ created_at: new Date().toISOString(), ...row });
      return resolve({ error: null });
    }
    const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    if (patch) {
      for (const r of rows) Object.assign(r, patch);
      return resolve({ error: null });
    }
    if (head) return resolve({ count: rows.length, error: null });
    if (single) return resolve({ data: rows[0] ?? null, error: null });
    const sorted = order ? [...rows].sort((x, y) => Number(x[order!]) - Number(y[order!])) : rows;
    return resolve({ data: sorted, error: null });
  };
  return b;
}
const admin = { from, rpc: async (name: string, args: unknown) => (rpcCalls.push({ name, args }), rpc) } as never;

const { replyAsSample, sampleReplyMessage, samplesUnavailable, SAMPLE_REPLY_CEILING_USD, SAMPLE_REPLY_DAILY_CALLS } = await import(
  "../src/lib/sample-reply"
);
const { parseSampleReply, sampleReplyUserTurn, SAMPLE_REPLY_SYSTEM } = await import("../src/lib/sample-reply-prompt");

const NOW = new Date("2026-11-20T12:00:00Z");
const READER = "11111111-1111-1111-1111-111111111111";
const SAMPLE = "22222222-2222-2222-2222-222222222222";
const HUMAN = "33333333-3333-3333-3333-333333333333";
const READER_ARGUMENT =
  "A machine that decides who gets a loan must answer to the people it judges. Nobody can contest a reason they are never shown. So the bank owes every applicant the reason, in words they can use.";
const SAMPLE_ARGUMENT = "What is in our power is our judgement of the decision, not the decision itself, and that is where a Stoic stands.";
const BODY =
  "The claim moves too fast from being judged to being owed. What a Stoic asks first is what lies within the applicant's power, and the bank's reasons do not. The applicant's judgement of the refusal does, and no explanation the bank gives can do that work for them. A reason in words may help, but it does not restore what was never theirs to command.";
const answer = (quote: string, body = BODY) => ({
  content: [{ type: "text", text: JSON.stringify({ quoted_claim: quote, reply: body }) }],
  usage: { input_tokens: 2000, output_tokens: 400 },
});
const QUOTE = "Nobody can contest a reason they are never shown.";

function world(over: { counterpart?: string; turns?: Row[]; nextTurn?: string | null; status?: string } = {}) {
  const counterpart = over.counterpart ?? SAMPLE;
  tables = {
    exchanges: [
      {
        id: "x1", topic_slug: "opaque-benefit", debate_a: "dr", debate_b: "ds", user_a: READER, user_b: counterpart,
        school_a: "utilitarianism", school_b: "stoicism", status: over.status ?? "open", next_turn: over.nextTurn === undefined ? counterpart : over.nextTurn,
      },
    ],
    profiles: [
      { id: READER, is_sample: false },
      { id: SAMPLE, is_sample: true },
      { id: HUMAN, is_sample: false },
    ],
    debates: [
      { id: "dr", argument: READER_ARGUMENT, motion_text: null },
      { id: "ds", argument: SAMPLE_ARGUMENT, motion_text: null },
    ],
    debate_topics: [{ slug: "opaque-benefit", motion: "Banks should explain every automated refusal." }],
    turns: over.turns ?? [{ exchange_id: "x1", seq: 1, author_id: READER, quoted_claim: "What is in our power", body: "x".repeat(200), screen_result: "ok" }],
    ai_calls: [],
  };
}

beforeEach(() => {
  vi.stubEnv("SAMPLE_REPLIES", "1");
  vi.stubEnv("KILL_SWITCH_SCREEN", "");
  budget = "ok";
  rpc = { data: 3.2, error: null };
  rpcCalls.length = 0;
  screenLogs.length = 0;
  screenLogOk = true;
  failInsertInto = null;
  create.mockReset();
  screenTurn.mockReset();
  screenTurn.mockResolvedValue({ result: "ok", reason: "", latencyMs: 5, costUsd: 0.0006 });
  world();
});
afterEach(() => vi.unstubAllEnvs());

describe("a sample's reply", () => {
  it("is written, screened, logged against the reader and handed over", async () => {
    create.mockResolvedValue(answer(QUOTE));
    const out = await replyAsSample(admin, "x1", READER, NOW);
    expect(out).toEqual({ ok: true, seq: 2, complete: false });
    const turn = tables.turns.find((t) => t.seq === 2)!;
    expect(turn).toMatchObject({ author_id: SAMPLE, quoted_claim: QUOTE, body: BODY, screen_result: "ok" });
    // The writing call: the judge's model, the sample's argument, the reader's id.
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe("claude-sonnet-5");
    expect(create.mock.calls[0][1]).toMatchObject({ maxRetries: 0 });
    expect(tables.ai_calls).toEqual([
      expect.objectContaining({ kind: "sample_reply", user_id: READER, for_sample: true, debate_id: null, prompt_version: "sample-reply.v1", cost_usd: 2000 * 2e-6 + 400 * 1e-5 }),
    ]);
    // Its screen: the reader's reply's screen, logged as the reader's, marked for the sample.
    expect(screenTurn).toHaveBeenCalledWith({ quotedClaim: QUOTE, body: BODY }, expect.objectContaining({ maxRetries: 0 }));
    expect(screenLogs).toEqual([expect.objectContaining({ userId: READER, forSample: true })]);
    expect(tables.exchanges[0]).toMatchObject({ next_turn: READER, status: "open", last_turn_at: NOW.toISOString() });
    // The ceiling read: this month's marked calls, by the function that takes no argument.
    expect(rpcCalls).toEqual([{ name: "ai_sample_spend_this_month", args: undefined }]);
  });

  it("answers the reader's last reply at turn 4, and completes the exchange", async () => {
    const reply3 = "The reader says that " + "a reason owed is a reason given in words they can use. ".repeat(4);
    world({
      turns: [
        { exchange_id: "x1", seq: 1, author_id: READER, quoted_claim: "q", body: "x".repeat(200), screen_result: "ok" },
        { exchange_id: "x1", seq: 2, author_id: SAMPLE, quoted_claim: "q", body: "y".repeat(200), screen_result: "ok" },
        { exchange_id: "x1", seq: 3, author_id: READER, quoted_claim: "q", body: reply3, screen_result: "ok" },
      ],
    });
    create.mockResolvedValue(answer("a reason owed is a reason given in words they can use."));
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: true, seq: 4, complete: true });
    expect(create.mock.calls[0][0].messages[0].content).toContain(reply3.trim());
    expect(tables.exchanges[0]).toMatchObject({ next_turn: null, status: "complete" });
  });

  it("is never written for a person's side, or for anyone but the exchange's reader", async () => {
    world({ counterpart: HUMAN });
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "not_due" });
    world();
    expect(await replyAsSample(admin, "x1", HUMAN, NOW)).toEqual({ ok: false, reason: "not_due" });
    expect(await replyAsSample(admin, "nope", READER, NOW)).toEqual({ ok: false, reason: "not_due" });
    expect(create).not.toHaveBeenCalled();
  });

  it("is not due while it is the reader's turn, their reply waits to be screened, or the exchange is over", async () => {
    world({ nextTurn: READER });
    expect((await replyAsSample(admin, "x1", READER, NOW)).ok).toBe(false);
    world({ turns: [{ exchange_id: "x1", seq: 1, author_id: READER, quoted_claim: "q", body: "x".repeat(200), screen_result: "pending" }] });
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "not_due" });
    world({ status: "lapsed" });
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "not_due" });
    expect(create).not.toHaveBeenCalled();
  });

  it("stops before any call for the flag, the kill switch, the budget and the ceiling, failing closed", async () => {
    const cases: [() => void, string][] = [
      [() => vi.stubEnv("SAMPLE_REPLIES", "0"), "off"],
      [() => vi.stubEnv("KILL_SWITCH_SCREEN", "true"), "paused"],
      [() => (budget = "over"), "budget"],
      [() => (budget = "unread"), "unread"],
      [() => (rpc = { data: SAMPLE_REPLY_CEILING_USD, error: null }), "ceiling"],
      [() => (rpc = { data: SAMPLE_REPLY_CEILING_USD + 2, error: null }), "ceiling"],
      [() => (rpc = { data: null, error: { message: "function ai_sample_spend_this_month does not exist" } }), "unread"],
      [() => (rpc = { data: "not a number", error: null }), "unread"],
    ];
    for (const [arrange, reason] of cases) {
      vi.stubEnv("SAMPLE_REPLIES", "1");
      vi.stubEnv("KILL_SWITCH_SCREEN", "");
      budget = "ok";
      rpc = { data: 3.2, error: null };
      world();
      arrange();
      expect(await replyAsSample(admin, "x1", READER, NOW), reason).toEqual({ ok: false, reason });
    }
    expect(create).not.toHaveBeenCalled();
    expect(SAMPLE_REPLY_CEILING_USD).toBe(15);
  });

  it("counts toward the reader's daily cap: a screen of the reader's within 24 hours, and the writing calls", async () => {
    const recent = new Date(NOW.getTime() - 3600_000).toISOString();
    const old = new Date(NOW.getTime() - 25 * 3600_000).toISOString();
    tables.ai_calls = [
      ...Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, user_id: READER, kind: "screen", created_at: recent })),
      { id: "o1", user_id: READER, kind: "screen", created_at: old },
      { id: "h1", user_id: HUMAN, kind: "screen", created_at: recent },
    ];
    create.mockResolvedValue(answer(QUOTE));
    // Seven of eight: room for one more.
    expect((await replyAsSample(admin, "x1", READER, NOW)).ok).toBe(true);
    world();
    tables.ai_calls = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, user_id: READER, kind: "screen", created_at: recent }));
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "cap" });
    world();
    tables.ai_calls = Array.from({ length: SAMPLE_REPLY_DAILY_CALLS }, (_, i) => ({ id: `w${i}`, user_id: READER, kind: "sample_reply", created_at: recent }));
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "cap" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("holds the answer to a reader's rules, tries once more, and logs both calls", async () => {
    create.mockResolvedValueOnce(answer("A sentence the reader never wrote anywhere.")).mockResolvedValueOnce(answer(QUOTE));
    expect((await replyAsSample(admin, "x1", READER, NOW)).ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].messages.at(-1).content).toMatch(/could not be used: quoted_claim was not copied word for word/);
    expect(tables.ai_calls.map((c) => c.validation_error)).toEqual([expect.stringMatching(/not copied word for word/), null]);
  });

  it("delivers nothing when both answers break the rules, or the screen holds or fails", async () => {
    create.mockResolvedValue(answer(QUOTE, "Too short."));
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(screenTurn).not.toHaveBeenCalled();
    expect(tables.turns).toHaveLength(1);

    world();
    create.mockResolvedValue(answer(QUOTE));
    screenTurn.mockResolvedValue({ result: "harassment", reason: "r", latencyMs: 1, costUsd: 0.0006 });
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "held" });
    expect(tables.turns).toHaveLength(1);
    expect(tables.exchanges[0].next_turn).toBe(SAMPLE);
    // The held screen still counts: logged against the reader.
    expect(screenLogs.at(-1)).toMatchObject({ userId: READER, forSample: true });

    world();
    screenTurn.mockRejectedValue(new Error("timeout"));
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(tables.turns).toHaveLength(1);
  });

  it("stops when a call cannot be logged, since the ceiling could not see it", async () => {
    create.mockResolvedValue(answer(QUOTE));
    failInsertInto = "ai_calls";
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(screenTurn).not.toHaveBeenCalled();
    failInsertInto = null;
    world();
    screenLogOk = false;
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(tables.turns).toHaveLength(1);
  });

  it("hands the turn over when a delivered reply's hand-over did not go through, and lets one of two at once in", async () => {
    world({
      turns: [
        { exchange_id: "x1", seq: 1, author_id: READER, quoted_claim: "q", body: "x".repeat(200), screen_result: "ok" },
        { exchange_id: "x1", seq: 2, author_id: SAMPLE, quoted_claim: "q", body: "y".repeat(200), screen_result: "ok" },
      ],
    });
    expect(await replyAsSample(admin, "x1", READER, NOW)).toEqual({ ok: false, reason: "not_due" });
    expect(tables.exchanges[0].next_turn).toBe(READER);
    expect(create).not.toHaveBeenCalled();

    // Two requests at once: the second insert meets the unique (exchange_id, seq).
    world();
    create.mockResolvedValue(answer(QUOTE));
    const [a, b] = await Promise.all([replyAsSample(admin, "x1", READER, NOW), replyAsSample(admin, "x1", READER, NOW)]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(tables.turns.filter((t) => t.seq === 2)).toHaveLength(1);
  });

  it("tells the reader plainly why a sample is not replying, and never as a person", async () => {
    const words = (["ceiling", "budget", "cap", "off", "paused", "unread", "held", "failed"] as const).map((r) => sampleReplyMessage(r)!);
    expect(sampleReplyMessage("ceiling")).toMatch(/stopped replying for this month/);
    expect(sampleReplyMessage("cap")).toMatch(/today's limit/);
    expect(sampleReplyMessage("not_due")).toBeNull();
    for (const w of words) {
      expect(w).toMatch(/sample account/i);
      expect(w).not.toMatch(/\b(they|their|them|he|she|someone|person)\b/i);
    }
  });

  it("is available to pair with only while it could reply", async () => {
    expect(await samplesUnavailable(admin)).toBeNull();
    rpc = { data: 15, error: null };
    expect(await samplesUnavailable(admin)).toBe("ceiling");
    vi.stubEnv("SAMPLE_REPLIES", "0");
    expect(await samplesUnavailable(admin)).toBe("off");
  });
});

describe("what the AI is asked, and how its answer is read", () => {
  it("reads every school's criteria as the judge does, the three newer ones included, on production's build", async () => {
    // A v2 read throws for the three newer schools on a six-school build;
    // the module reads them under the judge's PROMPT_VERSION.
    const src = (await import("node:fs")).readFileSync("src/lib/sample-reply.ts", "utf8");
    expect(src).toContain("fidelityCriteriaFor(sampleSchool, PROMPT_VERSION)");
    vi.resetModules();
    vi.stubEnv("SIX_SCHOOLS", "1");
    try {
      const { fidelityCriteriaFor } = await import("../src/lib/judge/rubric");
      const { PROMPT_VERSION } = await import("../src/lib/judge/schema");
      expect(PROMPT_VERSION).toBe("v3");
      for (const school of ["stoicism", "utilitarianism", "virtue-ethics", "confucian", "ubuntu", "buddhist"] as const)
        expect(fidelityCriteriaFor(school, PROMPT_VERSION).length, school).toBeGreaterThan(200);
    } finally {
      vi.resetModules();
    }
  });

  const input = {
    motion: "Banks should explain every automated refusal.",
    school: { name: "Stoicism", oneLine: "Of things some are in our power, and others are not.", criteria: "CRITERIA-TEXT" },
    readerSchool: "Utilitarianism",
    sampleArgument: SAMPLE_ARGUMENT,
    readerArgument: READER_ARGUMENT,
    turns: [],
    seq: 2,
    source: READER_ARGUMENT,
  };

  it("carries the school, its criteria, both arguments and what to answer, and nothing about an account", () => {
    const turn = sampleReplyUserTurn(input);
    for (const part of ["Stoicism", "CRITERIA-TEXT", SAMPLE_ARGUMENT, READER_ARGUMENT, "Utilitarianism", "Write reply 2 of 4"]) expect(turn).toContain(part);
    expect(turn).not.toMatch(/handle|name="[^"]*@|user_id|account/i);
    expect(SAMPLE_REPLY_SYSTEM).toMatch(/It is not a person and you never write as one/);
    expect(SAMPLE_REPLY_SYSTEM).toMatch(/word for word/);
  });

  it("takes a reply only with a sentence copied from the source and a body of a reader's length", () => {
    expect(parseSampleReply(JSON.stringify({ quoted_claim: QUOTE, reply: BODY }), READER_ARGUMENT)).toEqual({ ok: true, quotedClaim: QUOTE, body: BODY });
    expect(parseSampleReply("```json\n" + JSON.stringify({ quoted_claim: QUOTE, reply: BODY }) + "\n```", READER_ARGUMENT).ok).toBe(true);
    // Line breaks and case in the quote, as a reader's selection would have.
    expect(parseSampleReply(JSON.stringify({ quoted_claim: "nobody can contest a reason\nthey are never shown.", reply: BODY }), READER_ARGUMENT).ok).toBe(true);
    expect(parseSampleReply("not json", READER_ARGUMENT)).toEqual({ ok: false, problem: "the answer was not JSON" });
    expect(parseSampleReply("Here is the reply:\n" + JSON.stringify({ quoted_claim: QUOTE, reply: BODY }) + "\nThanks.", READER_ARGUMENT).ok).toBe(true);
    expect(parseSampleReply("{ not json }", READER_ARGUMENT).ok).toBe(false);
    expect(parseSampleReply(JSON.stringify({ quoted_claim: QUOTE }), READER_ARGUMENT).ok).toBe(false);
    expect(parseSampleReply(JSON.stringify({ quoted_claim: "Invented sentence here.", reply: BODY }), READER_ARGUMENT)).toMatchObject({ problem: expect.stringMatching(/word for word/) });
    expect(parseSampleReply(JSON.stringify({ quoted_claim: "Nobody", reply: BODY }), READER_ARGUMENT)).toMatchObject({ problem: expect.stringMatching(/shorter than 10/) });
    expect(parseSampleReply(JSON.stringify({ quoted_claim: QUOTE, reply: "Short." }), READER_ARGUMENT)).toMatchObject({ problem: expect.stringMatching(/shorter than 150/) });
    expect(parseSampleReply(JSON.stringify({ quoted_claim: QUOTE, reply: "x".repeat(1201) }), READER_ARGUMENT)).toMatchObject({ problem: expect.stringMatching(/longer than 1200/) });
  });
});
