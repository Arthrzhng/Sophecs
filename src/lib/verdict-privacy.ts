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

// Each kept field must also have the type it is meant to have, so a value
// that is text where a number belongs is withheld too. Today the judge's
// replies are validated before they are stored, so this never bites; it
// keeps the list safe without leaning on that. 0018 checks the same.
const VERSION = /^v[0-9]+$/;
const SCHOOL_ID = /^[a-z-]+$/;
function keptValue(key: (typeof KEPT_FOR_EVERYONE)[number], value: unknown): boolean {
  if (key === "rejected" || key === "objection_answered") return typeof value === "boolean";
  if (key === "prompt_version") return typeof value === "string" && VERSION.test(value);
  return value === null || typeof value === "number";
}

export function withheldVerdict(verdict: unknown): VerdictData | null {
  if (verdict === null || typeof verdict !== "object" || Array.isArray(verdict)) return null;
  const v = verdict as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const key of KEPT_FOR_EVERYONE) if (key in v && keptValue(key, v[key])) kept[key] = v[key];
  // The objection keeps the school that raised it, and nothing it said.
  const objection = v.unanswered_objection;
  const school =
    objection && typeof objection === "object" && !Array.isArray(objection)
      ? (objection as { school?: unknown }).school
      : undefined;
  if (typeof school === "string" && SCHOOL_ID.test(school)) {
    kept.unanswered_objection = { school, claim: null, why_it_stands: null };
  }
  return kept as unknown as VerdictData;
}

/**
 * Which verdict the verdict page shows, and whether the judge's words are
 * withheld from it. The page's one privacy decision, kept here so it can
 * be tested case by case rather than read off the page's source.
 *
 * - The author, whose own row came back through row level security, sees
 *   their whole verdict.
 * - Anyone else sees the judge's words only if the argument is public and,
 *   for a revision, its original is public too: the revision judge is
 *   shown the original and may quote it (judge.v2.md asks its
 *   improvement_note to name what changed between the two).
 * - Otherwise the verdict is cut down to `withheldVerdict`.
 */
export function verdictForViewer(input: {
  isOwner: boolean;
  ownVerdict: unknown;
  publicVerdict: unknown;
  /**
   * debates_public's `argument`: the text when the author published it,
   * null when they did not. Read from the view, not from anything the page
   * derives, so nothing on the page can flip this decision by accident.
   */
  publicArgument: string | null;
  /** The original's privacy, for a revision; null for an original. */
  parentPublic: boolean | null;
}): { verdict: VerdictData | null; textWithheld: boolean } {
  if (input.isOwner) {
    return { verdict: (input.ownVerdict ?? input.publicVerdict) as VerdictData | null, textWithheld: false };
  }
  const argumentPublic = typeof input.publicArgument === "string" && input.publicArgument !== "";
  const textWithheld = !(argumentPublic && input.parentPublic !== false);
  return {
    verdict: textWithheld ? withheldVerdict(input.publicVerdict) : (input.publicVerdict as VerdictData | null),
    textWithheld,
  };
}
