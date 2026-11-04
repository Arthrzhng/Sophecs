// Scores every possible answer pattern of the quiz v2 draft and reports
// where they land, for docs/quiz-v2.md. Exact, not sampled: ten questions
// of four options is 4^10 = 1,048,576 patterns, each equally likely for a
// reader answering at random.
//
// Usage: node scripts/simulate-quiz-v2.mjs [path to quiz-v2.json]
//
// The result logic it applies is the one docs/quiz-v2.md proposes:
// - a reader's position is the mean of their ten options' vectors;
// - each school sits on the unit circle at its angle;
// - the nearest school wins and the second nearest is the secondary;
// - an exact tie on distance (squared distances within 1e-9) goes to
//   whichever tied school is nearer the reader's answer to the last
//   question, then to the order the schools are listed in.
// Exits non-zero if any school is unreachable, lands outside 8% to 30%,
// or a school's persona (always the option leaning towards it) misses it,
// or if a school has no weight or an option's vector disagrees with its
// school's angle and weight.
import fs from "node:fs";

const file = process.argv[2] ?? "docs/quiz-v2.json";
const quiz = JSON.parse(fs.readFileSync(file, "utf8"));
const ids = Object.keys(quiz.schools);
const pos = Object.fromEntries(
  ids.map((id) => {
    const a = (quiz.schools[id].angle * Math.PI) / 180;
    return [id, { x: Math.cos(a), y: Math.sin(a) }];
  })
);
const Q = quiz.questions;
if (Q.length !== 10 || Q.some((q) => q.options.length !== 4)) throw new Error("expected 10 questions of 4 options");

const d2 = (p, s) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
const EPS = 1e-9;

function rank(p, last) {
  return [...ids].sort((a, b) => {
    const diff = d2(p, pos[a]) - d2(p, pos[b]);
    if (Math.abs(diff) > EPS) return diff;
    const tie = d2(last, pos[a]) - d2(last, pos[b]);
    if (Math.abs(tie) > EPS) return tie;
    return ids.indexOf(a) - ids.indexOf(b);
  });
}

// Each option's vector is its school's direction times that school's
// weight, rounded to two places. A hand edit that breaks this, a weight
// changed without the vectors or the other way round, fails here.
for (const q of Q) {
  for (const o of q.options) {
    const w = quiz.radius_by_school?.[o.leans];
    if (typeof w !== "number") throw new Error(`no weight for ${o.leans} in radius_by_school`);
    const want = { x: pos[o.leans].x * w, y: pos[o.leans].y * w };
    if (Math.abs(want.x - o.vector.x) > 0.006 || Math.abs(want.y - o.vector.y) > 0.006) {
      throw new Error(`option ${o.id}: vector is not ${o.leans}'s direction times ${w}`);
    }
  }
}

// Every option points at one school: the nearest one to its own vector.
const optionSchool = (o) => rank(o.vector, o.vector)[0];
const appears = Object.fromEntries(ids.map((id) => [id, 0]));
for (const q of Q) for (const o of q.options) appears[optionSchool(o)]++;

// All 4^10 patterns.
const primary = Object.fromEntries(ids.map((id) => [id, 0]));
const pair = {};
let ties = 0;
let total = 0;
const radii = [];
const pick = new Array(10).fill(0);
for (let n = 0; n < 4 ** 10; n++) {
  let k = n;
  let x = 0;
  let y = 0;
  for (let i = 0; i < 10; i++) {
    pick[i] = k & 3;
    k >>= 2;
    const v = Q[i].options[pick[i]].vector;
    x += v.x;
    y += v.y;
  }
  const p = { x: x / 10, y: y / 10 };
  const last = Q[9].options[pick[9]].vector;
  const r = rank(p, last);
  const d0 = d2(p, pos[r[0]]);
  const d1 = d2(p, pos[r[1]]);
  if (Math.abs(d0 - d1) <= EPS) ties++;
  primary[r[0]]++;
  const key = `${r[0]} > ${r[1]}`;
  pair[key] = (pair[key] ?? 0) + 1;
  radii.push(Math.hypot(p.x, p.y));
  total++;
}

// Personas: a reader who always takes the option nearest one school.
function persona(target) {
  const chosen = Q.map((q) => [...q.options].sort((a, b) => d2(a.vector, target) - d2(b.vector, target))[0]);
  const p = {
    x: chosen.reduce((s, o) => s + o.vector.x, 0) / 10,
    y: chosen.reduce((s, o) => s + o.vector.y, 0) / 10,
  };
  return { p, ranked: rank(p, chosen[9].vector) };
}

const pct = (n) => ((100 * n) / total).toFixed(1).padStart(5) + "%";
console.log(`${total.toLocaleString("en-GB")} answer patterns, every one equally likely under random answering\n`);
console.log("school            | options pointing at it | lands as primary");
let bad = false;
for (const id of ids) {
  const share = primary[id] / total;
  const flag = share < 0.08 || share > 0.3 ? "  OUTSIDE 8-30%" : "";
  if (flag || primary[id] === 0) bad = true;
  console.log(`${quiz.schools[id].name.padEnd(17)} | ${String(appears[id]).padStart(22)} | ${pct(primary[id])}${flag}`);
}
console.log(`\nexact ties on distance: ${ties}`);
radii.sort((a, b) => a - b);
const q = (f) => radii[Math.floor(f * (radii.length - 1))].toFixed(2);
console.log(`distance from the middle of the map: median ${q(0.5)}, 5th percentile ${q(0.05)}, 95th ${q(0.95)}`);

console.log("\nmost common primary > secondary pairs:");
for (const [k, n] of Object.entries(pair).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${k.padEnd(32)} ${pct(n)}`);

console.log("\npersonas (always the option nearest one school):");
for (const id of ids) {
  const { p, ranked } = persona(pos[id]);
  const ok = ranked[0] === id ? "" : "  MISSES";
  if (ok) bad = true;
  console.log(`  ${quiz.schools[id].name.padEnd(17)} -> ${ranked[0]} (then ${ranked[1]}) at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})${ok}`);
}
// A reader who always takes the same position in the list, to check the
// order options are shown in is not a shortcut to one school.
for (const slot of [0, 1, 2, 3]) {
  const chosen = Q.map((q) => q.options[slot]);
  const p = {
    x: chosen.reduce((s, o) => s + o.vector.x, 0) / 10,
    y: chosen.reduce((s, o) => s + o.vector.y, 0) / 10,
  };
  const ranked = rank(p, chosen[9].vector);
  console.log(`  always option ${"abcd"[slot]} -> ${ranked[0]} (then ${ranked[1]}) at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
}
process.exit(bad ? 1 : 0);
