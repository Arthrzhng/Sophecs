import type { VerdictData } from "@/components/debate/Verdict";

/**
 * The verdict on a private argument, as someone other than its author may
 * see it.
 *
 * The judge quotes the argument it scores, in any field it writes in its
 * own words (docs/decisions.md, "The judge quotes arguments"). So this
 * keeps a fixed list of fields that cannot carry the argument's words and
 * drops everything else: a field added to the verdict later is withheld
 * until someone decides otherwise, rather than shown until someone
 * notices. Migration 0018 makes debates_public apply the same list.
 *
 * It runs on the server, before the verdict reaches the Verdict component.
 * That component is a client component, so whatever it is given is
 * written into the page's payload, readable in its source, whether or not
 * it is rendered.
 */
export const KEPT_FOR_EVERYONE = [
  "rejected",
  "score",
  "fidelity",
  "rigor",
  "engagement",
  "objection_answered",
  "prompt_version",
] as const;

export function withheldVerdict(verdict: unknown): VerdictData | null {
  if (verdict === null || typeof verdict !== "object" || Array.isArray(verdict)) return null;
  const v = verdict as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const key of KEPT_FOR_EVERYONE) if (key in v) kept[key] = v[key];
  // The objection keeps the school that raised it, and nothing it said.
  const objection = v.unanswered_objection;
  if (objection && typeof objection === "object" && !Array.isArray(objection) && "school" in objection) {
    kept.unanswered_objection = {
      school: (objection as { school: unknown }).school,
      claim: null,
      why_it_stands: null,
    };
  }
  return kept as unknown as VerdictData;
}
