import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolId } from "@/lib/types";

/**
 * "Exemplar ways to argue this motion" (Arthur, 2026-11-06): sample
 * arguments on a motion, shown on /debate/<slug>/exemplars under that
 * heading, which is what tells a reader what they are (docs/decisions.md,
 * "Exemplar ways to argue this motion").
 *
 * Sample accounts' arguments only (docs/sample-activity.md), never a real
 * reader's: a reader's argument is theirs, and is public only if they
 * publish it. The query filters on `is_sample`, and the selection below
 * refuses any row that is not one. Of those, only the ones their sample
 * author published (`argument_public`), as a sample's own verdict page
 * shows only those.
 *
 * One per opening line in each school: the sample run writes four positions
 * per school on a motion, so one argument under each is shown (the
 * strongest, unless its ending is taken; see selectExemplars) and the page
 * never lists the same line to open twice in a school
 * (Arthur, 2026-11-06, accepting that in place of 50 that repeat). Highest template mark first, shared out evenly
 * across the schools up to EXEMPLARS_PER_MOTION, which today's data never
 * reaches. Nothing marked under EXEMPLAR_FLOOR is shown. No mark is
 * returned: the samples' marks were written from templates, not by the
 * judge.
 */

/** A ceiling, not a target: one per opening came to 12 a motion on 2026-11-06. */
export const EXEMPLARS_PER_MOTION = 50;

/**
 * Rows read per school, strongest first: every published row today (at
 * most 241 on any motion, 2026-11-06), so a rarely used opening is still
 * found. Each opening first appeared within a school's top 15 then; the
 * rest is margin. PostgREST returns no more than 1000 rows a request in
 * any case.
 */
export const EXEMPLAR_CANDIDATES_PER_SCHOOL = 1000;

/**
 * The lowest template mark an exemplar may have (Arthur, 2026-11-07, Gate 4
 * item 11: "an exemplar floor on the template mark, dropping a position
 * rather than showing a weak one"). The ruling sets a floor; 50 is the
 * implementer's choice, where the sample plan's middle band starts
 * (scripts/seed/verdicts.ts: 70-90, 50-69, 25-49). It is a floor on the
 * mark, not on the tier: under rule 1 every argument written to be weak is
 * under it, its axis bands keeping the mark to 48 at most (production,
 * 2026-11-07: all 707 published, marked 25 to 45), but rule 2 has no tier
 * clamp, and a weak one can occasionally be marked 50 or a little over. A position whose strongest
 * argument is under it is left out.
 */
export const EXEMPLAR_FLOOR = 50;

export interface Exemplar {
  id: string;
  school: SchoolId;
  argument: string;
  /** The line a reader opens it from: its first sentence after any frame. */
  opening: string;
}

export interface ExemplarCandidate {
  id: string;
  school: SchoolId;
  argument: string;
  is_sample: boolean;
  /** The template mark, read for the floor and never passed on. */
  score: number | null;
}

/**
 * The sentences the sample run puts in front of some arguments before the
 * position (scripts/seed/banks.ts, FRAMES): "Here is my answer." says
 * nothing a reader can choose by, and two arguments that differ only by one
 * open the same way. Skipped for the opening line, never cut from the text.
 */
export const SAMPLE_FRAMES = [
  "Here is my answer.",
  "My position is simple.",
  "I will start with where I stand.",
  "Short version first.",
  "This is how I see it.",
  "Let me say where I land.",
] as const;

/** An argument without a leading frame sentence, for its opening line. */
export function withoutFrame(argument: string): string {
  const text = argument.trim();
  for (const frame of SAMPLE_FRAMES) {
    if (text.startsWith(frame) && /^\s/.test(text.slice(frame.length))) return text.slice(frame.length).trim();
  }
  return text;
}

/**
 * The misspellings the sample run writes into about 8% of its arguments
 * (scripts/seed/generate.ts, TYPOS), so that no exemplar carries one. "its"
 * for "it's" is the one that cannot be told from a correct word.
 */
export const SAMPLE_TYPO = /\b(?:becuase|definately|thier|wich|arguement|realy|doesnt|seperate|responsable|wether|the the)\b/i;

const normalise = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The line an argument ends on: its last sentence. A sample argument ends
 * on its closing when it has one, and the sample run gives each school four
 * closings on a motion, so without this rule two of a school's exemplars
 * could end the same way (Arthur, 2026-11-08: "so exemplar pages never
 * show the same ending twice").
 */
export function endingOf(argument: string): string {
  const sentences = argument.trim().split(/(?<=[.!?])\s+/);
  return sentences[sentences.length - 1];
}

/**
 * From each school's candidates, strongest first, keep one under each
 * opening line (its first sentence after any frame), normally the first
 * (see below for when it is not), then choose up to
 * `total` between the schools: an even share each, the remainder to the
 * schools listed first, and any share a school cannot fill passed to the
 * others. Any argument with one of the sample run's deliberate misspellings
 * or marked under EXEMPLAR_FLOOR is left out, so an opening whose strongest
 * argument is under the floor is left out too.
 *
 * No two kept arguments, in any school, end on the same line (`endingOf`;
 * Arthur, 2026-11-08: "so exemplar pages never show the same ending
 * twice"), so none repeats another's text either. The first pass takes
 * schools in order and each school's candidates strongest first: where the
 * strongest under an opening ends as an argument already kept does (a
 * stronger one in its school, or any in a school listed before it), the
 * strongest under it whose ending is free takes its place. Where none
 * under an opening is left, a kept argument gives way to another under its
 * own opening whose ending is free, or can be freed the same way along a
 * chain of such moves, when that frees an ending the left-out opening can
 * take (an augmenting path, as in Kuhn's matching), so an opening is left out only when no choice of one
 * argument per opening could show it. Where every opening finds an ending
 * at once, nothing moves.
 */
export function selectExemplars(
  candidatesBySchool: ReadonlyMap<SchoolId, readonly ExemplarCandidate[]>,
  schools: readonly SchoolId[],
  total: number = EXEMPLARS_PER_MOTION
): Map<SchoolId, Exemplar[]> {
  /** One opening line in one school, and the arguments under it, strongest first. */
  interface Slot {
    school: SchoolId;
    options: { at: number; exemplar: Exemplar; ending: string }[];
    taken?: number;
  }
  const slots: Slot[] = [];
  for (const school of schools) {
    const bySchool = new Map<string, Slot>();
    (candidatesBySchool.get(school) ?? []).forEach((c, at) => {
      if (!c.is_sample || c.school !== school || !c.argument?.trim() || SAMPLE_TYPO.test(c.argument)) return;
      if (typeof c.score !== "number" || c.score < EXEMPLAR_FLOOR) return;
      const opening = openingOf(withoutFrame(c.argument));
      const key = normalise(opening);
      let slot = bySchool.get(key);
      if (!slot) bySchool.set(key, (slot = { school, options: [] }));
      slot.options.push({ at, ending: normalise(endingOf(c.argument)), exemplar: { id: c.id, school: c.school, argument: c.argument.trim(), opening } });
    });
    slots.push(...bySchool.values());
  }

  // First pass, as the candidates come: each opening takes its strongest
  // argument whose ending no argument kept before it has taken.
  const holder = new Map<string, Slot>();
  const order = slots
    .flatMap((slot) => slot.options.map((option, i) => ({ slot, i, school: schools.indexOf(slot.school), at: option.at })))
    .sort((a, b) => a.school - b.school || a.at - b.at);
  for (const { slot, i } of order) {
    const { ending } = slot.options[i];
    if (slot.taken !== undefined || holder.has(ending)) continue;
    slot.taken = i;
    holder.set(ending, slot);
  }

  // Then each opening left out tries to free an ending: an argument
  // holding one moves to the strongest other under its own opening whose
  // ending is free, or can itself be freed, along a chain if need be.
  const free = (slot: Slot, tried: Set<string>): boolean => {
    for (let i = 0; i < slot.options.length; i++) {
      const { ending } = slot.options[i];
      if (tried.has(ending)) continue;
      tried.add(ending);
      const current = holder.get(ending);
      if (current === slot) continue;
      if (current === undefined || free(current, tried)) {
        if (slot.taken !== undefined) holder.delete(slot.options[slot.taken].ending);
        slot.taken = i;
        holder.set(ending, slot);
        return true;
      }
    }
    return false;
  };
  for (const slot of slots) if (slot.taken === undefined) free(slot, new Set());

  const pools = new Map<SchoolId, Exemplar[]>(
    schools.map((school) => [
      school,
      slots
        .filter((slot) => slot.school === school && slot.taken !== undefined)
        .map((slot) => slot.options[slot.taken!])
        .sort((a, b) => a.at - b.at)
        .map((option) => option.exemplar),
    ])
  );

  const chosen = new Map<SchoolId, Exemplar[]>(schools.map((s) => [s, []]));
  let left = total;
  // Round by round, one from each school that still has one, so the shares
  // come out even and a school with too few leaves its places to the rest.
  for (let round = 0; left > 0; round++) {
    let took = false;
    for (const school of schools) {
      if (left === 0) break;
      const next = pools.get(school)![round];
      if (next) {
        chosen.get(school)!.push(next);
        left--;
        took = true;
      }
    }
    if (!took) break;
  }
  return chosen;
}

/**
 * The exemplars for a motion, read from production's sample rows. Only
 * rows argued on the motion as it reads now (`motion`, the topic's text),
 * so an argument written to an earlier wording is never shown under this
 * one, and only those marked at EXEMPLAR_FLOOR or above.
 */
export async function getExemplars(
  admin: SupabaseClient,
  topicSlug: string,
  motion: string,
  schools: readonly SchoolId[]
): Promise<Map<SchoolId, Exemplar[]>> {
  const reads = await Promise.all(
    schools.map((school) =>
      admin
        .from("debates")
        .select("id, school, argument, is_sample, score")
        .eq("topic_slug", topicSlug)
        .eq("motion_text", motion)
        .eq("school", school)
        .eq("is_sample", true)
        .eq("argument_public", true)
        .eq("kind", "original")
        .eq("rejected", false)
        .gte("score", EXEMPLAR_FLOOR)
        .not("verdict", "is", null)
        .not("argument", "is", null)
        .order("score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(EXEMPLAR_CANDIDATES_PER_SCHOOL)
    )
  );
  const bySchool = new Map<SchoolId, ExemplarCandidate[]>();
  schools.forEach((school, i) => {
    const { data, error } = reads[i];
    // A failed read is an error, not an empty school: the others would
    // quietly take its places. Thrown, so a cached page keeps serving
    // until a rebuild succeeds.
    if (error) {
      console.error(`[exemplars] ${topicSlug}/${school} could not be read:`, error.message);
      throw new Error(`exemplars: ${topicSlug}/${school} could not be read`);
    }
    bySchool.set(school, (data ?? []) as ExemplarCandidate[]);
  });
  return selectExemplars(bySchool, schools);
}

/** The opening of an argument, for the line a reader opens it from. */
export function openingOf(argument: string, max = 160): string {
  const text = argument.trim().replace(/\s+/g, " ");
  const sentence = /^.+?[.!?](?=\s|$)/.exec(text)?.[0];
  if (sentence && sentence.length <= max) return sentence;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 0) || max).trimEnd()}…`;
}
