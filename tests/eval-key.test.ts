import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  EVAL_KEY_NAME,
  describeEvalKey,
  keyShapeProblem,
  resolveEvalKey,
} from "./judge/eval-key";

// Claude Code's cloud sessions withhold ANTHROPIC_API_KEY, so a golden run
// reads its key as SOPHECS_EVAL_KEY. These pin where it looks, what it
// refuses, and that the key itself never appears in anything it says.

const KEY = "sk-ant-api03-not-a-real-key-0123456789";

describe("resolveEvalKey", () => {
  it("finds the key under SOPHECS_EVAL_KEY", () => {
    expect(resolveEvalKey({ SOPHECS_EVAL_KEY: KEY })).toEqual({
      ok: true,
      key: KEY,
      from: "SOPHECS_EVAL_KEY",
    });
  });

  it("still accepts ANTHROPIC_API_KEY where it is not withheld", () => {
    expect(resolveEvalKey({ ANTHROPIC_API_KEY: KEY })).toMatchObject({
      ok: true,
      from: "ANTHROPIC_API_KEY",
    });
  });

  it("prefers SOPHECS_EVAL_KEY when both are set, since it can only mean the eval key", () => {
    const other = "sk-ant-api03-a-different-one";
    expect(resolveEvalKey({ SOPHECS_EVAL_KEY: KEY, ANTHROPIC_API_KEY: other })).toMatchObject({
      key: KEY,
      from: "SOPHECS_EVAL_KEY",
    });
  });

  it("refuses when there is no key, and says where to put one", () => {
    const found = resolveEvalKey({});
    expect(found.ok).toBe(false);
    if (!found.ok) expect(found.reason).toContain("set SOPHECS_EVAL_KEY");
    expect(resolveEvalKey({ SOPHECS_EVAL_KEY: "  " }).ok).toBe(false);
  });

  it("trims surrounding whitespace, a common paste artefact", () => {
    expect(resolveEvalKey({ SOPHECS_EVAL_KEY: `  ${KEY}\n` })).toMatchObject({ ok: true, key: KEY });
  });
});

describe("keyShapeProblem", () => {
  // Each one a mistake somebody could make in a settings form; this session
  // came close to the first.
  it.each([
    ["Bearer " + KEY, "Bearer"],
    ["bearer " + KEY, "Bearer"],
    [`"${KEY}"`, "quote marks"],
    [`${KEY} extra`, "space"],
    ["sk-proj-abc", "sk-ant-"],
    ["just-the-name", "sk-ant-"],
  ])("refuses %j, naming the problem", (value, says) => {
    expect(keyShapeProblem(value)).toContain(says);
  });

  it("accepts a key of the right shape", () => {
    expect(keyShapeProblem(KEY)).toBeNull();
  });
});

describe("the key never appears in anything it says", () => {
  it.each([
    { SOPHECS_EVAL_KEY: KEY },
    { SOPHECS_EVAL_KEY: "Bearer " + KEY },
    { SOPHECS_EVAL_KEY: `"${KEY}"` },
    { ANTHROPIC_API_KEY: KEY + " x" },
  ])("%#", (env) => {
    const found = resolveEvalKey(env);
    const said = describeEvalKey(found) + (found.ok ? "" : found.reason);
    expect(said).not.toContain("not-a-real-key");
  });
});

describe("the eval key's name stays out of production", () => {
  // Like the file-sink and draft-criteria confinement tests: an eval
  // exception is only worth having while it stays inside the eval.
  // Production reads ANTHROPIC_API_KEY from Vercel and must never learn
  // the eval key's name.
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    });

  it("is mentioned nowhere in src/", () => {
    const offenders = walk(path.join(process.cwd(), "src")).filter((f) =>
      fs.readFileSync(f, "utf-8").includes(EVAL_KEY_NAME)
    );
    expect(offenders).toEqual([]);
  });

  it("is handed to the client by the runner only, after the refusal check", () => {
    const runner = fs.readFileSync(path.join(process.cwd(), "tests/judge/run-golden.ts"), "utf-8");
    const refuse = runner.indexOf("refusing to start a real run");
    const assign = runner.indexOf("process.env.ANTHROPIC_API_KEY = evalKey.key;");
    expect(refuse).toBeGreaterThan(-1);
    expect(assign, "the key is set only once a valid one was found").toBeGreaterThan(refuse);
    // And set nowhere else in the runner.
    expect(runner.match(/process\.env\.ANTHROPIC_API_KEY\s*=/g)).toHaveLength(1);
  });
});
