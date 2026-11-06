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
 * One per opening line in each school: the sample run writes only four to
 * eight different first sentences per school on a motion, so the strongest
 * argument under each is the one shown and the page never lists the same
 * line to open twice in a school (Arthur, 2026-11-06, accepting that in
 * place of 50 that repeat). Highest template mark first, shared out evenly
 * across the schools up to EXEMPLARS_PER_MOTION, which today's data never
 * reaches. No mark is returned: the samples' marks were written from
 * templates, not by the judge.
 */

/** A ceiling, not a target: one per opening came to 14 to 16 a motion on 2026-11-06. */
export const EXEMPLARS_PER_MOTION = 50;

/**
 * Rows read per school, strongest first. Every published row today (at
 * most 241 on any motion, 2026-11-06), so a rarely used opening is still
 * found: one first appears at rank 167. PostgREST returns no more than
 * 1000 rows a request in any case.
 */
export const EXEMPLAR_CANDIDATES_PER_SCHOOL = 1000;

export interface Exemplar {
  id: string;
  school: SchoolId;
  argument: string;
}

export interface ExemplarCandidate extends Exemplar {
  is_sample: boolean;
}

/**
 * The misspellings the sample run writes into about 8% of its arguments
 * (scripts/seed/generate.ts, TYPOS), so that no exemplar carries one. "its"
 * for "it's" is the one that cannot be told from a correct word.
 */
export const SAMPLE_TYPO = /\b(?:becuase|definately|thier|wich|arguement|realy|doesnt|seperate|responsable|wether|the the)\b/i;

const normalise = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * From each school's candidates, strongest first, keep the first under each
 * opening line, then choose up to `total` between the schools: an even
 * share each, the remainder to the schools listed first, and any share a
 * school cannot fill passed to the others. An exact repeat of a text
 * already kept, in any school, is dropped too, and so is any argument with
 * one of the sample run's deliberate misspellings.
 */
export function selectExemplars(
  candidatesBySchool: ReadonlyMap<SchoolId, readonly ExemplarCandidate[]>,
  schools: readonly SchoolId[],
  total: number = EXEMPLARS_PER_MOTION
): Map<SchoolId, Exemplar[]> {
  const seen = new Set<string>();
  const pools = new Map<SchoolId, Exemplar[]>();
  for (const school of schools) {
    const pool: Exemplar[] = [];
    const openings = new Set<string>();
    for (const c of candidatesBySchool.get(school) ?? []) {
      if (!c.is_sample || c.school !== school || !c.argument?.trim() || SAMPLE_TYPO.test(c.argument)) continue;
      const text = normalise(c.argument);
      const opening = normalise(openingOf(c.argument));
      if (seen.has(text) || openings.has(opening)) continue;
      seen.add(text);
      openings.add(opening);
      pool.push({ id: c.id, school: c.school, argument: c.argument.trim() });
    }
    pools.set(school, pool);
  }

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

/** The exemplars for a motion, read from production's sample rows. */
export async function getExemplars(
  admin: SupabaseClient,
  topicSlug: string,
  schools: readonly SchoolId[]
): Promise<Map<SchoolId, Exemplar[]>> {
  const reads = await Promise.all(
    schools.map((school) =>
      admin
        .from("debates")
        .select("id, school, argument, is_sample")
        .eq("topic_slug", topicSlug)
        .eq("school", school)
        .eq("is_sample", true)
        .eq("argument_public", true)
        .eq("kind", "original")
        .eq("rejected", false)
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
