# Golden run results

One JSON file per `npm run judge:golden`, written here instead of to
`ai_calls`. Committed on purpose: a run is the evidence for a claim about
the judge, and a claim whose evidence was thrown away is not worth much.

Each file holds the run's prompt version and the hash of the prompt file
it used, the model, the samples per case, the call count and the total
cost, then one record per call: the fixture, the sample number, the
attempt (1, then 2 and 3 for the retries a reply that fails validation
gets: one retry in runs from 2026-11-03 until Arthur's ruling that evening,
two after it; files written before the retry existed, the v3 run of 16:47
on 3 Nov among them, have no attempt and are all first calls), where its fidelity criteria came from
(`live` for `src/lib/judge/rubric.ts`, `draft` for the draft criteria file,
which a golden run reads and, since Gate 3, a SIX_SCHOOLS build), a request
fingerprint (which, on a SIX_SCHOOLS run, also covers the flag), the
response, all
four axes (score, fidelity, rigor, engagement), the objection school, the
cost, the latency and any error.

A run starts by printing its planned call count and estimated cost.
`GOLDEN_DRY_RUN=1` prints the same and stops, writing nothing here.

`docs/phase2-fixtures.md` explains what the fingerprint covers and why it
is of the inputs rather than of the literal request bytes.

Nothing in `src/` reads any of this, and production still logs every
judged call to `ai_calls`. `tests/golden-log.test.ts` is what holds both
of those true.
