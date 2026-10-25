import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";

// The request sent to the judge, captured at the SDK boundary.
//
// The rule this exists for: no production verdict may change. Three
// schools are live, one verdict has been judged, and anything that alters
// the bytes we send for those three alters how they would be judged
// again. So this test does not reimplement the request; it mocks
// @anthropic-ai/sdk and records exactly what src/lib/anthropic.ts hands
// to messages.create, then compares it against a committed fixture.
//
// Two deliberate choices. It captures at the SDK rather than rebuilding
// the string, because a reimplementation only ever proves that the copy
// is unchanged. And it compares against a plain file rather than a vitest
// snapshot, because `vitest -u` would rewrite a snapshot without anybody
// deciding to; rewriting these needs WRITE_JUDGE_FIXTURES=1, which no
// script sets.
//
// The fixture carries the whole system prompt, so it also fails if
// content/prompts/judge.v2.md changes. That file is frozen; this is the
// test that notices.

const created: Record<string, unknown>[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: async (params: Record<string, unknown>) => {
        created.push(params);
        // A rejection is the smallest response VerdictSchema accepts, and
        // what the model returns is irrelevant here: the request is the
        // subject.
        return {
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [
            {
              type: "text",
              text: JSON.stringify({ rejected: true, rejection_reason: "fixture" }),
            },
          ],
        };
      },
    };
  }
  return { default: MockAnthropic };
});

// judgeDebate logs every call, and the point of exercising it here is to
// prove production cannot reach a non-default prompt. The ledger write is
// not the subject, so it is stubbed rather than reached.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));

const { callJudgeModel, judgeDebate, PROMPT_VERSION } = await import("../src/lib/anthropic");
const { motionForDebate } = await import("../src/lib/motion-text");
const { PUBLISHED_SCHOOL_IDS } = await import("../src/lib/school-registry");

// The three schools with rows in production. Written out rather than read
// from the registry on purpose: if the registry ever stopped listing one
// of them, a test that read the registry would quietly stop checking it.
const LIVE_IN_PRODUCTION = ["stoicism", "utilitarianism", "virtue-ethics"] as const;

// Fixed inputs. Short, so a diff in a fixture is a diff in the assembly
// and never in the test's own prose.
const MOTION =
  "An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions.";
const ARGUMENT =
  "The decision to deploy is the part that is up to us, and the part we answer for.";
const REVISION = {
  originalArgument: "An earlier attempt that left the objection standing.",
  objectionClaim: "It never says who carries the cost when the system is wrong.",
};

const DIR = path.join(process.cwd(), "tests", "judge-request");

function compare(name: string, params: Record<string, unknown>) {
  const file = path.join(DIR, `${name}.json`);
  const serialised = `${JSON.stringify(params, null, 2)}\n`;
  if (process.env.WRITE_JUDGE_FIXTURES === "1") {
    fs.writeFileSync(file, serialised, "utf-8");
    return;
  }
  expect(fs.existsSync(file), `missing fixture ${file}`).toBe(true);
  expect(serialised).toBe(fs.readFileSync(file, "utf-8"));
}

describe("the request sent to the judge", () => {
  for (const school of LIVE_IN_PRODUCTION) {
    it(`is byte-identical for ${school}`, async () => {
      created.length = 0;
      await callJudgeModel(MOTION, school, ARGUMENT);
      expect(created).toHaveLength(1);
      compare(school, created[0]);
    });

    it(`is byte-identical for ${school} on a revision`, async () => {
      created.length = 0;
      await callJudgeModel(MOTION, school, ARGUMENT, REVISION);
      expect(created).toHaveLength(1);
      compare(`${school}.revision`, created[0]);
    });
  }

  it("sends the school's own fidelity criteria and nobody else's", async () => {
    const systems: string[] = [];
    for (const school of LIVE_IN_PRODUCTION) {
      created.length = 0;
      await callJudgeModel(MOTION, school, ARGUMENT);
      systems.push(String(created[0].system));
    }
    expect(new Set(systems).size).toBe(LIVE_IN_PRODUCTION.length);
    // No template placeholder survives into the request.
    for (const system of systems) expect(system).not.toContain("{{RUBRIC}}");
  });
});

describe("2D: the motion the route now passes", () => {
  // /api/judge used to pass `topic.motion`. It now passes
  // `motionForDebate(stored, topic.motion)`. Judging is live, so every
  // shape a submission can take is composed through the selector and
  // compared against the fixtures captured before 2D existed. A fixture
  // that changed would fail here, and none of them is in this branch's
  // diff.
  const REWORDED_TO =
    "An AI system that reliably reduces suffering should be deployed even where the people it decides about cannot be told why.";

  function userTurnOf(params: Record<string, unknown>): string {
    return String((params.messages as { content: string }[])[0].content);
  }

  for (const school of LIVE_IN_PRODUCTION) {
    it(`an original on a fresh row is byte-identical for ${school}`, async () => {
      // Nothing stored yet, so the selector returns the live motion.
      const motion = motionForDebate(undefined, MOTION);
      expect(motion).toBe(MOTION);
      created.length = 0;
      await callJudgeModel(motion, school, ARGUMENT);
      expect(created).toHaveLength(1);
      compare(school, created[0]);
    });

    it(`a revision is byte-identical for ${school}`, async () => {
      // A revision takes the parent's stored wording, and is given the
      // original and the objection alongside it.
      const motion = motionForDebate(MOTION, REWORDED_TO);
      expect(motion).toBe(MOTION);
      created.length = 0;
      await callJudgeModel(motion, school, ARGUMENT, REVISION);
      expect(created).toHaveLength(1);
      compare(`${school}.revision`, created[0]);
      expect(userTurnOf(created[0])).not.toContain(REWORDED_TO);
    });

    it(`a pending row is judged under its own wording for ${school}`, async () => {
      // The sharper half of the problem: submitted before a reword, judged
      // after it. The row holds what its author read, and that is what the
      // model gets, so the request is still the pre-2D one.
      const motion = motionForDebate(MOTION, REWORDED_TO);
      created.length = 0;
      await callJudgeModel(motion, school, ARGUMENT);
      expect(created).toHaveLength(1);
      compare(school, created[0]);
      const userTurn = userTurnOf(created[0]);
      expect(userTurn).toContain(MOTION);
      expect(userTurn).not.toContain(REWORDED_TO);
    });
  }

  it("would have sent the reworded motion without the selector", () => {
    // The counter-case, so the three blocks above are known to be testing
    // something: reading the live motion the way the route used to is what
    // produces the wrong words.
    expect(REWORDED_TO).not.toBe(MOTION);
    expect(motionForDebate(null, REWORDED_TO)).toBe(REWORDED_TO);
  });
});

describe("the prompt version override", () => {
  // Added so the golden set can measure a draft prompt before it becomes
  // the default. The whole value of it depends on production being unable
  // to reach one, which is what the first two tests here are for.
  function systemOf(params: Record<string, unknown>): string {
    return String(params.system);
  }

  it("defaults to the production version, byte for byte", async () => {
    expect(PROMPT_VERSION).toBe("v2");
    for (const school of LIVE_IN_PRODUCTION) {
      created.length = 0;
      await callJudgeModel(MOTION, school, ARGUMENT, undefined, PROMPT_VERSION);
      expect(created).toHaveLength(1);
      // The same fixture the no-argument call is compared against above,
      // so passing the default explicitly and passing nothing are the
      // same request.
      compare(school, created[0]);
    }
  });

  it("has a defaulted fifth parameter, so a four-argument call is v2", () => {
    // Function.length counts parameters before the first default, so 4
    // here means promptVersion is defaulted and judgeDebate's
    // four-argument call cannot be passing one. tsc covers the other half:
    // judgeDebate's parameter object has no promptVersion key.
    expect(callJudgeModel.length).toBe(4);
  });

  it("is not reachable through judgeDebate, for an original or a revision", async () => {
    // Both paths, because /api/judge passes revisionOf and the earlier
    // version of this test only covered originals: dropping
    // params.revisionOf from the forwarded call would have left every
    // assertion green while production revisions silently lost their
    // <original_argument> and <objection> block. That is a changed live
    // verdict, which is the one thing this phase cannot do.
    for (const school of LIVE_IN_PRODUCTION) {
      created.length = 0;
      await judgeDebate({
        motion: MOTION,
        school,
        argument: ARGUMENT,
        userId: "fixture-user",
        debateId: "fixture-debate",
      });
      expect(created).toHaveLength(1);
      compare(school, created[0]);

      created.length = 0;
      await judgeDebate({
        motion: MOTION,
        school,
        argument: ARGUMENT,
        userId: "fixture-user",
        debateId: "fixture-debate",
        revisionOf: REVISION,
      });
      expect(created).toHaveLength(1);
      compare(`${school}.revision`, created[0]);
    }
  });

  it("would fail that comparison for a non-default version", async () => {
    // Without this, the green above could mean the fixtures match
    // everything. It has to be possible for them not to match.
    created.length = 0;
    await callJudgeModel(MOTION, "stoicism", ARGUMENT, undefined, "v3");
    const v3 = created[0];
    const fixture = JSON.parse(
      fs.readFileSync(path.join(DIR, "stoicism.json"), "utf-8")
    ) as Record<string, unknown>;
    expect(v3.system).not.toBe(fixture.system);
  });

  it("sends a different prompt for v3, with the rival schools substituted", async () => {
    created.length = 0;
    await callJudgeModel(MOTION, "stoicism", ARGUMENT);
    const v2System = systemOf(created[0]);

    created.length = 0;
    await callJudgeModel(MOTION, "stoicism", ARGUMENT, undefined, "v3");
    expect(created).toHaveLength(1);
    const v3System = systemOf(created[0]);

    expect(v3System).not.toBe(v2System);
    // No placeholder survives into the request, in either direction: v3's
    // is filled, and v2 never had one to leave behind.
    expect(v3System).not.toContain("{{RIVAL_SCHOOLS}}");
    expect(v3System).not.toContain("{{RUBRIC}}");
    expect(v2System).not.toContain("{{RIVAL_SCHOOLS}}");

    // The list the model is offered is the list zod will accept.
    for (const id of PUBLISHED_SCHOOL_IDS) expect(v3System).toContain(`- \`${id}\``);
  });

  it("refuses to carry a school's criteria into another school's prompt", async () => {
    const systems: string[] = [];
    for (const school of LIVE_IN_PRODUCTION) {
      created.length = 0;
      await callJudgeModel(MOTION, school, ARGUMENT, undefined, "v3");
      systems.push(systemOf(created[0]));
    }
    expect(new Set(systems).size).toBe(LIVE_IN_PRODUCTION.length);
  });
});

describe("every judge prompt file", () => {
  // The invariant `fillPlaceholders` enforces at call time, checked here at the
  // file level so it fails on the prompt rather than on a run.
  //
  // This is the test that would have caught judge.v3.md naming both of its
  // placeholders in its own header comment: the comment is sent to the
  // model with the rest of the file, and filling a placeholder by name
  // filled the mention instead of the placeholder.
  const dir = path.join(process.cwd(), "content", "prompts");
  const versions = fs
    .readdirSync(dir)
    .filter((f) => /^judge\.v\d+\.md$/.test(f))
    .sort();

  it("exists", () => {
    expect(versions.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of versions) {
    it(`${file} names each placeholder at most once`, () => {
      const text = fs.readFileSync(path.join(dir, file), "utf-8");
      const placeholders = [...text.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
      const counts = new Map<string, number>();
      for (const name of placeholders) counts.set(name, (counts.get(name) ?? 0) + 1);
      expect(Object.fromEntries(counts)).toEqual(
        Object.fromEntries([...counts.keys()].map((k) => [k, 1]))
      );
      // And the rubric is in every version, since fillPlaceholders requires it.
      expect(counts.get("{{RUBRIC}}")).toBe(1);
    });
  }
});
