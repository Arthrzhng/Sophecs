// How often each free-text verdict field quotes the argument it judges,
// across the golden runs. The measurement behind migration 0018 and the
// "the judge quotes arguments" entry in docs/decisions.md.
//
// Usage: node scripts/measure-verdict-quoting.mjs [extra run file]...
// Reads every run file in tests/judge/golden-runs/, plus any named on the
// command line, and the fixtures in tests/judge/golden/.
//
// Two crude counts per field, both upper bounds on real quotation:
// - "quote marks": the text has a quoted span of four or more characters.
//   This also counts the judge quoting a school's own terms.
// - "4-word run": the text shares four consecutive words with the
//   argument. This also counts stock phrases ("a good person would").
// The examples printed under each field are what to read: they show
// whether the field can carry the student's own words, which is the
// question 0018 answers.
import fs from "node:fs";
import path from "node:path";

const RUNS = "tests/judge/golden-runs";
const FIXTURES = "tests/judge/golden";
const FIELDS = [
  "verdict_line",
  "strongest_move",
  "weakest_move",
  "a_stronger_version_would",
  "unanswered_objection.claim",
  "unanswered_objection.why_it_stands",
];

const words = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const grams = (w, n) => {
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
};

const argumentWords = {};
for (const f of fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json"))) {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8"));
  argumentWords[fixture.name] = words(fixture.argument);
}

const files = fs
  .readdirSync(RUNS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.join(RUNS, f))
  .concat(process.argv.slice(2));

const stat = Object.fromEntries(FIELDS.map((k) => [k, { n: 0, quoteMarks: 0, run4: 0, examples: [] }]));
for (const file of files) {
  const run = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const rec of run.records ?? []) {
    const v = rec.response;
    if (!v || v.rejected) continue;
    const argGrams = grams(argumentWords[rec.fixture] ?? [], 4);
    for (const k of FIELDS) {
      const text = k.includes(".") ? v.unanswered_objection?.[k.split(".")[1]] : v[k];
      if (!text) continue;
      const s = stat[k];
      s.n++;
      if (/["“”‘’'][^"“”]{4,}["“”’']/.test(text)) s.quoteMarks++;
      const hit = [...grams(words(text), 4)].find((g) => argGrams.has(g));
      if (hit) {
        s.run4++;
        if (s.examples.length < 3) s.examples.push(`${rec.fixture}: ${text.slice(0, 160)}  [shared: ${hit}]`);
      }
    }
  }
}

console.log(`${files.length} run files`);
for (const k of FIELDS) {
  const s = stat[k];
  console.log(`${k.padEnd(36)} samples ${s.n} | quote marks ${s.quoteMarks} | 4-word run ${s.run4}`);
  for (const e of s.examples) console.log(`      ${e}`);
}
