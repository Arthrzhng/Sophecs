/**
 * The three things the judge scores, in the order it weights them.
 *
 * Verbatim from docs/daily-path-copy.md §6, which settles a long-running
 * confusion: mockups 04 and 06 leave room for four axes, and the verdict
 * table this replaces called itself "four axes" by counting the overall
 * score as one. content/prompts/judge.v2.md defines three criteria and one
 * composite score out of 100. Three rows; the composite is the big circle.
 *
 * The descriptions paraphrase the prompt. They do not change it, and
 * nothing here is read by the judge.
 */
export interface JudgeAxis {
  /** `school` is substituted into the fidelity label where the screen has one. */
  key: "fidelity" | "rigor" | "engagement";
  label: string;
  description: string;
}

export const JUDGE_AXES: JudgeAxis[] = [
  {
    key: "fidelity",
    label: "Fidelity to your school",
    description:
      "Does it reason the way your school reasons, from its own commitments? This counts most.",
  },
  {
    key: "rigor",
    label: "Rigor",
    description: "Clear claims, real support, no unearned leaps.",
  },
  {
    key: "engagement",
    label: "Engagement",
    description: "Does it meet the strongest objection a rival school would raise?",
  },
];

export const AXIS_MAX = 10;
