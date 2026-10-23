import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { PUBLISHED_SCHOOL_IDS } from "../src/lib/school-registry";
import { DRAFT_SCHOOL_IDS } from "../src/lib/school-registry.drafts";
import { FIDELITY_CRITERIA, hasFidelityCriteria, judgeableSchools } from "../src/lib/judge/rubric";
import { PROMPT_VERSION } from "../src/lib/judge/schema";

const PROMPTS = path.join(process.cwd(), "content", "prompts");
const ROUTE = path.join(process.cwd(), "src", "app", "api", "judge", "route.ts");

function read(file: string): string {
  return fs.readFileSync(file, "utf-8");
}

/** v3's leading HTML comment explains itself and names v2's hardcoded list. */
function bodyOf(prompt: string): string {
  return prompt.replace(/^<!--[\s\S]*?-->\s*/, "");
}

describe("a school with no fidelity criteria", () => {
  it("can be asked about without reading the criteria", () => {
    for (const id of PUBLISHED_SCHOOL_IDS) expect(hasFidelityCriteria(id), id).toBe(true);
    for (const id of DRAFT_SCHOOL_IDS) expect(hasFidelityCriteria(id), id).toBe(false);
  });

  it("still throws if the criteria are read anyway", () => {
    // The question is safe; reading is not, and stays that way. Judging
    // against nothing is the thing worth failing over.
    for (const id of DRAFT_SCHOOL_IDS) {
      expect(() => FIDELITY_CRITERIA[id]).toThrowError(/no fidelity criteria/);
    }
  });

  it("agrees with judgeableSchools", () => {
    expect(judgeableSchools()).toEqual(PUBLISHED_SCHOOL_IDS.filter(hasFidelityCriteria));
  });
});

describe("/api/judge refusing it", () => {
  const route = read(ROUTE);

  it("has a pause reason for it rather than throwing", () => {
    expect(route).toContain('"no_criteria"');
    expect(route).toContain('return paused("no_criteria");');
  });

  it("refuses before the topic lookup, the daily cap and any insert", () => {
    const refusal = route.indexOf('return paused("no_criteria");');
    const topicLookup = route.indexOf('.from("debate_topics")');
    const dailyCap = route.indexOf('return paused("daily_cap");');
    const insert = route.indexOf('.from("debates").insert(');

    expect(refusal, "the refusal").toBeGreaterThan(-1);
    for (const [name, at] of [
      ["the topic lookup", topicLookup],
      ["the daily cap", dailyCap],
      ["the insert", insert],
    ] as const) {
      expect(at, name).toBeGreaterThan(-1);
      expect(
        refusal,
        `the refusal must come before ${name}: this is not the reader's doing and must not cost them a cap slot or leave a row`
      ).toBeLessThan(at);
    }
  });

  it("tells the reader the truth rather than to try again", () => {
    const editor = read(
      path.join(process.cwd(), "src", "components", "debate", "ArgumentEditor.tsx")
    );
    expect(editor).toContain("no_criteria:");
    // The generic fallback says to send it again once judging resumes,
    // which would be wrong here: nothing about waiting fixes it.
    const copy = /no_criteria:\s*\{[\s\S]*?\},/.exec(editor)?.[0] ?? "";
    expect(copy).toContain("criteria");
    expect(copy).not.toContain("once judging resumes");
  });

  it("is a reason analytics can carry", () => {
    const events = read(path.join(process.cwd(), "src", "lib", "analytics", "events.ts"));
    expect(events).toContain('"no_criteria"');
  });
});

describe("judge.v3.md", () => {
  const v2 = read(path.join(PROMPTS, "judge.v2.md"));
  const v3 = read(path.join(PROMPTS, "judge.v3.md"));
  const v3body = bodyOf(v3);

  it("is not the production default", () => {
    // Arthur's rule for this phase. Switching it also needs criteria for
    // whatever is being published and a second substitution in the frozen
    // anthropic.ts, so this is a deliberate step and not a side effect.
    expect(PROMPT_VERSION).toBe("v2");
    expect(read(path.join(process.cwd(), "src", "lib", "anthropic.ts"))).not.toContain(
      "RIVAL_SCHOOLS"
    );
  });

  it("still interpolates the fidelity criteria the same way", () => {
    expect(v3body).toContain("{{RUBRIC}}");
    expect((v3body.match(/\{\{RUBRIC\}\}/g) ?? []).length).toBe(1);
  });

  it("takes the rival schools from the registry instead of its prose", () => {
    expect(v3body).toContain("{{RIVAL_SCHOOLS}}");

    // Nowhere in the body, the JSON shape example included. v2 named a
    // school there to show the shape; v3 uses a quoted placeholder, which
    // is still valid JSON and names nobody.
    for (const id of [...PUBLISHED_SCHOOL_IDS, ...DRAFT_SCHOOL_IDS]) {
      expect(v3body, `v3 should not name ${id} anywhere`).not.toContain(id);
    }
  });

  it("keeps the shape example valid JSON, with a placeholder and a warning", () => {
    const example = v3body.slice(v3body.indexOf("## Response format"));
    const fence = /```json\n([\s\S]*?)```/.exec(example);
    expect(fence, "the JSON fence").not.toBeNull();
    expect(() => JSON.parse(fence![1])).not.toThrow();
    expect(JSON.parse(fence![1]).unanswered_objection.school).toBe("RIVAL_SCHOOL");
    // And the model is told not to return the placeholder, since it would
    // fail the zod enum and leave the debate unjudged.
    expect(example).toContain("Do not return the word");
  });

  it("names the placeholder for what the field holds, not what it must not", () => {
    // The brief suggested ASSIGNED_SCHOOL. That field must never hold the
    // assigned school, so naming it that would contradict the rule stated
    // a few lines above it.
    expect(v3body).not.toContain("ASSIGNED_SCHOOL");
    expect(v3body).toContain("RIVAL_SCHOOL");
  });

  it("no longer counts the schools", () => {
    // v2 says the objection comes from "one of the two schools the argument
    // was not assigned", which is true of three schools and nothing else.
    expect(v2).toContain("one of the two schools");
    expect(v3body).not.toContain("one of the two schools");
  });

  it("changes nothing else about how an argument is marked", () => {
    // The criteria and their order, the rejection rule, the caps, the
    // revision rules and the response shape are v2's, word for word.
    for (const anchor of [
      "1. **Fidelity**",
      "2. **Rigor**",
      "3. **Engagement**",
      "set `rejected: true` with a short `rejection_reason`",
      "`verdict_line` — at most 20 words",
      "set `objection_answered` to true only if",
      "Respond with JSON only.",
    ]) {
      expect(v2, `v2 anchor: ${anchor}`).toContain(anchor);
      expect(v3body, `v3 should keep: ${anchor}`).toContain(anchor);
    }
  });

  it("says in the file why it exists and that it is a draft", () => {
    const header = v3.slice(0, v3.indexOf("-->"));
    expect(header).toContain("not the production default");
    expect(header).toContain("RIVAL_SCHOOLS");
  });
});

describe("the draft fidelity criteria", () => {
  const DRAFT = path.join(PROMPTS, "fidelity-criteria.draft.md");

  it("exists and says it is a draft the judge does not read", () => {
    const draft = read(DRAFT);
    expect(draft).toContain("NOT LOADED BY ANYTHING");
    expect(draft).toContain("Pending approval");
  });

  it("is loaded by nothing", () => {
    for (const file of ["src/lib/judge/rubric.ts", "src/lib/anthropic.ts", "src/lib/judge/schema.ts"]) {
      expect(read(path.join(process.cwd(), file)), file).not.toContain("fidelity-criteria.draft");
    }
    // And the three schools it covers still cannot be judged.
    for (const id of DRAFT_SCHOOL_IDS) expect(hasFidelityCriteria(id), id).toBe(false);
  });

  it("covers the three schools that have no criteria", () => {
    const draft = read(DRAFT);
    for (const id of DRAFT_SCHOOL_IDS) expect(draft).toContain(`## \`${id}\``);
  });

  it("matches the shape of the three that are live", () => {
    const draft = read(DRAFT);
    const sections = [...draft.matchAll(/## `[a-z-]+` \([^)]*\)\n\n([\s\S]*?)(?=\n\n## |$)/g)];
    expect(sections.length).toBe(DRAFT_SCHOOL_IDS.length);
    for (const [, text] of sections) {
      const body = text.trim();
      // Two paragraphs: the commitments, then the fidelity failures.
      expect(body.split("\n\n").length).toBe(2);
      expect(body).toMatch(/^A faithful /);
      expect(body).toContain("Score fidelity down when the argument:");
      // The band the three live ones occupy.
      expect(body.length).toBeGreaterThanOrEqual(730);
      expect(body.length).toBeLessThanOrEqual(893);
      const words = body.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(114);
      expect(words).toBeLessThanOrEqual(142);
    }
  });
});
