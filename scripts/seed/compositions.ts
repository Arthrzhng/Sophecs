// Which passages each sample argument is made of. The banks
// (arguments/<topic>.<school>.json) show forty per motion and school; the
// generator draws on every composition the hand-written passages allow:
// for each motion, school and tier, every position, reason, example,
// objection, closing and opening sentence that the tier takes, kept when
// it lands between 80 and 250 words and is made of different passages.
//
// Each list is shuffled once per run (plain compositions before the ones
// with an opening sentence) and given out in order, so no composition is
// used twice until all of them have been, and a debate's
// composition depends only on how many arguments of its kind came before
// it in time: extending a run gives out the next ones and changes none
// already given (generate.ts). Exact duplicates come only from a list
// running out, which the plan measures (exactDuplicateArgumentsPct).

import { candidates, fit, partsWords, FRAMES, MIN_WORDS, MAX_WORDS, type Banks, type Closings, type Parts, type SchoolId, type Tier, type TopicSlug } from "./banks";
import type { Rng } from "./rng";

// Built once per process for each set of passages: the key is the passages
// themselves, so an edited passage is never served from a stale list.
const cache = new Map<string, Parts[]>();

export function allCompositions(banks: Banks, topic: TopicSlug, school: SchoolId, tier: Tier): Parts[] {
  const fr = banks.fragments[topic];
  const key = JSON.stringify([tier, school, fr.weak, fr.weak_direction, fr.schools[school], banks.closings[school]]);
  const hit = cache.get(key);
  if (hit) return hit;
  const built = build(banks, topic, school, tier);
  cache.set(key, built);
  return built;
}

function build(banks: Banks, topic: TopicSlug, school: SchoolId, tier: Tier): Parts[] {
  const fr = banks.fragments[topic];
  const seen = new Set<string>();
  const out: Parts[] = [];
  for (const base of candidates(fr, school, tier, banks.closings[school].length)) {
    for (const frame of [undefined, ...FRAMES.map((_, i) => i)]) {
      let parts: Parts = frame === undefined ? { ...base } : { ...base, frame };
      if (tier === "strong") parts = fit(fr, banks.closings, school, parts);
      const words = partsWords(fr, banks.closings, school, parts);
      // The same passages make the same text, so the parts are the key.
      const key = JSON.stringify(parts);
      if (words < MIN_WORDS || words > MAX_WORDS || seen.has(key)) continue;
      seen.add(key);
      out.push(parts);
    }
  }
  return out;
}

export class Compositions {
  private lists = new Map<string, Parts[]>();
  private given = new Map<string, number>();
  constructor(
    private banks: Banks,
    private rng: Rng,
    /** The closings of each motion, for a run that closes per motion; `banks.closings` otherwise. */
    private closingsOf?: (topic: TopicSlug) => Closings
  ) {}

  /** The next composition for this motion, school and tier, in the run's own order. */
  next(topic: TopicSlug, school: SchoolId, tier: Tier): Parts {
    const key = `${topic}.${school}.${tier}`;
    let list = this.lists.get(key);
    if (!list) {
      // Without an opening sentence first, then each opening in turn: an
      // argument and the same one with an opening added differ by one
      // sentence, so those wait until every plain composition is used.
      const all = allCompositions(this.closingsOf ? { ...this.banks, closings: this.closingsOf(topic) } : this.banks, topic, school, tier);
      const r = this.rng.fork(key);
      const rounds = [undefined, ...FRAMES.map((_, i) => i)].map((f) => r.shuffle(all.filter((p) => p.frame === f)));
      list = rounds.flat();
      if (!list.length) throw new Error(`no ${tier} composition of ${topic} for ${school} fits 80 to 250 words`);
      this.lists.set(key, list);
    }
    const n = this.given.get(key) ?? 0;
    this.given.set(key, n + 1);
    return list[n % list.length];
  }
}
