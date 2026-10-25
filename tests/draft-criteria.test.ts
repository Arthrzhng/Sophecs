import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The draft criteria reach a golden run and nothing else.
 *
 * Arthur's ruling of 2026-10-24: the approved criteria for the three draft
 * schools stay in content/prompts/fidelity-criteria.draft.md, out of
 * src/lib/judge/rubric.ts, until he publishes those schools in Phase 3.
 * Meanwhile /api/judge keeps refusing them. A golden run reads them from
 * the draft file so Tier B can be scored.
 *
 * Built like tests/golden-log.test.ts, and for the same reason: an
 * exception made for the eval is only worth having while it stays inside
 * the eval. This is the test that it does.
 */

// ---- the route, driven for real, with its boundaries stubbed ------------

const sdkCalls: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async (params: unknown) => {
        sdkCalls.push(params);
        throw new Error("the model must not be called in this test");
      },
    };
  },
}));

// Every table the route touches, and every insert, recorded.
const tablesRead: string[] = [];
const inserts: string[] = [];
let profileSchool = "confucian";

function query(table: string) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "order", "limit", "in", "neq"]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = async () => ({
    data:
      table === "profiles"
        ? { school: profileSchool, elo: 1200, streak: 0, streak_updated_on: null }
        : null,
  });
  builder.single = builder.maybeSingle;
  builder.insert = () => {
    inserts.push(table);
    return builder;
  };
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, count: 0 });
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      tablesRead.push(table);
      return query(table);
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "reader-1" } } }) },
  }),
}));

vi.mock("@/lib/budget", () => ({ isBudgetExceeded: async () => false }));

const { POST } = await import("../src/app/api/judge/route");
const { callJudgeModel } = await import("../src/lib/anthropic");
const { PUBLISHED_SCHOOL_IDS } = await import("../src/lib/school-registry");
const { DRAFT_SCHOOL_IDS } = await import("../src/lib/school-registry.drafts");
const { FIDELITY_CRITERIA } = await import("../src/lib/judge/rubric");
const { readDraftCriteria, planCase, DRAFT_CRITERIA_FILE } = await import("./judge/draft-criteria");

function submit() {
  return POST(
    new Request("http://localhost/api/judge", {
      method: "POST",
      body: JSON.stringify({
        topicSlug: "any-topic",
        argument: "An argument long enough that length is not the reason it stops.",
      }),
    })
  );
}

beforeEach(() => {
  sdkCalls.length = 0;
  tablesRead.length = 0;
  inserts.length = 0;
  process.env.KILL_SWITCH_JUDGE = "false";
  delete process.env.JUDGE_ALLOWLIST_USER_IDS;
});

describe("/api/judge still refuses every draft school", () => {
  it("covers exactly the three draft schools", () => {
    expect([...DRAFT_SCHOOL_IDS].sort()).toEqual(["buddhist", "confucian", "ubuntu"]);
  });

  for (const school of ["confucian", "ubuntu", "buddhist"]) {
    it(`refuses ${school}, before any topic lookup, insert or model call`, async () => {
      profileSchool = school;
      const res = await submit();
      expect(await res.json()).toEqual({ ok: false, paused: true, reason: "no_criteria" });

      expect(sdkCalls, "the model must not be called").toEqual([]);
      expect(inserts, "no row may be written").toEqual([]);
      expect(tablesRead).toContain("profiles");
      expect(tablesRead, "it must stop before the topic lookup").not.toContain("debate_topics");
    });
  }

  it("lets a live school past the refusal, so the three above are testing something", async () => {
    // The counter-case. If every school were refused, the three tests above
    // would pass for the wrong reason. A live school gets past the criteria
    // check and on to the topic lookup, which this stub answers with no
    // topic, so it stops there instead.
    profileSchool = "stoicism";
    const res = await submit();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Unknown topic." });
    expect(tablesRead).toContain("debate_topics");
    expect(sdkCalls).toEqual([]);
  });
});

// ---- nothing in production knows the draft file exists ------------------

describe("nothing in src/ reads the draft criteria", () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : /\.(tsx?|mjs|cjs|js)$/.test(e.name) ? [full] : [];
    });
  const sources = walk(path.join(process.cwd(), "src")).map((f) => ({
    file: path.relative(process.cwd(), f),
    text: fs.readFileSync(f, "utf-8"),
  }));

  // Strict on purpose: a plain substring match, comments included. A
  // smarter check that stripped comments would be one more thing a read
  // could hide from. The cost is that src/ cannot name the file even in a
  // comment, which the first run of this test enforced on anthropic.ts.
  it("names the draft file nowhere in src/", () => {
    const offenders = sources
      .filter((s) => s.text.includes("fidelity-criteria.draft"))
      .map((s) => s.file);
    expect(offenders, "nothing in src/ may read the draft criteria file").toEqual([]);
  });

  it("imports the golden run's loader nowhere in src/", () => {
    const offenders = sources.filter((s) => s.text.includes("draft-criteria")).map((s) => s.file);
    expect(offenders, "nothing in src/ may import tests/judge/draft-criteria").toEqual([]);
  });

  it("leaves rubric.ts holding the three live schools and nothing else", () => {
    for (const id of PUBLISHED_SCHOOL_IDS) expect(() => FIDELITY_CRITERIA[id]).not.toThrow();
    for (const id of DRAFT_SCHOOL_IDS) expect(() => FIDELITY_CRITERIA[id]).toThrow();
  });
});

// ---- what the golden run does with them ---------------------------------

describe("the golden run's draft criteria", () => {
  const draft = readDraftCriteria();
  const v2 = fs.readFileSync(path.join(process.cwd(), "content/prompts/judge.v2.md"), "utf-8");
  const v3 = fs.readFileSync(path.join(process.cwd(), "content/prompts/judge.v3.md"), "utf-8");

  it("reads exactly the three draft schools' sections, untouched", () => {
    expect(Object.keys(draft).sort()).toEqual(["buddhist", "confucian", "ubuntu"]);
    const file = fs.readFileSync(DRAFT_CRITERIA_FILE, "utf-8");
    for (const body of Object.values(draft)) {
      // Verbatim from the file, line breaks and all: this is the text that
      // was approved and measured, so it is the text the judge must get.
      expect(file).toContain(body as string);
      expect(body).toMatch(/^A faithful /);
      expect(body).not.toContain("## ");
    }
  });

  it("does not pull the disclosure list in with the criteria", () => {
    for (const body of Object.values(draft)) {
      expect(body).not.toContain("Doctrinal claims");
      expect(body).not.toContain("Arthur's ruling");
    }
  });

  it("judges a live school against rubric.ts, never the draft file", () => {
    for (const id of PUBLISHED_SCHOOL_IDS) {
      const plan = planCase(id, v3, draft);
      expect(plan).toMatchObject({ run: true, source: "live", draftCriteria: undefined });
      if (plan.run) expect(plan.criteria).toBe(FIDELITY_CRITERIA[id]);
    }
  });

  it("judges a draft school against the draft file, under v3", () => {
    for (const id of DRAFT_SCHOOL_IDS) {
      const plan = planCase(id, v3, draft);
      expect(plan).toMatchObject({ run: true, source: "draft", criteria: draft[id] });
    }
  });

  it("skips a draft school under v2, whose prompt counts the rivals as two", () => {
    for (const id of DRAFT_SCHOOL_IDS) {
      const plan = planCase(id, v2, draft);
      expect(plan.run).toBe(false);
      if (!plan.run) expect(plan.reason).toContain("counts them as two");
    }
  });

  it("throws, before any call, for an empty section", () => {
    for (const empty of ["", "   ", "\n\n"]) {
      expect(() => planCase("ubuntu", v3, { ubuntu: empty })).toThrow(
        'the draft criteria for "ubuntu" are empty'
      );
    }
  });

  it("throws, before any call, for a school with criteria nowhere", () => {
    expect(() => planCase("confucian", v3, {})).toThrow(
      /has no criteria in src\/lib\/judge\/rubric\.ts or in content\/prompts\/fidelity-criteria\.draft\.md/
    );
  });
});

describe("callJudgeModel's draftCriteria", () => {
  const draft = readDraftCriteria();

  it("puts the draft text into the request for a draft school", async () => {
    const created: Record<string, unknown>[] = [];
    // Capture without calling: the SDK stub throws after recording.
    sdkCalls.length = 0;
    await callJudgeModel("A motion.", "ubuntu", "An argument.", undefined, "v3", draft.ubuntu).catch(
      () => undefined
    );
    created.push(...(sdkCalls as Record<string, unknown>[]));
    expect(created).toHaveLength(1);
    const system = String(created[0].system);
    expect(system).toContain(draft.ubuntu as string);
    expect(system).not.toContain("{{RUBRIC}}");
    expect(system).not.toContain("{{RIVAL_SCHOOLS}}");
  });

  it("refuses draft text for a live school, so it can never replace live criteria", async () => {
    await expect(
      callJudgeModel("A motion.", "stoicism", "An argument.", undefined, "v3", "anything")
    ).rejects.toThrow(/draft criteria refused for "stoicism": it has live criteria/);
    expect(sdkCalls).toEqual([]);
  });

  it("still throws for a draft school given no draft text, exactly as before", async () => {
    await expect(callJudgeModel("A motion.", "buddhist", "An argument.")).rejects.toThrow(
      /no fidelity criteria for school "buddhist"/
    );
    expect(sdkCalls).toEqual([]);
  });
});
