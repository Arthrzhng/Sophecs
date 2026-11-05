// The SIX_SCHOOLS build flag (docs/stage5-plan.md, step 1), run both
// ways. next.config.ts writes `process.env.SIX_SCHOOLS` into the build as
// a constant; here the modules read it when they load, so each case stubs
// it and loads them afresh.
//
// What a flag-on build must do: show the three after the published
// schools, answer for them in every lookup with the colours chosen under
// ruling 16, and change nothing the judge receives, because the judge
// reads the published list and the published list does not move.
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

async function load(flag: string) {
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
      expect(chunky.SCHOOL_CHUNKY[id]).toEqual({ bg: `var(--color-${id})`, shade: `var(--color-${id}-deep)` });
    }
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

describe("the judge on a SIX_SCHOOLS build", () => {
  // The judge reads PUBLISHED_SCHOOL_IDS (the rival schools in its prompt,
  // the schools its reply may name), which the flag does not move. Gate 3
  // is Arthur's before that changes.
  it("still publishes, and can judge, the original three only", async () => {
    const { registry, rubric } = await load("1");
    expect(registry.PUBLISHED_SCHOOL_IDS).toEqual([...LIVE_THREE]);
    expect(rubric.judgeableSchools()).toEqual([...LIVE_THREE]);
    for (const id of NEW_THREE) expect(() => rubric.FIDELITY_CRITERIA[id]).toThrowError(/no fidelity criteria/);
  });

  it("refuses a reply that names one of the three as an objection's school", async () => {
    const { schema } = await load("1");
    const verdict = (school: string) => ({
      rejected: false,
      score: 72,
      fidelity: 8,
      rigor: 7,
      engagement: 5,
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
    expect(schema.VerdictSchema.safeParse(verdict("utilitarianism")).success).toBe(true);
    for (const id of NEW_THREE) expect(schema.VerdictSchema.safeParse(verdict(id)).success, id).toBe(false);
  });

  it.each(LIVE_THREE)("sends the same request for %s, byte for byte, as the committed fixture", async (school) => {
    const { anthropic } = await load("1");
    const dir = path.join(process.cwd(), "tests", "judge-request");
    const MOTION =
      "An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions.";
    const ARGUMENT = "The decision to deploy is the part that is up to us, and the part we answer for.";
    const REVISION = {
      originalArgument: "An earlier attempt that left the objection standing.",
      objectionClaim: "It never says who carries the cost when the system is wrong.",
    };
    created.length = 0;
    await anthropic.callJudgeModel(MOTION, school, ARGUMENT);
    await anthropic.callJudgeModel(MOTION, school, ARGUMENT, REVISION);
    expect(created).toHaveLength(2);
    expect(`${JSON.stringify(created[0], null, 2)}\n`).toBe(fs.readFileSync(path.join(dir, `${school}.json`), "utf8"));
    expect(`${JSON.stringify(created[1], null, 2)}\n`).toBe(
      fs.readFileSync(path.join(dir, `${school}.revision.json`), "utf8")
    );
  });
});
