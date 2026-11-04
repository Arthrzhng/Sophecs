// What the generated rows must satisfy: the app's own rules, causal order,
// and the isolation the design rests on. Every check runs over every row of
// a small dataset, not a sample.
import { describe, expect, it } from "vitest";
import { authorForSeq, checkBody, checkQuote, LAPSE_DAYS, MAX_SEQ, quoteSourceForSeq } from "../../src/lib/counterpart";
import { wordCount } from "../../scripts/seed/banks";
import { small, SMALL } from "./fixture";

const ds = small();
const t = (s: string) => Date.parse(s);
const from = t(SMALL.from);
const to = t(SMALL.to);
const DAY = 86_400_000;
const debates = ds.debates.map((d) => d.row);
const byId = new Map(debates.map((d) => [d.id, d]));
const profiles = new Map(ds.profiles.map((p) => [p.row.id, p.row]));
const results = new Map(ds.quizResults.map((q) => [q.row.id, q.row]));

describe("every row is marked and nothing is matched", () => {
  it("marks every marked row", () => {
    for (const rows of [ds.profiles, ds.quizResults, ds.challenges, ds.debates, ds.exchanges])
      for (const r of rows) expect((r.row as { is_sample: boolean }).is_sample).toBe(true);
    for (const d of debates) expect(d.verdict_is_template).toBe(true);
  });
  it("never puts a sample argument up for counterpart matching", () => {
    for (const d of debates) expect(d.seeking_counterpart_at).toBeNull();
  });
  it("uses addresses that can never receive mail", () => {
    for (const u of ds.authUsers) expect(u.row.email.endsWith("@sophecs.test")).toBe(true);
  });
});

describe("time", () => {
  it("keeps everything inside the window", () => {
    for (const d of debates) {
      expect(t(d.created_at)).toBeGreaterThanOrEqual(from);
      expect(t(d.created_at)).toBeLessThanOrEqual(to);
    }
    for (const q of ds.quizResults) expect(t(q.row.created_at)).toBeLessThanOrEqual(to);
    for (const x of ds.turns) expect(t(x.row.created_at)).toBeLessThanOrEqual(to);
  });
  it("has each account take the quiz before signing up, and argue after", () => {
    for (const p of ds.profiles) {
      const first = ds.quizResults.find((q) => q.row.user_id === p.row.id && q.logicalId.endsWith(":0"))!;
      expect(t(first.row.created_at)).toBeLessThan(t(p.row.created_at));
    }
    for (const d of debates) expect(t(d.created_at)).toBeGreaterThan(t(profiles.get(d.user_id)!.created_at));
  });
});

describe("the app's rules", () => {
  it("80 to 250 words per argument", () => {
    for (const d of debates) {
      expect(wordCount(d.argument)).toBeGreaterThanOrEqual(80);
      expect(wordCount(d.argument)).toBeLessThanOrEqual(250);
    }
  });
  it("one original per motion per user per seven days, as /api/judge locks it", () => {
    const seen = new Map<string, number[]>();
    for (const d of debates.filter((x) => x.kind === "original")) {
      const k = `${d.user_id}|${d.topic_slug}`;
      for (const prev of seen.get(k) ?? []) expect(Math.abs(t(d.created_at) - prev)).toBeGreaterThanOrEqual(7 * DAY);
      seen.set(k, [...(seen.get(k) ?? []), t(d.created_at)]);
    }
  });
  it("at most five originals in any 24 hours per user", () => {
    const per = new Map<string, number[]>();
    for (const d of debates.filter((x) => x.kind === "original")) per.set(d.user_id, [...(per.get(d.user_id) ?? []), t(d.created_at)]);
    for (const times of per.values()) {
      times.sort((a, b) => a - b);
      for (let i = 5; i < times.length; i++) expect(times[i] - times[i - 5]).toBeGreaterThan(DAY);
    }
  });
  it("revisions: after a judged original of the same user, one per original, not rejected", () => {
    const parents = new Set<string>();
    for (const r of debates.filter((d) => d.kind === "revision")) {
      const p = byId.get(r.parent_debate_id!)!;
      expect(p.kind).toBe("original");
      expect(p.rejected).toBe(false);
      expect(p.user_id).toBe(r.user_id);
      expect(p.topic_slug).toBe(r.topic_slug);
      expect(t(r.created_at)).toBeGreaterThan(t(p.created_at));
      expect(parents.has(p.id)).toBe(false);
      parents.add(p.id);
      expect(r.challenge_id).toBeNull();
      expect(r.elo_before).toBe(r.elo_after);
    }
  });
  it("rejected arguments carry no score or rating, others a score in 25 to 90", () => {
    for (const d of debates) {
      if (d.rejected) expect([d.score, d.elo_before, d.elo_after]).toEqual([null, null, null]);
      else {
        expect(d.score).toBeGreaterThanOrEqual(25);
        expect(d.score).toBeLessThanOrEqual(90);
      }
    }
  });
  it("argues each debate from the school the account held at the time", () => {
    for (const p of ds.profiles) {
      const h = p.row.school_history;
      const first = ds.quizResults.find((q) => q.row.user_id === p.row.id && q.logicalId.endsWith(":0"))!.row.school;
      expect(p.row.school).toBe(h.length ? h[h.length - 1].to : first);
      for (let i = 1; i < h.length; i++) expect(h[i].from).toBe(h[i - 1].to);
      for (const d of debates.filter((x) => x.user_id === p.row.id && x.kind === "original")) {
        let school = first;
        for (const e of h) if (t(e.at) <= t(d.created_at)) school = e.to;
        expect(d.school).toBe(school);
      }
    }
  });
});

describe("challenges", () => {
  it("are made after the challenger's result and answered after", () => {
    for (const c of ds.challenges.map((x) => x.row)) {
      expect(t(c.created_at)).toBeGreaterThan(t(results.get(c.challenger_result_id)!.created_at));
      if (c.challengee_result_id) {
        const e = results.get(c.challengee_result_id)!;
        expect(e.challenge_from).toBe(c.challenger_result_id);
        expect(t(e.created_at)).toBeGreaterThan(t(c.created_at));
      }
    }
  });
  it("complete ones have both sides' arguments, after the challenge was taken up", () => {
    for (const l of ds.challengeLinks) {
      const c = ds.challenges.find((x) => x.rowId === l.rowId)!.row;
      expect(c.status).toBe("complete");
      const a = byId.get(l.row.challenger_debate_id)!;
      const b = byId.get(l.row.challengee_debate_id)!;
      expect(a.challenge_id).toBe(c.id);
      expect(b.challenge_id).toBe(c.id);
      expect(a.topic_slug).toBe(c.topic_slug);
      expect(a.user_id).toBe(results.get(c.challenger_result_id)!.user_id);
      expect(b.user_id).toBe(results.get(c.challengee_result_id!)!.user_id);
      const accepted = t(results.get(c.challengee_result_id!)!.created_at);
      expect(t(a.created_at)).toBeGreaterThan(accepted);
      expect(t(b.created_at)).toBeGreaterThan(accepted);
    }
  });
});

describe("counterpart exchanges", () => {
  it("pair two schools on one motion, after both arguments", () => {
    for (const e of ds.exchanges.map((x) => x.row)) {
      const a = byId.get(e.debate_a)!;
      const b = byId.get(e.debate_b)!;
      expect(a.topic_slug).toBe(e.topic_slug);
      expect(b.topic_slug).toBe(e.topic_slug);
      expect(a.school).not.toBe(b.school);
      expect(a.user_id).not.toBe(b.user_id);
      expect(t(e.created_at)).toBeGreaterThan(Math.max(t(a.created_at), t(b.created_at)));
    }
  });
  it("take turns in the order the turn route enforces, quoting what the route checks", () => {
    for (const e of ds.exchanges.map((x) => x.row)) {
      const turns = ds.turns.map((x) => x.row).filter((x) => x.exchange_id === e.id).sort((x, y) => x.seq - y.seq);
      expect(turns.length).toBeGreaterThan(0);
      turns.forEach((turn, i) => {
        expect(turn.seq).toBe(i + 1);
        expect(turn.author_id).toBe(authorForSeq(turn.seq, e.user_a, e.user_b));
        const source =
          quoteSourceForSeq(turn.seq) === "argument"
            ? byId.get(turn.author_id === e.user_a ? e.debate_b : e.debate_a)!.argument
            : turns[i - 1].body;
        expect(checkQuote(turn.quoted_claim, source)).toBeNull();
        expect(checkBody(turn.body)).toBeNull();
        if (i > 0) expect(t(turn.created_at)).toBeGreaterThan(t(turns[i - 1].created_at));
      });
      const last = t(turns[turns.length - 1].created_at);
      expect(e.last_turn_at).toBe(turns[turns.length - 1].created_at);
      if (e.status === "complete") expect([turns.length, e.next_turn]).toEqual([MAX_SEQ, null]);
      if (e.status === "lapsed") {
        expect(e.next_turn).toBeNull();
        expect(to - last).toBeGreaterThan(LAPSE_DAYS * DAY);
      }
      if (e.status === "open") {
        expect(to - last).toBeLessThanOrEqual(LAPSE_DAYS * DAY);
        expect(e.next_turn).toBe(authorForSeq(turns.length + 1, e.user_a, e.user_b));
      }
    }
  });
});

describe("reading and classes", () => {
  it("answers both prompts before the first argument on the motion, once", () => {
    const seen = new Set<string>();
    for (const r of ds.readingResponses.map((x) => x.row)) {
      const k = `${r.user_id}|${r.topic_slug}|${r.chunk_index}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(r.response.length).toBeGreaterThanOrEqual(1);
      expect(r.response.length).toBeLessThanOrEqual(300);
      const first = debates.filter((d) => d.user_id === r.user_id && d.topic_slug === r.topic_slug).map((d) => t(d.created_at));
      if (first.length) expect(t(r.created_at)).toBeLessThan(Math.min(...first));
      expect(t(r.created_at)).toBeGreaterThan(t(profiles.get(r.user_id)!.created_at));
    }
  });
  it("joins classes after they exist and after signing up; owners are not members", () => {
    for (const m of ds.classMembers.map((x) => x.row)) {
      const c = ds.classes.find((k) => k.rowId === m.class_id)!.row;
      expect(t(m.joined_at)).toBeGreaterThanOrEqual(t(c.created_at));
      expect(t(m.joined_at)).toBeGreaterThan(t(profiles.get(m.user_id)!.created_at));
      expect(m.user_id).not.toBe(c.owner_id);
      expect(c.name.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("cohorts, for the canary", () => {
  it("never let a row in a cohort depend on a row in a later one", () => {
    const cohort = new Map<string, number>();
    for (const list of [ds.authUsers, ds.quizResults, ds.challenges, ds.debates, ds.exchanges, ds.classes])
      for (const i of list) cohort.set(i.rowId, i.cohort);
    for (const q of ds.quizResults) if (q.row.challenge_from) expect(cohort.get(q.row.challenge_from)!).toBeLessThanOrEqual(q.cohort);
    for (const d of ds.debates) {
      expect(cohort.get(d.row.user_id)!).toBeLessThanOrEqual(d.cohort);
      if (d.row.challenge_id) expect(cohort.get(d.row.challenge_id)!).toBeLessThanOrEqual(d.cohort);
      if (d.row.parent_debate_id) expect(cohort.get(d.row.parent_debate_id)!).toBeLessThanOrEqual(d.cohort);
    }
    for (const e of ds.exchanges) for (const x of [e.row.debate_a, e.row.debate_b]) expect(cohort.get(x)!).toBeLessThanOrEqual(e.cohort);
    for (const c of ds.challenges) expect(cohort.get(c.row.challenger_result_id)!).toBeLessThanOrEqual(c.cohort);
    for (const m of ds.classMembers) expect(cohort.get(m.row.class_id)!).toBeLessThanOrEqual(m.cohort);
  });
});
