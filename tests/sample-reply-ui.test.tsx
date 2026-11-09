// What a reader sees of a sample account's replies (Arthur, 2026-11-08):
// the AI tag beside a sample's name on an exchange, the one line before
// they write, the offer when no one else is free, the tag on /me, and the
// explanation's third sentence once the replies are on. Nothing more, and
// nothing that speaks of a sample as a person.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/counterpart/actions", () => ({ requestSampleReply: async () => ({ ok: true, delivered: false }) }));
vi.mock("@/app/debate/actions", () => ({
  seekCounterpart: async () => ({ ok: true, exchangeId: null }),
  pairWithSample: async () => ({ ok: true, exchangeId: "x" }),
  blockCounterpart: async () => ({ ok: true }),
  reportTurn: async () => ({ ok: true }),
  setExchangePublish: async () => ({ ok: true }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("@/lib/analytics/client", () => ({ track: () => {} }));

const { ExchangeView } = await import("../src/components/counterpart/ExchangeView");
const { FindCounterpartButton } = await import("../src/components/debate/FindCounterpartButton");
const { OpenExchanges } = await import("../src/components/me/OpenExchanges");
const { SAMPLE_WRITING_LINE, SAMPLE_OFFER, SAMPLE_EXPLANATION } = await import("../src/lib/sample");

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/&#x27;/g, "'");
const base = {
  exchangeId: "x1", userId: "reader", topicSlug: "no-decision", myDebateId: "d1", motion: "A motion.",
  mySchool: "stoicism" as const, theirSchool: "ubuntu" as const, myArgument: "Mine.", theirArgument: "Theirs.",
  turns: [{ id: "t1", seq: 1, mine: true, quotedClaim: "q".repeat(12), body: "b".repeat(160), held: false }],
  counterpartLeft: false, anyRemoved: false, myHeld: false, status: "open" as const, myTurn: false, nextSeq: 2,
  sourceLabel: "", sourceText: "", publishMine: false, publishTheirs: false,
};
const theirTurn = { id: "t2", seq: 2, mine: false, quotedClaim: "q".repeat(12), body: "c".repeat(160), held: false };
const outside = (out: string) => out.replace(/<details[\s\S]*?<\/details>/g, "");

afterEach(() => vi.unstubAllEnvs());

describe("an exchange with a sample account", () => {
  it("tags the sample's argument once, and says before the reader writes that it is an AI sample account", () => {
    const out = html(createElement(ExchangeView, { ...base, turns: [...base.turns, theirTurn], myTurn: true, nextSeq: 3, sourceLabel: "their last reply", sourceText: "c".repeat(160), counterpartIsSample: true }));
    expect(out.match(/<details/g)).toHaveLength(1);
    expect(out).toContain(">AI<");
    expect(out.split(SAMPLE_WRITING_LINE)).toHaveLength(2);
    expect(SAMPLE_WRITING_LINE).toBe("You're arguing with an AI sample account.");
    // The line comes before the composer, and the tag is in no <p>.
    expect(out.indexOf(SAMPLE_WRITING_LINE)).toBeLessThan(out.indexOf("<textarea"));
    expect(out).not.toMatch(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<details/);
    // Report stays, Block does not: blocking would not stop its AI.
    expect(out).toContain(">Report<");
    expect(out).not.toContain(">Block<");
    // Outside the tag and the line, nothing names a sample or speaks of it as a person.
    const rest = outside(out).replace(SAMPLE_WRITING_LINE, "");
    expect(rest).not.toMatch(/sample|\bAI\b/i);
    expect(rest).not.toMatch(/\b(someone|person|their turn|they wrote)\b/i);
  });

  it("asks for the sample's reply when it is due, and offers no publishing and no 'of you' when it is finished", () => {
    const due = html(createElement(ExchangeView, { ...base, counterpartIsSample: true, sampleReplyDue: true }));
    expect(due).toContain("The sample account is writing its reply.");
    expect(due).not.toContain("Waiting for your counterpart.");
    const done = html(createElement(ExchangeView, { ...base, status: "complete" as const, counterpartIsSample: true }));
    expect(done).toContain("Neither side has to concede.");
    expect(done).not.toContain("Neither of you");
    expect(done).not.toContain("Let others read this exchange");
  });

  it("leaves an exchange between two readers as it was", () => {
    const out = html(createElement(ExchangeView, { ...base, turns: [...base.turns, theirTurn], myTurn: true, nextSeq: 3, sourceText: "c".repeat(160) }));
    expect(out).not.toContain("<details");
    expect(out).not.toContain(SAMPLE_WRITING_LINE);
    expect(out).toContain(">Block<");
    const done = html(createElement(ExchangeView, { ...base, status: "complete" as const }));
    expect(done).toContain("Neither of you has to concede.");
    expect(done).toContain("Let others read this exchange");
    expect(html(createElement(ExchangeView, base))).toContain("Waiting for your counterpart.");
  });
});

describe("the offer when no one else is free", () => {
  const props = { debateId: "d1", topicSlug: "no-decision", initialSeeking: true, existingExchangeId: null };
  it("is made only with the replies on", () => {
    vi.stubEnv("SAMPLE_REPLIES", "1");
    const on = html(createElement(FindCounterpartButton, props));
    expect(on).toContain(SAMPLE_OFFER);
    expect(on).toContain("Argue now");
    vi.stubEnv("SAMPLE_REPLIES", "0");
    const off = html(createElement(FindCounterpartButton, props));
    expect(off).toContain("Waiting for a counterpart");
    expect(off).not.toContain(SAMPLE_OFFER);
  });
});

describe("/me", () => {
  it("tags a sample counterpart's school, and keeps a reader's as it was", () => {
    const rows = [
      { id: "a", topicTitle: "A", theirSchool: "ubuntu" as const, myTurn: false, theirIsSample: true },
      { id: "b", topicTitle: "B", theirSchool: "buddhist" as const, myTurn: false },
    ];
    const out = html(createElement(OpenExchanges, { exchanges: rows, school: "stoicism" }));
    expect(out.match(/<details/g)).toHaveLength(1);
    expect(out).toContain("Counterpart's turn");
    expect(out).toContain("Their turn");
  });
});

describe("/me's rows", () => {
  it("mark an exchange whose counterpart is a sample, and only that", async () => {
    const { meExchangeRows } = await import("../src/lib/counterpart-lapse");
    const now = new Date("2026-11-20T12:00:00Z");
    const row = (id: string, other: string) => ({ id, topic_slug: "t", user_a: "reader", user_b: other, school_a: "stoicism" as const, school_b: "ubuntu" as const, next_turn: other, last_turn_at: "2026-11-20T10:00:00Z" });
    const rows = meExchangeRows([row("a", "sample-1"), row("b", "human")], [], "reader", (s) => s, now, new Set(["sample-1"]));
    expect(rows.map((r) => [r.id, r.theirIsSample ?? false])).toEqual([["a", true], ["b", false]]);
    expect(readFileSync("src/app/me/page.tsx", "utf8")).toMatch(/\.eq\("is_sample", true\)\.in\("id", counterpartIds\)/);
  });
});

describe("the explanation", () => {
  it("adds Arthur's third sentence once the replies are on, and not before", async () => {
    expect(SAMPLE_EXPLANATION).toBe("Sample accounts are run by AI. They show what arguing here looks like.");
    vi.resetModules();
    vi.stubEnv("SAMPLE_REPLIES", "1");
    try {
      const on = await import("../src/lib/sample");
      expect(on.SAMPLE_EXPLANATION).toBe(
        "Sample accounts are run by AI. They show what arguing here looks like, and when no one else is free you can argue against one, because philosophy needs someone to argue with."
      );
    } finally {
      vi.resetModules();
    }
  });
});
