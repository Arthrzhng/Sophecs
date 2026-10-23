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

const { callJudgeModel } = await import("../src/lib/anthropic");
const { motionForDebate } = await import("../src/lib/motion-text");

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
  // `motionForDebate(stored, topic.motion)`. These compose the selector
  // with the capture above, so the claim "a new debate is judged exactly
  // as before" is checked rather than argued.
  for (const school of LIVE_IN_PRODUCTION) {
    it(`leaves a new debate's request byte-identical for ${school}`, async () => {
      // A new row has nothing stored yet, so the selector returns the live
      // motion and the request is the one the fixture already holds.
      const motion = motionForDebate(undefined, MOTION);
      expect(motion).toBe(MOTION);

      created.length = 0;
      await callJudgeModel(motion, school, ARGUMENT);
      expect(created).toHaveLength(1);
      compare(school, created[0]);
    });
  }

  it("judges a pending debate against the wording it was submitted under", async () => {
    // The sharper half of the problem: an argument submitted before a
    // reword and judged after it. The row holds what its author read, and
    // that is what the model has to be given.
    const submittedUnder = MOTION;
    const rewordedTo =
      "An AI system that reliably reduces suffering should be deployed even where the people it decides about cannot be told why.";
    expect(rewordedTo).not.toBe(submittedUnder);

    const motion = motionForDebate(submittedUnder, rewordedTo);
    created.length = 0;
    await callJudgeModel(motion, "stoicism", ARGUMENT);

    const userTurn = String(
      (created[0].messages as { content: string }[])[0].content
    );
    expect(userTurn).toContain(submittedUnder);
    expect(userTurn).not.toContain(rewordedTo);
    // And byte-identical to the fixture for that school, because the
    // fixture was captured under the same wording.
    compare("stoicism", created[0]);
  });
});
