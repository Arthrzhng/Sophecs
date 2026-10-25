# Golden run results

One JSON file per `npm run judge:golden`, written here instead of to
`ai_calls`. Committed on purpose: a run is the evidence for a claim about
the judge, and a claim whose evidence was thrown away is not worth much.

Each file holds the run's prompt version and the hash of the prompt file
it used, the model, the samples per case, the call count and the total
cost, then one record per call: the fixture, the sample number, where its
fidelity criteria came from (`live` for `src/lib/judge/rubric.ts`, `draft`
for the draft criteria file that only a golden run reads), a request
fingerprint, the response, all four axes (score, fidelity, rigor,
engagement), the objection school, the cost, the latency and any error.

A run starts by printing its planned call count and estimated cost.
`GOLDEN_DRY_RUN=1` prints the same and stops, writing nothing here.

`docs/phase2-fixtures.md` explains what the fingerprint covers and why it
is of the inputs rather than of the literal request bytes.

Nothing in `src/` reads any of this, and production still logs every
judged call to `ai_calls`. `tests/golden-log.test.ts` is what holds both
of those true.
