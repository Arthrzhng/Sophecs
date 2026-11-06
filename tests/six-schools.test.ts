// The SIX_SCHOOLS build flag (docs/stage5-plan.md, step 1), run both
// ways. next.config.ts writes `process.env.SIX_SCHOOLS` into the build as
// a constant; here the modules read it when they load, so each case stubs
// it and loads them afresh.
//
// What a flag-on build must do: show the three after the published
// schools, and answer for them in every lookup with the colours chosen
// under ruling 16. Since Gate 3 (Arthur, Checkpoint B, 2026-11-05) it also
// judges them: their approved criteria and their place among the rival
// schools go into what the judge receives on a flag-on build, and on no
// other. A build without the flag sends exactly what it sent before.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const created: Record<string, unknown>[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async (params: Record<string, unknown>) => {
        created.push(params);
        return {
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [{ type: "text", text: JSON.stringify({ rejected: true, rejection_reason: "fixture" }) }],
        };
      },
    };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}));

const NEW_THREE = ["confucian", "ubuntu", "buddhist"] as const;
const LIVE_THREE = ["stoicism", "utilitarianism", "virtue-ethics"] as const;

async function load(flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv("SIX_SCHOOLS", flag);
  return {
    registry: await import("../src/lib/school-registry"),
    drafts: await import("../src/lib/school-registry.drafts"),
    colours: await import("../src/lib/school-colors"),
    card: await import("../src/lib/card-tokens"),
    chunky: await import("../src/components/daily-path/chunky"),
    rubric: await import("../src/lib/judge/rubric"),
    schema: await import("../src/lib/judge/schema"),
    anthropic: await import("../src/lib/anthropic"),
  };
}
afterEach(() => vi.unstubAllEnvs());

const CSS = fs.readFileSync(path.join(process.cwd(), "src", "app", "six-schools.css"), "utf8");
const TOKENS = Object.fromEntries(
  [...CSS.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]])
);
const CHOSEN = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "docs", "phase3-styleguide", "colour-candidates.json"), "utf8")
) as { chosen: Record<string, string>; candidates: Record<string, { hex: string; cardSurface: string }[]> };

describe("a build without SIX_SCHOOLS", () => {
  it.each(["0", ""])("shows exactly what production publishes (SIX_SCHOOLS=%j)", async (flag) => {
    const { registry, colours, card } = await load(flag);
    expect(registry.SHOWN_SCHOOL_IDS).toEqual([...LIVE_THREE]);
    expect(registry.SHOWN_SCHOOL_IDS).toEqual(registry.PUBLISHED_SCHOOL_IDS);
    for (const id of NEW_THREE) {
      expect(registry.isShown(id)).toBe(false);
      expect(registry.schoolName(id)).toBe(id);
      expect(colours.SCHOOL_TEXT_CLASS[id]).toBe("text-ink");
      expect(card.CARD_SURFACE[id]).toBe(card.CARD_SURFACE_NEUTRAL);
    }
  });
});

describe("a build with SIX_SCHOOLS=1", () => {
  it("shows the three after the published schools, in the registry's order", async () => {
    const { registry } = await load("1");
    expect(registry.SHOWN_SCHOOL_IDS).toEqual([...LIVE_THREE, ...NEW_THREE]);
    for (const entry of registry.SHOWN_SCHOOLS.slice(3)) expect(entry.status).toBe("draft");
  });

  it("names each of the three as the drafts module does", async () => {
    const { registry, drafts } = await load("1");
    for (const draft of drafts.DRAFT_SCHOOLS) {
      const shown = registry.shownEntry(draft.id);
      expect(shown, draft.id).not.toBeNull();
      expect({ ...shown, colourToken: null }).toEqual(draft);
    }
  });

  it("does not change the drafts module, which the bundle check reads", async () => {
    const off = (await load("0")).drafts.DRAFT_SCHOOLS;
    const on = (await load("1")).drafts.DRAFT_SCHOOLS;
    expect(on).toEqual(off);
    expect(on.map((d) => d.id)).toEqual([...NEW_THREE]);
  });

  it("gives each a colour token that the flag-only stylesheet defines, with its surface and deep shade", async () => {
    const { registry } = await load("1");
    for (const id of NEW_THREE) {
      expect(registry.shownEntry(id)?.colourToken).toBe(`--color-${id}`);
      expect(TOKENS[id], `--color-${id}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(TOKENS[`${id}-surface`], `--color-${id}-surface`).toMatch(/^#[0-9a-f]{6}$/);
      expect(TOKENS[`${id}-deep`], `--color-${id}-deep`).toMatch(/^#[0-9a-f]{6}$/);
      expect(CSS, `.text-${id}`).toContain(`.text-${id} {\n  color: var(--color-${id});\n}`);
    }
  });

  it("uses the colours chosen under ruling 16, markers and card surfaces", () => {
    for (const id of NEW_THREE) {
      expect(TOKENS[id]).toBe(CHOSEN.chosen[id]);
      const chosen = CHOSEN.candidates[id].find((c) => c.hex === CHOSEN.chosen[id]);
      expect(TOKENS[`${id}-surface`]).toBe(chosen?.cardSurface);
    }
  });

  it("mirrors the stylesheet in card-tokens.ts, for the image routes", async () => {
    const { card } = await load("1");
    for (const id of NEW_THREE) {
      expect(card.CARD_SURFACE[id]).toBe(TOKENS[`${id}-surface`]);
      expect(card.SCHOOL_MARKER[id]).toBe(TOKENS[id]);
    }
  });

  it("answers for the three in every lookup keyed by school", async () => {
    const { registry, colours, chunky, drafts } = await load("1");
    for (const draft of drafts.DRAFT_SCHOOLS) {
      const id = draft.id;
      expect(registry.schoolName(id)).toBe(draft.name);
      expect(registry.schoolAdherent(id)).toBe(draft.adherent);
      expect(registry.schoolAdherentPlural(id)).toBe(draft.adherentPlural);
      expect(registry.schoolColourVar(id)).toBe(`var(--color-${id})`);
      expect(registry.schoolShadeVar(id)).toBe(`var(--color-${id}-deep)`);
      expect(colours.SCHOOL_COLORS[id].name).toBe(draft.name);
      expect(colours.SCHOOL_ADHERENT[id]).toBe(draft.adherent);
      expect(colours.SCHOOL_ADHERENT_PLURAL[id]).toBe(draft.adherentPlural);
      expect(colours.SCHOOL_TEXT_CLASS[id]).toBe(`text-${id}`);
      // Ruling (e)1 of 2026-11-05: "an Ubuntu Ethicist", and "a" for the rest.
      expect(colours.SCHOOL_ARTICLE[id], id).toBe(id === "ubuntu" ? "an" : "a");
      expect(chunky.SCHOOL_CHUNKY[id]).toEqual({ bg: `var(--color-${id})`, shade: `var(--color-${id}-deep)` });
    }
  });

  it("starts each school's name with its adherent noun's sound, so one article serves both", async () => {
    // Verdict.tsx writes SCHOOL_ARTICLE before a school's name ("an Ubuntu
    // objection"); that holds only while name and noun begin alike.
    const { colours } = await load("1");
    for (const id of Object.keys(colours.SCHOOL_COLORS) as (keyof typeof colours.SCHOOL_COLORS)[]) {
      expect(colours.SCHOOL_COLORS[id].name.slice(0, 4), id).toBe(colours.SCHOOL_ADHERENT[id].slice(0, 4));
    }
    expect(Object.keys(colours.SCHOOL_COLORS)).toHaveLength(6);
  });

  it("keeps every live school's lookups as they are without the flag", async () => {
    const pick = (m: Awaited<ReturnType<typeof load>>) =>
      LIVE_THREE.map((id) => [
        m.registry.schoolName(id),
        m.registry.schoolAdherent(id),
        m.registry.schoolColourVar(id),
        m.colours.SCHOOL_COLORS[id],
        m.colours.SCHOOL_TEXT_CLASS[id],
        m.card.CARD_SURFACE[id],
        m.card.SCHOOL_MARKER[id],
        m.chunky.SCHOOL_CHUNKY[id],
      ]);
    expect(pick(await load("1"))).toEqual(pick(await load("0")));
  });
});

// The request a build sends, for the fixed inputs tests/judge-request.test.ts
// uses, so the two sets of fixtures differ only in what the flag changes.
const MOTION =
  "An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions.";
const ARGUMENT = "The decision to deploy is the part that is up to us, and the part we answer for.";
const REVISION = {
  originalArgument: "An earlier attempt that left the objection standing.",
  objectionClaim: "It never says who carries the cost when the system is wrong.",
};
const REQUESTS = path.join(process.cwd(), "tests", "judge-request");

// A plain file, not a vitest snapshot, for the reason tests/judge-request.test.ts
// gives: `vitest -u` would rewrite a snapshot without anybody deciding to.
// Rewriting these needs WRITE_JUDGE_FIXTURES=1, which no script sets.
function compareRequest(file: string, params: Record<string, unknown>) {
  const serialised = `${JSON.stringify(params, null, 2)}\n`;
  if (process.env.WRITE_JUDGE_FIXTURES === "1") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, serialised, "utf-8");
    return;
  }
  expect(fs.existsSync(file), `missing fixture ${file}`).toBe(true);
  expect(serialised).toBe(fs.readFileSync(file, "utf-8"));
}

const verdictNaming = (school: string) => ({
  rejected: false,
  score: 72,
  fidelity: 8,
  rigor: 7,
  engagement: 4,
  strongest_move: "It locates the agent's responsibility in what is up to her.",
  weakest_move: "It never says why consenting is itself just.",
  a_stronger_version_would: "Say why consenting is the just choice.",
  verdict_line: "Answerable for her choice, not the weather.",
  unanswered_objection: {
    school,
    claim: "The patients waiting care about the ordering.",
    why_it_stands: "It never weighs what the ordering does to them.",
  },
});

describe("the judge on a build without SIX_SCHOOLS", () => {
  // Gate 3 changes nothing here: production is this build.
  // "" and unset as well as "0": next.config.ts always writes "0" or "1",
  // but a golden run without the flag leaves it unset, and must judge as
  // production does.
  it.each([["0"], [""], [undefined]])("judges with v2, the published three only, and refuses a reply naming one of the three (SIX_SCHOOLS=%j)", async (flag) => {
    const { registry, rubric, schema, anthropic } = await load(flag);
    expect(schema.PROMPT_VERSION).toBe("v2");
    expect(anthropic.PROMPT_VERSION).toBe("v2");
    expect(rubric.judgeableSchools()).toEqual([...LIVE_THREE]);
    for (const id of NEW_THREE) {
      expect(rubric.hasFidelityCriteria(id)).toBe(false);
      expect(() => rubric.fidelityCriteriaFor(id, "v3")).toThrowError(/no fidelity criteria/);
      expect(rubric.rivalsOf(id)).toEqual([...LIVE_THREE]);
      expect(schema.VerdictSchema.safeParse(verdictNaming(id)).success, id).toBe(false);
    }
    expect(registry.PUBLISHED_SCHOOL_IDS).toEqual([...LIVE_THREE]);
  });

  it.each(LIVE_THREE)("sends the committed v2 request for %s, byte for byte", async (school) => {
    const { anthropic } = await load("0");
    created.length = 0;
    await anthropic.callJudgeModel(MOTION, school, ARGUMENT);
    await anthropic.callJudgeModel(MOTION, school, ARGUMENT, REVISION);
    expect(created).toHaveLength(2);
    expect(`${JSON.stringify(created[0], null, 2)}\n`).toBe(fs.readFileSync(path.join(REQUESTS, `${school}.json`), "utf8"));
    expect(`${JSON.stringify(created[1], null, 2)}\n`).toBe(
      fs.readFileSync(path.join(REQUESTS, `${school}.revision.json`), "utf8")
    );
  });
});

describe("the judge on a SIX_SCHOOLS build (Gate 3)", () => {
  const draft = () => {
    const text = fs.readFileSync(path.join(process.cwd(), "content", "prompts", "fidelity-criteria.draft.md"), "utf8");
    // The section body, as the loader parses it: after the `## \`id\``
    // heading line, up to the next `## `, trimmed.
    return (id: string) => {
      const section = text.split(/^## /m).find((part) => part.startsWith(`\`${id}\``))!;
      return section.slice(section.indexOf("\n")).trim();
    };
  };

  it("judges with v3, the only prompt that lists its rivals from the registry", async () => {
    const { schema, anthropic } = await load("1");
    expect(schema.PROMPT_VERSION).toBe("v3");
    expect(anthropic.PROMPT_VERSION).toBe("v3");
  });

  it("still publishes the original three, and rubric.ts still holds only theirs", async () => {
    const { registry, rubric } = await load("1");
    expect(registry.PUBLISHED_SCHOOL_IDS).toEqual([...LIVE_THREE]);
    for (const id of NEW_THREE) expect(() => rubric.FIDELITY_CRITERIA[id]).toThrowError(/no fidelity criteria/);
  });

  it("can judge all six, each against five rivals", async () => {
    const { rubric } = await load("1");
    expect(rubric.judgeableSchools()).toEqual([...LIVE_THREE, ...NEW_THREE]);
    for (const id of [...LIVE_THREE, ...NEW_THREE]) {
      expect(rubric.hasFidelityCriteria(id), id).toBe(true);
      expect(rubric.rivalsOf(id)).toEqual([...LIVE_THREE, ...NEW_THREE].filter((other) => other !== id));
    }
  });

  it("gives each of the three its approved section of the draft file, then its voice paragraph", async () => {
    const { rubric } = await load("1");
    const { objectionVoiceFor } = await import("../src/lib/judge/objection-voices");
    const sectionOf = draft();
    for (const id of NEW_THREE) {
      const section = sectionOf(id);
      expect(section).toMatch(/^A faithful /);
      expect(rubric.fidelityCriteriaFor(id, "v3")).toBe(`${section}\n\n${objectionVoiceFor(id, rubric.rivalsOf(id))}`);
      // Never under a prompt that counts the rivals as two.
      expect(() => rubric.fidelityCriteriaFor(id, "v2")).toThrowError(/only be judged under a prompt that lists its rivals/);
      expect(() => rubric.fidelityCriteriaFor(id, "v1")).toThrowError(/only be judged under a prompt that lists its rivals/);
    }
  });

  it("keeps each published school's criteria what they are without the flag, but for the rivals its voice names", async () => {
    const off = await load("0");
    const offCriteria = Object.fromEntries(LIVE_THREE.map((id) => [id, off.rubric.FIDELITY_CRITERIA[id]]));
    const on = await load("1");
    for (const id of LIVE_THREE) expect(on.rubric.FIDELITY_CRITERIA[id]).toBe(offCriteria[id]);
  });

  it("accepts a reply naming any of the six as the objection's school", async () => {
    const { schema } = await load("1");
    for (const id of [...LIVE_THREE, ...NEW_THREE]) {
      expect(schema.VerdictSchema.safeParse(verdictNaming(id)).success, id).toBe(true);
    }
    expect(schema.VerdictSchema.safeParse(verdictNaming("cynicism")).success).toBe(false);
  });

  it("refuses draft criteria passed in for one of the three, which now has its own", async () => {
    const { anthropic } = await load("1");
    created.length = 0;
    await expect(
      anthropic.callJudgeModel(MOTION, "ubuntu", ARGUMENT, undefined, "v3", "anything")
    ).rejects.toThrow(/draft criteria refused for "ubuntu"/);
    expect(created).toEqual([]);
  });

  // Every request a flag-on build can send, pinned like v2's, so a change
  // to what the judge receives on that build moves a fixture.
  it.each([...LIVE_THREE, ...NEW_THREE])("sends the committed v3 request for %s, byte for byte", async (school) => {
    const { anthropic } = await load("1");
    created.length = 0;
    await anthropic.callJudgeModel(MOTION, school, ARGUMENT);
    await anthropic.callJudgeModel(MOTION, school, ARGUMENT, REVISION);
    expect(created).toHaveLength(2);
    compareRequest(path.join(REQUESTS, "six-schools", `${school}.json`), created[0]);
    compareRequest(path.join(REQUESTS, "six-schools", `${school}.revision.json`), created[1]);

    const system = String(created[0].system);
    // The six, as the rival list.
    for (const id of [...LIVE_THREE, ...NEW_THREE]) expect(system).toContain(`- \`${id}\``);
    expect(system).not.toContain("{{RUBRIC}}");
    expect(system).not.toContain("{{RIVAL_SCHOOLS}}");
  });

  it("has a SIX_SCHOOLS golden run judge the three through the build's own path", async () => {
    // The new-schools run is meant to measure what a flag-on build sends,
    // so the runner hands callJudgeModel no override for the three on this
    // build, and checks first that the build's text is the draft file's.
    const { rubric } = await load("1");
    const { planCase, readDraftCriteria } = await import("./judge/draft-criteria");
    const prompt = (v: string) => fs.readFileSync(path.join(process.cwd(), "content", "prompts", `judge.${v}.md`), "utf8");
    const sections = readDraftCriteria();
    for (const id of NEW_THREE) {
      const plan = planCase(id, prompt("v3"), sections, "v3");
      expect(plan).toMatchObject({ run: true, source: "draft", draftCriteria: undefined });
      if (plan.run) expect(plan.criteria).toBe(rubric.fidelityCriteriaFor(id, "v3"));
      // Still skipped under v2, before the build is asked for criteria it
      // would refuse.
      expect(planCase(id, prompt("v2"), sections, "v2").run).toBe(false);
      // And a run whose draft text differs from the build's stops before
      // any call.
      expect(() => planCase(id, prompt("v3"), { ...sections, [id]: "A faithful other text." }, "v3")).toThrowError(
        /differ from the draft file's/
      );
    }
    for (const id of LIVE_THREE) {
      expect(planCase(id, prompt("v3"), sections, "v3")).toMatchObject({ run: true, source: "live", draftCriteria: undefined });
    }
  });

  it("sends the draft file's text for each of the three, exactly", async () => {
    const { anthropic } = await load("1");
    const sectionOf = draft();
    for (const id of NEW_THREE) {
      created.length = 0;
      await anthropic.callJudgeModel(MOTION, id, ARGUMENT);
      expect(String(created[0].system)).toContain(sectionOf(id));
    }
  });
});
