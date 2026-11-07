// Arthur's Gate 4 rulings of 2026-11-07 on content, items 8, 10 and 12
// (item 11, the exemplar floor, is in tests/exemplars.test.ts, and the
// re-screening job's side of item 12 in tests/rescreen.test.ts).
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import matter from "gray-matter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeLapsed, LAPSE_DAYS, type LapseExchange, type LapseTurn } from "../src/lib/counterpart";
import { closeIfLapsed, exchangeForLapse, meExchangeRows, readExchangeTurns, type OpenExchangeRow, type TurnState } from "../src/lib/counterpart-lapse";
import { OpenExchanges } from "../src/components/me/OpenExchanges";
import { SchoolMap } from "../src/components/phase3/SchoolMap";

vi.mock("server-only", () => ({}));

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("item 8: the two fixes to the v2 copy", () => {
  const map = (whose?: "your" | "their") =>
    renderToStaticMarkup(
      <SchoolMap
        title="Where these answers put them, on the map of the schools"
        schools={[{ id: "stoicism", name: "Stoicism", angle: 0, colour: "var(--color-stoic)" }]}
        axes={{ x: ["Each person on their own", "People through each other"], y: ["How it turns out", "Who you are and what you owe"] }}
        reader={{ x: 0.1, y: 0.2 }}
        {...(whose ? { whose } : {})}
      />
    );

  it("says where you stand on the reader's own map, and where they stand on someone else's", () => {
    expect(map()).toContain("A filled dot marks where you stand.");
    expect(map("your")).toContain("A filled dot marks where you stand.");
    expect(map("their")).toContain("A filled dot marks where they stand.");
    expect(map("their")).not.toContain("you stand");
  });

  it("gives the shared result's map (/r/<id>) their answers, not yours", () => {
    const page = read("src/app/r/[id]/page.tsx");
    const maps = page.match(/<SchoolMap[\s\S]*?\/>/g) ?? [];
    expect(maps).toHaveLength(1);
    expect(maps[0]).toContain('whose="their"');
  });

  it("rewrites Utilitarianism's share line [1] so it no longer cites v1's self-driving-car question", () => {
    const lines = matter(read("content/schools/utilitarianism.md")).data.share_lines as string[];
    expect(lines[1]).toBe(
      "Turns out I'd pick whatever does the most good for the most people, even when I'm the one who pays for it. Sophecs called that Utilitarian."
    );
    for (const id of ["stoicism", "utilitarianism", "virtue-ethics", "confucian", "ubuntu", "buddhist"]) {
      const all = (matter(read(`content/schools/${id}.md`)).data.share_lines as string[]).join(" ");
      expect(all, id).not.toMatch(/self-driving|the car chooses/i);
    }
  });
});

describe("item 10: the rubric shows what the judge is given, in full", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const load = async (flag: string) => {
    vi.resetModules();
    vi.stubEnv("SIX_SCHOOLS", flag);
    return {
      component: await import("../src/components/how-it-works/Rubric"),
      rubric: await import("../src/lib/judge/rubric"),
      schema: await import("../src/lib/judge/schema"),
      registry: await import("../src/lib/school-registry"),
      colours: await import("../src/lib/school-colors"),
    };
  };
  // The page sets each paragraph on one line; the judge's text keeps its
  // line breaks. Escaped as React escapes text.
  const shown = (text: string) =>
    text.split("\n\n").map((p) => p.replace(/\n/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"));

  it("on a SIX_SCHOOLS build: all six schools, each with the v3 criteria the judge is given", async () => {
    const { component, rubric, schema, registry, colours } = await load("1");
    expect(schema.PROMPT_VERSION).toBe("v3");
    expect(registry.SHOWN_SCHOOL_IDS).toHaveLength(6);
    const html = renderToStaticMarkup(<component.RubricCriteria />);
    for (const id of registry.SHOWN_SCHOOL_IDS) {
      expect(html, id).toContain(colours.SCHOOL_COLORS[id].name);
      const given = rubric.fidelityCriteriaFor(id, "v3");
      // v3 adds paragraphs to each of the three's v2 text, and the three
      // new schools have no v2 text: every paragraph is on the page.
      for (const paragraph of shown(given)) expect(html, `${id}: ${paragraph.slice(0, 60)}`).toContain(paragraph);
    }
    // Including the paragraphs v2 does not have, such as the voice line.
    expect(html).toContain("Of the rival schools this prompt lists");
  });

  it("on a build without the flag: the published three with the v2 criteria, as before", async () => {
    const { component, rubric, schema, registry, colours } = await load("0");
    expect(schema.PROMPT_VERSION).toBe("v2");
    const html = renderToStaticMarkup(<component.RubricCriteria />);
    for (const id of registry.PUBLISHED_SCHOOL_IDS) {
      expect(rubric.fidelityCriteriaFor(id, "v2")).toBe(rubric.FIDELITY_CRITERIA[id]);
      for (const paragraph of shown(rubric.FIDELITY_CRITERIA[id])) expect(html, id).toContain(paragraph);
    }
    for (const id of ["confucian", "ubuntu", "buddhist"] as const) expect(html, id).not.toContain(colours.SCHOOL_COLORS[id].name);
    expect(html).not.toContain("Of the rival schools this prompt lists");
  });
});

describe("item 12: a reply waiting to be screened holds the lapse clock", () => {
  // In the past, so code that read the real clock in place of `now` would
  // see even the recent exchanges here as lapsed, on any date.
  const now = new Date("2026-10-01T12:00:00Z");
  const old = new Date(now.getTime() - (LAPSE_DAYS + 6) * 24 * 60 * 60 * 1000).toISOString();
  const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  // A opens (turns 1 and 3 are A's), B replies (2 and 4).
  const ex = (extra: Partial<LapseExchange> = {}): LapseExchange => ({ user_a: "a", user_b: "b", next_turn: "b", last_turn_at: old, ...extra });
  const t = (seq: number, author_id: string | null, screen_result: string): LapseTurn => ({ seq, author_id, screen_result });

  it("does not lapse while the latest reply, by the author whose turn it is, waits to be screened", () => {
    expect(exchangeLapsed(ex(), [t(1, "a", "ok"), t(2, "b", "pending")], now)).toBe(false);
  });

  it("is not held by a screened reply whose hand-over never happened (review of #102, pass 2)", () => {
    // Screened ok, but the exchange still waits on its author: the ruling
    // holds the clock until a reply is screened, and a hold here would
    // never end, since nothing reads an ok reply again.
    expect(exchangeLapsed(ex(), [t(1, "a", "ok"), t(2, "b", "ok")], now)).toBe(true);
  });

  it("lapses as before once the reply is delivered or held", () => {
    // Delivered: the exchange has moved on to A.
    expect(exchangeLapsed(ex({ next_turn: "a" }), [t(1, "a", "ok"), t(2, "b", "ok")], now)).toBe(true);
    expect(exchangeLapsed(ex({ next_turn: "a", last_turn_at: recent }), [t(1, "a", "ok"), t(2, "b", "ok")], now)).toBe(false);
    // Held or removed: the clock runs from the last delivered reply.
    expect(exchangeLapsed(ex(), [t(1, "a", "ok"), t(2, "b", "flagged")], now)).toBe(true);
    expect(exchangeLapsed(ex(), [t(1, "a", "ok"), t(2, "b", "removed")], now)).toBe(true);
    expect(exchangeLapsed(ex(), [], now)).toBe(true);
  });

  it("is held only by a reply the daily job could deliver", () => {
    // Not the latest reply (turns in any order).
    expect(exchangeLapsed(ex(), [t(3, "a", "ok"), t(2, "b", "pending")], now)).toBe(true);
    // Not the author's turn by next_turn.
    expect(exchangeLapsed(ex({ next_turn: "a" }), [t(1, "a", "ok"), t(2, "b", "pending")], now)).toBe(true);
    // Not the author's turn by sequence.
    expect(exchangeLapsed(ex(), [t(1, "a", "ok"), t(2, "a", "ok"), t(3, "b", "pending")], now)).toBe(true);
    // Its author's account is gone.
    expect(exchangeLapsed(ex({ user_b: null, next_turn: null }), [t(1, "a", "ok"), t(2, null, "pending")], now)).toBe(true);
    // The opener has left: B's reply can never be handed over either.
    expect(exchangeLapsed(ex({ user_a: null }), [t(1, "a", "ok"), t(2, "b", "pending")], now)).toBe(true);
    // The counterpart has left: A's reply can never be handed over (review
    // of #102, B1). Held, it would keep the exchange open for good.
    expect(exchangeLapsed(ex({ user_b: null, next_turn: "a" }), [t(1, "a", "ok"), t(2, "b", "ok"), t(3, "a", "pending")], now)).toBe(true);
  });
});

describe("item 12: /me's open exchanges", () => {
  // In the past, so code that read the real clock in place of `now` would
  // see even the recent exchanges here as lapsed, on any date.
  const now = new Date("2026-10-01T12:00:00Z");
  const old = new Date(now.getTime() - (LAPSE_DAYS + 6) * 24 * 60 * 60 * 1000).toISOString();
  const row = (id: string, extra: Partial<OpenExchangeRow> = {}): OpenExchangeRow => ({
    id, topic_slug: "careful-builder", school_a: "stoicism", school_b: "utilitarianism",
    user_a: "me", user_b: "them", next_turn: "me", last_turn_at: old, ...extra,
  });
  const turn = (exchange_id: string, seq: number, author_id: string, screen_result = "ok"): TurnState => ({ exchange_id, seq, author_id, screen_result });
  const rows = (exchanges: OpenExchangeRow[], turns: TurnState[]) =>
    meExchangeRows(exchanges, turns, "me", (slug) => `Title of ${slug}`, now);

  it("keeps an old exchange whose latest reply is the reader's own, waiting to be checked, in any order the turns come", () => {
    const turns = [turn("x1", 3, "me", "pending"), turn("x1", 1, "me"), turn("x1", 2, "them")];
    const [r] = rows([row("x1")], turns);
    expect(r).toEqual({ id: "x1", topicTitle: "Title of careful-builder", theirSchool: "utilitarianism", myTurn: true, myReplyPending: true });
  });

  it("keeps each exchange's turns apart", () => {
    const turns = [turn("x1", 1, "me"), turn("x2", 1, "me"), turn("x2", 2, "them"), turn("x1", 2, "them"), turn("x1", 3, "me", "pending")];
    const r = rows([row("x1"), row("x2")], turns);
    // x1's latest is the reader's pending reply; x2's latest is delivered, so it has lapsed.
    expect(r.map((e) => [e.id, e.myReplyPending])).toEqual([["x1", true]]);
  });

  it("reads each open exchange's turns in one query, with no text, and none when there are none", async () => {
    const calls: { table: string; select?: string; in?: [string, unknown[]] }[] = [];
    const admin = {
      from(table: string) {
        const call: (typeof calls)[number] = { table };
        calls.push(call);
        const b: Record<string, unknown> = {};
        b.select = (cols: string) => ((call.select = cols), b);
        b.in = (c: string, vs: unknown[]) => ((call.in = [c, vs]), Promise.resolve({ data: [turn("x1", 1, "me")] }));
        return b;
      },
    } as never;
    expect(await readExchangeTurns(admin, [])).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(await readExchangeTurns(admin, ["x1", "x2"])).toEqual([turn("x1", 1, "me")]);
    expect(calls).toEqual([{ table: "turns", select: "exchange_id, seq, author_id, screen_result", in: ["exchange_id", ["x1", "x2"]] }]);
  });

  it("leaves none out, and says no reply is waiting, when the turns could not be read (review of #102, pass 3)", async () => {
    const r = meExchangeRows([row("x1"), row("x2")], null, "me", (slug) => `Title of ${slug}`, now);
    expect(r.map((e) => [e.id, e.myReplyPending])).toEqual([["x1", false], ["x2", false]]);
    const admin = {
      from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: "down" } }) }) }),
    } as never;
    expect(await readExchangeTurns(admin, ["x1"])).toBeNull();
  });

  it("leaves out an old exchange with nothing waiting, and one whose counterpart has left", () => {
    expect(rows([row("x1")], [turn("x1", 1, "me"), turn("x1", 2, "them")])).toEqual([]);
    expect(rows([row("x2", { user_b: null })], [turn("x2", 1, "me"), turn("x2", 2, "them"), turn("x2", 3, "me", "pending")])).toEqual([]);
  });

  it("keeps a recent exchange, and says whose turn it is", () => {
    const recent = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const r = rows([row("x3", { last_turn_at: recent, next_turn: "them", user_a: "them", user_b: "me", school_a: "virtue-ethics" })], [turn("x3", 1, "them"), turn("x3", 2, "me")]);
    expect(r).toEqual([{ id: "x3", topicTitle: "Title of careful-builder", theirSchool: "virtue-ethics", myTurn: false, myReplyPending: false }]);
  });

  it("is what /me builds its list with", () => {
    const me = read("src/app/me/page.tsx");
    expect(me).toContain("const openTurns = await readExchangeTurns(admin, openRows.map((row) => row.id));");
    expect(me).toContain("exchanges = meExchangeRows(openRows, openTurns, user.id,");
    expect(me).toContain('.select("id, topic_slug, user_a, user_b, school_a, school_b, next_turn, last_turn_at")');
  });
});

describe("item 12: the exchange page's close on view", () => {
  // In the past, so code that read the real clock in place of `now` would
  // see even the recent exchanges here as lapsed, on any date.
  const now = new Date("2026-10-01T12:00:00Z");
  const old = new Date(now.getTime() - (LAPSE_DAYS + 6) * 24 * 60 * 60 * 1000).toISOString();
  // A stand-in for the admin client: records each call, and answers the
  // conditional update with `closes` rows and the re-read with `nowStatus`.
  const fake = (closes: number, nowStatus = "open") => {
    const calls: { kind: string; filters: [string, string, unknown][]; patch?: unknown }[] = [];
    const admin = {
      from() {
        const call: (typeof calls)[number] = { kind: "read", filters: [] };
        calls.push(call);
        const b: Record<string, unknown> = {};
        b.update = (patch: unknown) => ((call.kind = "update"), (call.patch = patch), b);
        b.eq = (c: string, v: unknown) => (call.filters.push(["eq", c, v]), b);
        b.is = (c: string, v: unknown) => (call.filters.push(["is", c, v]), b);
        b.select = () => (call.kind === "update" ? Promise.resolve({ data: Array.from({ length: closes }, () => ({ id: "x" })) }) : b);
        b.maybeSingle = () => Promise.resolve({ data: { status: nowStatus } });
        return b;
      },
    };
    return { admin: admin as never, calls };
  };
  const exchange = (extra = {}) => ({ id: "x", status: "open", user_a: "a", user_b: "b", next_turn: "b", last_turn_at: old, ...extra });
  const t = (seq: number, author_id: string, screen_result = "ok") => ({ seq, author_id, screen_result });

  it("closes a lapsed exchange only while it is still open and waiting on whoever it was waiting on", async () => {
    const { admin, calls } = fake(1);
    expect(await closeIfLapsed(admin, exchange(), [t(1, "a")], now)).toBe("lapsed");
    expect(calls[0]).toEqual({
      kind: "update",
      patch: { status: "lapsed", next_turn: null },
      filters: [["eq", "id", "x"], ["eq", "status", "open"], ["eq", "next_turn", "b"]],
    });
    const nobody = fake(1);
    await closeIfLapsed(nobody.admin, exchange({ next_turn: null }), [t(1, "a")], now);
    expect(nobody.calls[0].filters).toContainEqual(["is", "next_turn", null]);
  });

  it("shows the exchange as it now stands when the close does not take", async () => {
    expect(await closeIfLapsed(fake(0, "complete").admin, exchange(), [t(1, "a")], now)).toBe("complete");
    expect(await closeIfLapsed(fake(0, "open").admin, exchange(), [t(1, "a")], now)).toBe("open");
  });

  it("does not touch an exchange a pending reply holds, or one already closed", async () => {
    const held = fake(1);
    expect(await closeIfLapsed(held.admin, exchange(), [t(1, "a"), t(2, "b", "pending")], now)).toBe("open");
    expect(held.calls).toHaveLength(0);
    const closed = fake(1);
    expect(await closeIfLapsed(closed.admin, exchange({ status: "complete" }), [t(1, "a")], now)).toBe("complete");
    expect(closed.calls).toHaveLength(0);
  });

  it("does not close a recent exchange", async () => {
    const recent = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const kept = fake(1);
    expect(await closeIfLapsed(kept.admin, exchange({ last_turn_at: recent }), [t(1, "a")], now)).toBe("open");
    expect(kept.calls).toHaveLength(0);
  });

  it("closes nothing when the turns could not be read", async () => {
    const failed = fake(1);
    expect(await closeIfLapsed(failed.admin, exchange(), null, now)).toBe("open");
    expect(failed.calls).toHaveLength(0);
  });

  it("reads the exchange row as the lapse rule needs it", () => {
    expect(exchangeForLapse({ id: "x", status: "open", user_a: "a", user_b: null, next_turn: "a", last_turn_at: old, topic_slug: "t" })).toEqual({
      id: "x", status: "open", user_a: "a", user_b: null, next_turn: "a", last_turn_at: old,
    });
    expect(exchangeForLapse({ id: "y", status: "open", user_a: "a", user_b: "b", next_turn: "b", last_turn_at: old })).toMatchObject({ user_b: "b", next_turn: "b" });
  });

  it("is what the exchange page decides its status with", () => {
    const page = read("src/app/counterpart/[id]/page.tsx");
    expect(page).toContain("const status = await closeIfLapsed(admin, exchangeForLapse(exchange), turnsError ? null : turns);");
    expect(page).not.toMatch(/\bisLapsed\(|\bexchangeLapsed\(/);
  });
});

describe("item 12: /me says a reader's own pending reply is waiting to be checked", () => {
  const row = { id: "x1", topicTitle: "The careful builder", theirSchool: "utilitarianism" as const, myTurn: true };

  it("shows 'Waiting to be checked' in place of Reply, and still links the exchange", () => {
    const html = renderToStaticMarkup(<OpenExchanges exchanges={[{ ...row, myReplyPending: true }]} school="stoicism" />);
    expect(html).toContain("Waiting to be checked");
    expect(html).not.toContain(">Reply<");
    expect(html).toContain('href="/counterpart/x1"');
    expect(html).toContain("The careful builder");
  });

  it("offers Reply as before when nothing of theirs is waiting", () => {
    const html = renderToStaticMarkup(<OpenExchanges exchanges={[row, { ...row, id: "x2", myReplyPending: false }]} school="stoicism" />);
    expect(html.match(/>Reply</g)).toHaveLength(2);
    expect(html).not.toContain("Waiting to be checked");
  });
});
