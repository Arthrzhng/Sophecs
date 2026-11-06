import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolId } from "@/lib/types";

/**
 * "Exemplar ways to argue this motion" (Arthur, 2026-11-06): up to
 * EXEMPLARS_PER_MOTION of the strongest sample arguments on a motion, shown
 * on /debate/<slug>/exemplars under that heading, which is what tells a
 * reader what they are (docs/decisions.md, "Exemplar ways to argue this
 * motion").
 *
 * Sample accounts' arguments only (docs/sample-activity.md), never a real
 * reader's: a reader's argument is theirs, and is public only if they
 * publish it. The query filters on `is_sample`, and the selection below
 * refuses any row that is not one.
 *
 * Shared out evenly across the schools, strongest first within each, with
 * exact repeats of the same text dropped (the sample run allows a few).
 * No score is returned: the samples' marks were written from templates,
 * not by the judge.
 */

export const EXEMPLARS_PER_MOTION = 50;

export interface Exemplar {
  id: string;
  school: SchoolId;
  argument: string;
}

export interface ExemplarCandidate extends Exemplar {
  is_sample: boolean;
}

const normalise = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * From each school's candidates, strongest first, choose up to `total`
 * between them: an even share each, the remainder to the schools listed
 * first, and any share a school cannot fill passed to the others.
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
    for (const c of candidatesBySchool.get(school) ?? []) {
      if (!c.is_sample || c.school !== school || !c.argument?.trim()) continue;
      const key = normalise(c.argument);
      if (seen.has(key)) continue;
      seen.add(key);
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
        .eq("kind", "original")
        .eq("rejected", false)
        .not("verdict", "is", null)
        .not("argument", "is", null)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false })
        // Enough to fill every place even if this school must cover for
        // others and some texts repeat.
        .limit(EXEMPLARS_PER_MOTION * 2)
    )
  );
  const bySchool = new Map<SchoolId, ExemplarCandidate[]>();
  schools.forEach((school, i) => {
    const { data, error } = reads[i];
    bySchool.set(school, error ? [] : ((data ?? []) as ExemplarCandidate[]));
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
