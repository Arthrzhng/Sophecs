import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  SHARE_MOTION_MAX,
  motionForDebate,
  shortMotionForShare,
} from "../src/lib/motion-text";

// The wording the one real debate was argued against, and the wording its
// motion carries now. Both from production: this is the pair that made 2D
// necessary.
const ARGUED_AGAINST =
  "An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions.";
const REWORDED_TO =
  "An AI system that reliably reduces suffering should be deployed even where the people it decides about cannot be told why.";

describe("motionForDebate", () => {
  it("uses the stored wording when there is one", () => {
    expect(motionForDebate(ARGUED_AGAINST, REWORDED_TO)).toBe(ARGUED_AGAINST);
  });

  it("falls back to the live motion when the column is null", () => {
    expect(motionForDebate(null, REWORDED_TO)).toBe(REWORDED_TO);
  });

  it("falls back when the column was not selected at all", () => {
    expect(motionForDebate(undefined, REWORDED_TO)).toBe(REWORDED_TO);
  });

  it("does not treat an empty string as missing", () => {
    // Nothing writes one. If something ever does, this surfaces it as an
    // empty heading rather than hiding it behind the live motion.
    expect(motionForDebate("", REWORDED_TO)).toBe("");
  });

  it("is unaffected by the live motion changing again", () => {
    expect(motionForDebate(ARGUED_AGAINST, "a third wording entirely")).toBe(ARGUED_AGAINST);
  });
});

describe("shortMotionForShare", () => {
  it("leaves a motion that fits alone", () => {
    expect(shortMotionForShare("Short enough.")).toBe("Short enough.");
  });

  it("leaves one exactly at the limit alone", () => {
    const exact = "x".repeat(SHARE_MOTION_MAX);
    expect(shortMotionForShare(exact)).toBe(exact);
  });

  it("shortens a longer one to the limit, ellipsis included", () => {
    const long = "y".repeat(SHARE_MOTION_MAX + 20);
    const short = shortMotionForShare(long);
    expect(short.length).toBe(SHARE_MOTION_MAX);
    expect(short.endsWith("...")).toBe(true);
  });
});

describe("a reword after the fact", () => {
  // Arthur's test (c), in the form the pure functions can carry: with the
  // motion reworded under it, every string a verdict surface derives from
  // the motion still comes from the stored wording.
  const motion = motionForDebate(ARGUED_AGAINST, REWORDED_TO);

  it("leaves the verdict page heading as it was", () => {
    expect(motion).toBe(ARGUED_AGAINST);
    expect(motion).not.toBe(REWORDED_TO);
  });

  it("leaves the share text as it was", () => {
    expect(shortMotionForShare(motion)).toBe(shortMotionForShare(ARGUED_AGAINST));
  });

  it("would show a reword that lands inside the first 60 characters", () => {
    // The real pair above is indistinguishable in share text, because the
    // reword changed only the tail and the share line cuts at
    // SHARE_MOTION_MAX. That is a fact about those two sentences, not a
    // property of the code, so the share-text claim is also checked
    // against a pair that differs where the reader can see it.
    const before = "Deploying an unexplainable system is defensible when it reduces suffering.";
    const after = "Shipping an unexplainable system is defensible when it reduces suffering.";
    expect(shortMotionForShare(before)).not.toBe(shortMotionForShare(after));
    expect(shortMotionForShare(motionForDebate(before, after))).toBe(
      shortMotionForShare(before)
    );
  });

  it("leaves the OG image's motion as it was", () => {
    // The OG route derives its motion through the same call, so the same
    // value reaches the card.
    expect(motionForDebate(ARGUED_AGAINST, REWORDED_TO)).toBe(ARGUED_AGAINST);
  });

  it("still shows the live motion on a row that stored nothing", () => {
    expect(motionForDebate(null, REWORDED_TO)).toBe(REWORDED_TO);
    expect(shortMotionForShare(motionForDebate(null, REWORDED_TO))).toBe(
      shortMotionForShare(REWORDED_TO)
    );
  });
});

/**
 * Every surface that shows a particular debate reads the motion through
 * `motionForDebate`, and none of them reads the live motion directly.
 *
 * The pure function above can be right while a call site quietly goes back
 * to `topic.motion`, which is exactly the regression 2D exists to undo and
 * exactly what no unit test would notice. So this strips every
 * `motionForDebate(...)` call out of each file and fails if a bare
 * `topic.motion` is left behind.
 */
/**
 * Blanks out every `motionForDebate(...)` call, counting parentheses so an
 * inner call does not end the match early. A naive `[^)]*` stopped at the
 * `)` of `motionTextById.get(...)` and reported the outer `topic.motion`
 * as a raw read.
 */
function stripCalls(source: string): string {
  const needle = "motionForDebate(";
  let out = "";
  let i = 0;
  for (;;) {
    const at = source.indexOf(needle, i);
    if (at === -1) return out + source.slice(i);
    out += source.slice(i, at) + "MOTION";
    let depth = 0;
    let j = at + needle.length - 1;
    for (; j < source.length; j += 1) {
      if (source[j] === "(") depth += 1;
      else if (source[j] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    i = j + 1;
  }
}

const DEBATE_SCOPED = [
  "src/app/api/judge/route.ts",
  "src/app/debate/[slug]/page.tsx",
  "src/app/debate/[slug]/[debateId]/page.tsx",
  "src/app/debate/[slug]/[debateId]/opengraph-image.tsx",
  "src/app/debate/[slug]/[debateId]/revise/page.tsx",
  "src/app/counterpart/[id]/page.tsx",
];

describe("the readers that are about one debate", () => {
  it.each(DEBATE_SCOPED)("%s reads the stored motion", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
    expect(source, `${file} should import motionForDebate`).toContain("motionForDebate");

    const withoutCalls = stripCalls(
      source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    );

    expect(
      withoutCalls.includes("topic.motion"),
      `${file} still reads topic.motion outside motionForDebate(). A debate's own wording is what it was argued against.`
    ).toBe(false);
  });

  it("fills motion_text at submission", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/judge/route.ts"),
      "utf-8"
    );
    expect(route).toContain("motion_text: motionText");
    // And judges against that same value, not the live one.
    expect(route).toContain("motion: motionText,");
  });
});
