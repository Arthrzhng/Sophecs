import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { requestFingerprint, sha256, RUNS_DIR } from "./judge/golden-log";

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

  it("writes to a file by default and to ai_calls only on request", () => {
    expect(runner).toContain('process.env.GOLDEN_LOG === "ai_calls"');
    expect(runner).toContain('startRun(');
    expect(runner).toContain("flush(run, true)");
  });

  it("records everything the amendment asked for", () => {
    const sink = read("tests/judge/golden-log.ts");
    for (const field of [
      "prompt_version",
      "fixture",
      "request_fingerprint",
      "response",
      "score",
      "cost_usd",
    ]) {
      expect(sink, `GoldenCallRecord should carry ${field}`).toContain(`${field}:`);
    }
  });

  it("flushes after every call, not only at the end", () => {
    // A run that dies part way through still has to leave what it spent.
    const logCall = runner.slice(runner.indexOf("async function logCall"));
    expect(logCall.slice(0, logCall.indexOf("\n}"))).toContain("flush(run)");
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
