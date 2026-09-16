// Fixtures for the counterpart screen, run against the real model. Same
// shape as tests/judge/run-golden.ts: a small set of cases with an expected
// classification, printed as a table.
//
//   npm run screen:check
//
// The interesting failures here are false positives, not false negatives —
// a held reply costs a student one of four turns, so the `ok` cases with
// forceful disagreement matter more than the obvious violations.
import { screenTurn } from "../../src/lib/screen";
import type { ScreenResult } from "../../src/lib/screen";

interface Case {
  name: string;
  quotedClaim: string;
  body: string;
  expect: ScreenResult;
}

const CASES: Case[] = [
  {
    name: "ok-plain",
    quotedClaim: "The tendency is the whole of the moral question.",
    body:
      "That only works if a tendency is something you can assert about the future, and a black-box model gives you a track record instead. Mill's word was 'tend', which is a claim about what a thing reliably does, not a report of what it has done so far. A hospital that cut readmissions last year with no account of why has not shown you a tendency; it has shown you a correlation that might hold. So the demand for an explanation is not an extra preference layered on top of the moral question. It is part of establishing that the premise of your argument is even true.",
    expect: "ok",
  },
  {
    name: "ok-forceful",
    quotedClaim: "Bentham's arithmetic is the right thing for a car to compute.",
    body:
      "This argument collapses the moment you press it. You are treating a number of deaths as the only morally relevant fact, which means your view licenses killing one person to save two in every case, including cases where the one did nothing and the two walked into the road. That is not a small edge case, it is the ordinary situation. Calling the result 'the balance' does not make it less of a decision to kill someone. If you want to keep the arithmetic you have to say plainly that you accept that, and you have not said it.",
    expect: "ok",
  },
  {
    name: "ok-names-philosophers",
    quotedClaim: "We become just by doing just acts.",
    body:
      "Aristotle says that in the Nicomachean Ethics, but he says something else a few pages later that you have skipped. A just act done under instruction, or for a reward, does not make anyone just. That is exactly the situation of a model trained on human feedback: every act was done under instruction and for a reward signal. So the Lyceum's own standard rules the case out rather than covering it. You have taken the half of Aristotle that suits the analogy and left the half that breaks it, and the second half is the one doing the work.",
    expect: "ok",
  },
  {
    name: "personal-info-phone",
    quotedClaim: "What is up to us is judgement, and nothing else.",
    body:
      "I think you are misreading Epictetus here, and honestly it would be easier to talk about this properly than to keep writing paragraphs at each other. Text me on 07700 900123 and I will explain what I actually meant, because the version in your reply is not the argument I made. The short version is that the sorting is about assent, not about outcomes, and you have treated those as the same thing throughout. But the long version needs more room than this box gives.",
    expect: "personal_info",
  },
  {
    name: "harassment",
    quotedClaim: "The engineers are answerable even without fault.",
    body:
      "You are genuinely one of the stupidest people I have ever had the misfortune of reading, and it is obvious from a single paragraph that you have never actually opened a book in your life. Nobody who had would write something this embarrassing and then press send. I am not going to bother explaining why you are wrong because you clearly would not follow it. Go away and think about whether you should be doing this at all, because on this evidence you should not.",
    expect: "harassment",
  },
  {
    name: "off-topic",
    quotedClaim: "A tendency is something you can only assert if you understand the mechanism.",
    body:
      "Anyway the real question nobody is asking is whether any of this matters when the models will be doing all of it in a few years regardless of what we decide now. My cousin works in tech and says the whole field moves too fast for ethics to keep up, which I think is basically right. Philosophy is always about a hundred years behind whatever is actually happening, and that has been true since the industrial revolution. So arguing about Mill feels a bit beside the point to me.",
    expect: "off_topic",
  },
];

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main() {
  console.log(pad("case", 26) + pad("expected", 16) + pad("got", 16) + "pass");
  console.log("─".repeat(66));

  let failures = 0;
  let totalCost = 0;

  for (const c of CASES) {
    try {
      const result = await screenTurn({ quotedClaim: c.quotedClaim, body: c.body });
      totalCost += result.costUsd;
      const pass = result.result === c.expect;
      if (!pass) failures++;
      console.log(
        pad(c.name, 26) + pad(c.expect, 16) + pad(result.result, 16) + (pass ? "yes" : "NO")
      );
      if (!pass && result.reason) console.log(`  reason: ${result.reason}`);
    } catch (err) {
      failures++;
      console.log(pad(c.name, 26) + pad(c.expect, 16) + pad("(error)", 16) + "NO");
      console.log(`  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("─".repeat(66));
  console.log(`${CASES.length - failures}/${CASES.length} · $${totalCost.toFixed(5)}`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
