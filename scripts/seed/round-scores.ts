// How often sample verdict scores land on a multiple of 5, and the limit a
// run is held to.
//
// A score of 70, 75 or 80 is no less likely from the judge than 71, but a
// page of sample verdicts where one in four is a multiple of 5 reads as
// generated; the judge's own replies land there 16.3% of the time (418
// scored replies in tests/judge/golden-runs). Rule 2 of scripts/seed/verdicts.ts lands there
// about 12% of the time for the composite and 7-15% for each criterion.
//
// Counted over a run's rule-2 verdicts only. The rule-1 verdicts the run
// begun on 2026-11-05 wrote before the cutover stay as written (they
// regenerate exactly, which the spot checks confirm) and are reported but
// not held to the limit: 23.3% of their composites are multiples of 5, and
// they go at launch, with the run.

import type { Adapter } from "./adapter";
import type { Dataset } from "./generate";
import type { BaselineCheck } from "./baseline";
import { TEMPLATE_PROMPT_VERSION, TEMPLATE_PROMPT_VERSION_2 } from "./verdicts";

/** A run fails if more than this share of its rule-2 scores, of any one kind, is a multiple of 5. */
export const MAX_ROUND_SCORE_PCT = 20;

/**
 * Below this many rule-2 verdicts the share is reported but not judged, so
 * that chance alone does not refuse a run. At 1000, a share of 15.4%, the
 * highest rule 2 gives (rigor, on one seed of three), comes out over 20%
 * by chance about once in twenty-four thousand (the exact binomial). The
 * run begun on 2026-11-05 adds about ninety rule-2 verdicts a day; a fresh
 * run has thousands.
 */
export const MIN_ROUND_SCORE_SAMPLE = 1000;

export const SCORE_KINDS = ["score", "fidelity", "rigor", "engagement"] as const;
export type ScoreKind = (typeof SCORE_KINDS)[number];

export interface RoundShares {
  n: number;
  /** Per kind, the percentage that is a multiple of 5, to one decimal. */
  pct: Record<ScoreKind, number>;
}

type Scored = { rejected?: boolean; prompt_version?: string } & Partial<Record<ScoreKind, number | null>>;

export function roundShares(verdicts: readonly Scored[]): RoundShares {
  const scored = verdicts.filter((v) => !v.rejected && typeof v.score === "number");
  const pct = {} as Record<ScoreKind, number>;
  for (const k of SCORE_KINDS) {
    const values = scored.map((v) => v[k]).filter((x): x is number => typeof x === "number");
    pct[k] = values.length ? Math.round((1000 * values.filter((x) => x % 5 === 0).length) / values.length) / 10 : 0;
  }
  return { n: scored.length, pct };
}

const show = (s: RoundShares) => SCORE_KINDS.map((k) => `${k} ${s.pct[k]}%`).join(", ");

/** The check, over the rows in scope (a canary's cohorts, or the whole run). */
export function roundScoreCheck(
  ds: Pick<Dataset, "debates">,
  opts: { cohortLimit?: number; max?: number; min?: number } = {}
): BaselineCheck {
  const max = opts.max ?? MAX_ROUND_SCORE_PCT;
  const min = opts.min ?? MIN_ROUND_SCORE_SAMPLE;
  const limit = opts.cohortLimit ?? Infinity;
  const verdicts = ds.debates.filter((d) => d.cohort < limit).map((d) => d.row.verdict as Scored);
  const two = roundShares(verdicts.filter((v) => v.prompt_version === TEMPLATE_PROMPT_VERSION_2));
  const one = roundShares(verdicts.filter((v) => v.prompt_version === TEMPLATE_PROMPT_VERSION));
  const over = SCORE_KINDS.filter((k) => two.pct[k] > max);
  const judged = two.n >= min;
  const ok = !judged || over.length === 0;
  const detail = [
    `rule 2: ${two.n} verdicts${two.n ? `, ${show(two)}` : ""}`,
    !judged ? `too few to judge (fewer than ${min})` : over.length ? `over ${max}%: ${over.join(", ")}` : null,
    one.n ? `rule 1, not judged: ${one.n} verdicts, ${show(one)}` : null,
  ]
    .filter(Boolean)
    .join("; ");
  return { name: `sample scores on a multiple of 5 at most ${max}%`, ok, detail };
}

/**
 * Every stored sample debate's score and prompt_version against the plan's.
 *
 * The spot checks read 50 rows a table, and so would miss a few rows that
 * differ: what a merge made after the rule-2 cutover, with old code
 * writing rule-1 scores past it, would leave behind. This reads them all
 * (three short columns), so a run whose stored scores and plan disagree is
 * refused before it writes and fails validation after. Rows the plan does
 * not hold in scope (another run's, a canary's later cohorts) are left to
 * the registry checks. The detail names no row: the schedule's log is
 * public.
 */
export async function storedScoreCheck(
  adapter: Pick<Adapter, "scan">,
  ds: Pick<Dataset, "debates">,
  opts: { cohortLimit?: number } = {}
): Promise<BaselineCheck> {
  const limit = opts.cohortLimit ?? Infinity;
  const planned = new Map(
    ds.debates.filter((d) => d.cohort < limit).map((d) => [d.rowId, { score: d.row.score, version: d.row.prompt_version }])
  );
  const stored = await adapter.scan("debates", ["id", "score", "prompt_version", "created_at"], { sample: true });
  let compared = 0;
  let differ = 0;
  let earliest = "";
  for (const r of stored) {
    const p = planned.get(String(r.id));
    if (!p) continue;
    compared++;
    const score = r.score === null || r.score === undefined ? null : Number(r.score);
    if (score !== (p.score === null ? null : Number(p.score)) || r.prompt_version !== p.version) {
      differ++;
      const at = new Date(String(r.created_at)).toISOString();
      if (!earliest || at < earliest) earliest = at;
    }
  }
  return {
    name: "stored sample scores match the plan",
    ok: differ === 0,
    detail: differ
      ? `${differ} of ${compared} stored sample debates differ from the plan in score or prompt_version, the earliest dated ${earliest}`
      : `${compared} stored sample debates compared`,
  };
}
