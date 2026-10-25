import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import os from "node:os";
import {
  logTarget,
  recordCall,
  requestFingerprint,
  sha256,
  startRun,
  RUNS_DIR,
  type GoldenCallRecord,
} from "./judge/golden-log";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf-8");

/**
 * The golden run logs to a file. Production still logs to `ai_calls`.
 *
 * Arthur amended the "every Anthropic call is logged to ai_calls, no
 * exceptions" rule for the eval run only. The value of that amendment
 * depends entirely on it staying confined to the eval, so this is the
 * test that it does.
 */
describe("production logging", () => {
  const anthropic = read("src/lib/anthropic.ts");

  it("still writes every judged call to ai_calls", () => {
    const judgeDebate = anthropic.slice(anthropic.indexOf("export async function judgeDebate"));
    // Once on the success path, once when the response fails validation
    // but the call was still billed.
    expect((judgeDebate.match(/await logAiCall\(/g) ?? []).length).toBe(2);
    expect(judgeDebate).toContain("JudgeValidationError");
  });

  it("still goes through judgeDebate from the route", () => {
    expect(read("src/app/api/judge/route.ts")).toContain("judgeDebate({");
  });

  it("does not know the file sink exists", () => {
    // The one that matters. Anything in src/ importing this would make
    // the amendment reach production.
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) ? [full] : [];
      });
    const offenders = walk(path.join(process.cwd(), "src")).filter((f) =>
      fs.readFileSync(f, "utf-8").includes("golden-log")
    );
    expect(offenders, "nothing in src/ may import the golden run's file sink").toEqual([]);
  });

  it("keeps logAiCall exported for production to use", () => {
    expect(anthropic).toContain("export async function logAiCall");
  });
});

describe("the golden run's file log", () => {
  const runner = read("tests/judge/run-golden.ts");

  // These three used to read the runner's source for strings. A reviewer
  // flipped the default so every golden run wrote to the production ledger
  // and all three stayed green. They now test what the code does.

  it("logs to a file unless asked, in exactly one spelling, for ai_calls", () => {
    expect(logTarget(undefined)).toBe("file");
    expect(logTarget("")).toBe("file");
    expect(logTarget("file")).toBe("file");
    // A typo or a near miss has to fail safe, into the file.
    for (const near of ["AI_CALLS", "ai-calls", "aicalls", "ai_calls ", "true", "1"]) {
      expect(logTarget(near), near).toBe("file");
    }
    expect(logTarget("ai_calls")).toBe("ai_calls");
  });

  it("is the function the runner actually uses", () => {
    // The one source check left, and it can fail: inlining a flipped
    // default would remove this call.
    expect(runner).toContain("const LOG_TO = logTarget(process.env.GOLDEN_LOG);");
    expect(runner).not.toMatch(/process\.env\.GOLDEN_LOG\s*===/);
  });

  const sample = (n: number): GoldenCallRecord => ({
    sample: n,
    fixture: "stoic-strong",
    school: "stoicism",
    prompt_version: "v2",
    criteria_source: "live",
    request_fingerprint: "f",
    model: "m",
    response: { rejected: false },
    score: 80,
    fidelity: 9,
    rigor: 8,
    engagement: 7,
    objection_school: "utilitarianism",
    cost_usd: 0.01,
    latency_ms: 10,
    error: null,
    at: "2026-10-25T00:00:00.000Z",
  });

  it("writes the run to disk after every call, not only at the end", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "golden-"));
    try {
      const run = startRun({ promptVersion: "v2", promptText: "p", model: "m", samplesPerCase: 3 });
      const file = recordCall(run, sample(1), dir);
      // On disk after one call, before anything says the run is finished:
      // a run that dies here still leaves what it spent.
      const afterOne = JSON.parse(fs.readFileSync(file, "utf-8"));
      expect(afterOne.records).toHaveLength(1);
      expect(afterOne.finished_at).toBeNull();
      expect(afterOne.total_cost_usd).toBeCloseTo(0.01);

      recordCall(run, sample(2), dir);
      expect(JSON.parse(fs.readFileSync(file, "utf-8")).records).toHaveLength(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records everything the amendment asked for, and where the criteria came from", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "golden-"));
    try {
      const run = startRun({ promptVersion: "v2", promptText: "p", model: "m", samplesPerCase: 1 });
      const written = JSON.parse(fs.readFileSync(recordCall(run, sample(1), dir), "utf-8"));
      for (const field of [
        "prompt_version",
        "criteria_source",
        "fixture",
        "request_fingerprint",
        "response",
        "score",
        "rigor",
        "engagement",
        "cost_usd",
      ]) {
        expect(written.records[0], `a record should carry ${field}`).toHaveProperty(field);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("goes through recordCall, so the per-call write is not a separate line to forget", () => {
    const logCall = runner.slice(runner.indexOf("async function logCall"));
    expect(logCall.slice(0, logCall.indexOf("\n}"))).toContain("recordCall(run,");
  });
});

describe("requestFingerprint", () => {
  const base = {
    promptVersion: "v2",
    promptText: "a prompt with {{RUBRIC}}",
    criteria: "the criteria",
    motion: "a motion",
    school: "stoicism",
    argument: "an argument",
  };

  it("is stable for the same inputs", () => {
    expect(requestFingerprint(base)).toBe(requestFingerprint(base));
  });

  it.each([
    ["promptVersion", { promptVersion: "v3" }],
    ["promptText", { promptText: "a different prompt" }],
    ["criteria", { criteria: "different criteria" }],
    ["motion", { motion: "a reworded motion" }],
    ["school", { school: "utilitarianism" }],
    ["argument", { argument: "a different argument" }],
  ])("changes when %s changes", (_name, patch) => {
    expect(requestFingerprint({ ...base, ...patch })).not.toBe(requestFingerprint(base));
  });

  it("distinguishes a revision from an original", () => {
    expect(
      requestFingerprint({
        ...base,
        revisionOf: { originalArgument: "the first try", objectionClaim: "the objection" },
      })
    ).not.toBe(requestFingerprint(base));
  });

  it("hashes the prompt rather than storing it", () => {
    // The fingerprint must not leak the prompt text into every record.
    expect(requestFingerprint(base)).not.toContain("RUBRIC");
    expect(sha256("a")).not.toBe(sha256("b"));
  });

  it("writes runs where the repository keeps them", () => {
    expect(RUNS_DIR.endsWith(path.join("tests", "judge", "golden-runs"))).toBe(true);
  });
});
