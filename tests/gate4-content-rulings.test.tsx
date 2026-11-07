// Arthur's Gate 4 rulings of 2026-11-07 on content, items 8, 10 and 12
// (item 11, the exemplar floor, is in tests/exemplars.test.ts, and the
// re-screening job's side of item 12 in tests/rescreen.test.ts).
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import matter from "gray-matter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeLapsed, LAPSE_DAYS } from "../src/lib/counterpart";
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
  const now = new Date("2026-11-20T12:00:00Z");
  const old = new Date(now.getTime() - (LAPSE_DAYS + 6) * 24 * 60 * 60 * 1000).toISOString();
  const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const t = (author_id: string | null, screen_result: string) => ({ author_id, screen_result });

  it("does not lapse while the latest reply, the author's whose turn it is, is pending", () => {
    expect(exchangeLapsed(old, [t("a", "ok"), t("b", "pending")], "b", now)).toBe(false);
  });

  it("lapses as before once it is screened: delivered, or held", () => {
    // Delivered, the exchange has moved on (next_turn and last_turn_at).
    expect(exchangeLapsed(old, [t("a", "ok"), t("b", "ok")], "a", now)).toBe(true);
    expect(exchangeLapsed(recent, [t("a", "ok"), t("b", "ok")], "a", now)).toBe(false);
    // Held: the clock runs from the last delivered reply, as for a reply
    // held when it was sent.
    expect(exchangeLapsed(old, [t("a", "ok"), t("b", "flagged")], "b", now)).toBe(true);
    expect(exchangeLapsed(old, [], "b", now)).toBe(true);
  });

  it("is held only by a reply the daily job could deliver", () => {
    // Not the latest reply.
    expect(exchangeLapsed(old, [t("b", "pending"), t("a", "ok")], "b", now)).toBe(true);
    // Not its author's turn.
    expect(exchangeLapsed(old, [t("a", "ok"), t("b", "pending")], "a", now)).toBe(true);
    // Its author's account is gone.
    expect(exchangeLapsed(old, [t("a", "ok"), t(null, "pending")], null, now)).toBe(true);
  });

  it("is what the exchange page and /me decide lapse by, and the job no longer skips a pending reply in an old exchange", () => {
    const page = read("src/app/counterpart/[id]/page.tsx");
    expect(page).toMatch(/exchangeLapsed\(exchange\.last_turn_at as string, turns, nextTurn\)/);
    expect(page).not.toMatch(/\bisLapsed\(/);
    // Closed only while the exchange still waits on the same reader.
    expect(page).toMatch(/\.eq\("status", "open"\)/);
    expect(page).toMatch(/close\.eq\("next_turn", nextTurn\)/);
    const me = read("src/app/me/page.tsx");
    expect(me).toMatch(/\.filter\(\(row\) => !exchangeLapsed\(/);
    expect(me).not.toMatch(/\bisLapsed\(/);
    expect(read("src/lib/rescreen.ts")).not.toMatch(/last_turn_at"?, ?new Date/);
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

  it("is told by the reader's own latest reply, from /me's read of the turns", () => {
    const me = read("src/app/me/page.tsx");
    expect(me).toMatch(/myReplyPending: latestReplyPending\(turnsByExchange\.get\(row\.id as string\) \?\? \[\], user\.id\)/);
    // Who wrote each turn and how it was screened, never its text.
    expect(me).toMatch(/\.select\("exchange_id, author_id, screen_result"\)/);
  });
});
