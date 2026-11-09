// A small, billed check of the AI behind sample accounts, before its flag
// is turned on (Arthur, 2026-11-08: "Turn it on once built, reviewed and
// tested"). Writes one reply for each of the six schools at turn 2 and
// again at turn 4, with the prompt, the parse, the retry and the screen
// production uses (src/lib/sample-reply-prompt.ts, src/lib/screen.ts), on
// passages from the sample argument banks, and writes every reply and its
// cost to a report for reading.
//
//   SIX_SCHOOLS=1 npx tsx --require ./scripts/preload-server-only-shim.cjs tests/sample-reply/run-eval.ts [out.json] [--dry-run]
//
// SIX_SCHOOLS=1 as production builds: the three newer schools' criteria
// are read under the judge's v3 prompt only.
//
// Billed to the eval key (SOPHECS_EVAL_KEY, tests/judge/eval-key.ts),
// never to production's. About $0.10 for the twelve; a dry run sends
// nothing and needs no key.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { describeEndpoint, describeEvalKey, endpointProblem, resolveEvalKey } from "../judge/eval-key";
import { parseSampleReply, retryNote, sampleReplyUserTurn, SAMPLE_REPLY_SYSTEM, type SampleReplyInput } from "../../src/lib/sample-reply-prompt";
import { fidelityCriteriaFor } from "../../src/lib/judge/rubric";
import type { SchoolId } from "../../src/lib/types";
import { contentTopics } from "../../scripts/seed/topics";

const MODEL = "claude-sonnet-5";
const IN = 2 / 1_000_000;
const OUT = 10 / 1_000_000;
const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics", "confucian", "ubuntu", "buddhist"];
const NAMES: Record<string, string> = {
  stoicism: "Stoicism", utilitarianism: "Utilitarianism", "virtue-ethics": "Virtue Ethics",
  confucian: "Confucian Ethics", ubuntu: "Ubuntu", buddhist: "Buddhist Ethics",
};
const TOPICS = ["opaque-benefit", "borrowed-judgement", "careful-builder", "crash-arithmetic", "moral-training", "no-decision"];

const bank = (topic: string, school: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "scripts/seed/arguments", `${topic}.${school}.json`), "utf8")) as { text: string }[];
const oneLine = (school: string) => {
  const md = readFileSync(join(process.cwd(), "content/schools", `${school}.md`), "utf8");
  return /one_line: >-\n\s+(.+)/.exec(md)?.[1]?.trim() ?? "";
};
const firstSentences = (t: string, n: number) => (t.match(/[^.!?]+[.!?]+/g) ?? [t]).slice(0, n).join("").trim();

async function main() {
  const out = process.argv.find((a) => a.endsWith(".json")) ?? "sample-reply-eval.json";
  const dry = process.argv.includes("--dry-run");
  const cases: { label: string; input: SampleReplyInput }[] = [];
  SCHOOLS.forEach((school, i) => {
    const topic = TOPICS[i % TOPICS.length];
    const reader = SCHOOLS[(i + 2) % SCHOOLS.length];
    const sampleArgument = bank(topic, school)[3].text;
    const readerArgument = bank(topic, reader)[5].text;
    const base = {
      motion: contentTopics().find((t) => t.slug === topic)!.motion,
      school: { name: NAMES[school], oneLine: oneLine(school), criteria: fidelityCriteriaFor(school, "v3") },
      readerSchool: NAMES[reader],
      sampleArgument,
      readerArgument,
    };
    cases.push({ label: `${school} answers ${reader} at turn 2`, input: { ...base, turns: [], seq: 2, source: readerArgument } });
    // Turn 4: the reader's reply 3 is passages of their school's argument on the motion.
    const reply3 = firstSentences(bank(topic, reader)[9].text, 4);
    cases.push({
      label: `${school} answers ${reader} at turn 4`,
      input: {
        ...base,
        turns: [
          { seq: 1, bySample: false, quotedClaim: firstSentences(sampleArgument, 1), body: firstSentences(readerArgument, 3) },
          { seq: 2, bySample: true, quotedClaim: firstSentences(readerArgument, 1), body: firstSentences(sampleArgument, 3) },
          { seq: 3, bySample: false, quotedClaim: firstSentences(sampleArgument, 1), body: reply3 },
        ],
        seq: 4,
        source: reply3,
      },
    });
  });

  const key = resolveEvalKey(process.env);
  console.log(describeEndpoint(process.env));
  console.log(describeEvalKey(key));
  if (dry) {
    console.log(`Dry run: ${cases.length} replies, at most ${cases.length * 2} writing calls and ${cases.length} screens. Nothing sent.`);
    return;
  }
  if (!key.ok) throw new Error(`refusing to start a real run: ${key.reason}`);
  const endpoint = endpointProblem(process.env);
  if (endpoint) throw new Error(`refusing to start a real run: ${endpoint}`);
  // screen.ts reads ANTHROPIC_API_KEY; this process's copy only, never printed.
  process.env.ANTHROPIC_API_KEY = key.key;
  const { screenTurn } = await import("../../src/lib/screen");
  const client = new Anthropic({ apiKey: key.key });

  let cost = 0;
  const results = [];
  for (const c of cases) {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: sampleReplyUserTurn(c.input) }];
    const attempts: { ok: boolean; problem?: string }[] = [];
    let reply: { quotedClaim: string; body: string } | null = null;
    for (let i = 0; i < 2 && !reply; i++) {
      const r = await client.messages.create({ model: MODEL, max_tokens: 900, system: SAMPLE_REPLY_SYSTEM, messages }, { timeout: 60_000, maxRetries: 0 });
      cost += r.usage.input_tokens * IN + r.usage.output_tokens * OUT;
      const block = r.content.find((b) => b.type === "text");
      const raw = block && "text" in block ? block.text : "";
      const parsed = parseSampleReply(raw, c.input.source);
      attempts.push(parsed.ok ? { ok: true } : { ok: false, problem: parsed.problem });
      if (parsed.ok) reply = parsed;
      else messages.push({ role: "assistant", content: raw || "{}" }, { role: "user", content: retryNote(parsed.problem) });
    }
    let screen: string | null = null;
    if (reply) {
      const s = await screenTurn(reply, { timeout: 30_000, maxRetries: 0 });
      cost += s.costUsd;
      screen = s.result;
    }
    const person = reply ? /\b(I|I'm|I've|my|me)\b/.test(reply.body) : null;
    results.push({ case: c.label, attempts, screen, firstPerson: person, chars: reply?.body.length ?? 0, quote: reply?.quotedClaim, body: reply?.body });
    console.log(`${c.label}: ${attempts.map((a) => (a.ok ? "ok" : `retry (${a.problem})`)).join(", ")}; screen ${screen}; ${reply?.body.length ?? 0} chars${person ? "; first person" : ""}`);
  }
  writeFileSync(out, JSON.stringify({ model: MODEL, cost: Number(cost.toFixed(4)), results }, null, 2));
  console.log(`\n${results.filter((r) => r.screen === "ok").length} of ${results.length} delivered; billed about $${cost.toFixed(4)} to the eval key. Report: ${out}`);
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
