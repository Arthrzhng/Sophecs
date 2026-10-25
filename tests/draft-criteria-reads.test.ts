import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { afterAll, describe, it, expect, vi } from "vitest";

/**
 * What /api/judge actually reads from disk.
 *
 * tests/draft-criteria.test.ts walks src/ for the draft file's name. A
 * reviewer showed that is not enough: building the path from pieces,
 * ["content/prompts/fidelity-criteria", "draft", "md"].join("."), put a
 * real read past it with every test green. A search for a name cannot see
 * a name assembled at runtime.
 *
 * So this records every path the filesystem is asked for while the route
 * is imported and while it handles requests, and fails if the draft
 * criteria are among them, however the path was built.
 *
 * **How it records, and why this way.** The first version mocked the
 * `node:fs` and `fs` specifiers, and a second reviewer got past it twice:
 * through `node:fs/promises`, and through `createRequire(...)("node:fs")`,
 * which is a CommonJS require that a module mock never sees. Mocking
 * specifiers will always leave one out. Instead this patches the real fs
 * module object in place. That one object is what `require("node:fs")`,
 * `createRequire(...)("node:fs")` and the default ESM import all return,
 * and `fs.promises` is what `node:fs/promises` returns; Node's
 * `syncBuiltinESMExports()` then pushes the patched functions through to
 * every named ESM import, `import { readFileSync } from "node:fs"`
 * included. Every read passes through unchanged: the route still loads its
 * prompt, and this only watches.
 *
 * Vitest gives each test file its own worker, so the patch reaches no
 * other test file, and it is undone after this one.
 *
 * Covered on fs: readFileSync, readFile, openSync, open, createReadStream,
 * openAsBlob, and the copies, copyFileSync, copyFile, cpSync and cp, since
 * copying the file somewhere else and reading the copy was a third
 * reviewer's way past the first version of this list. On fs.promises:
 * readFile, open, copyFile and cp.
 *
 * What it cannot see is a read done by another process: shelling out to
 * `cat`, or a worker thread with its own module state. A recorder in this
 * process cannot follow those, so tests/draft-criteria.test.ts refuses
 * `child_process` and `worker_threads` anywhere in src/ instead. Neither is
 * used there, and a Next app reading content has no need of either.
 */

const reads: string[] = [];
const restore: (() => void)[] = [];

function watch(target: Record<string, unknown>, name: string): void {
  const original = target[name] as (...args: unknown[]) => unknown;
  target[name] = function (this: unknown, ...args: unknown[]) {
    reads.push(String(args[0]));
    return original.apply(this, args);
  };
  restore.push(() => {
    target[name] = original;
  });
}

for (const name of [
  "readFileSync",
  "readFile",
  "openSync",
  "open",
  "createReadStream",
  "openAsBlob",
  "copyFileSync",
  "copyFile",
  "cpSync",
  "cp",
]) {
  watch(fs as unknown as Record<string, unknown>, name);
}
for (const name of ["readFile", "open", "copyFile", "cp"]) {
  watch(fs.promises as unknown as Record<string, unknown>, name);
}
syncBuiltinESMExports();

afterAll(() => {
  for (const undo of restore) undo();
  syncBuiltinESMExports();
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async () => {
        throw new Error("the model must not be called in this test");
      },
    };
  },
}));

let profileSchool = "confucian";
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "order", "limit", "in", "neq", "insert"]) b[m] = () => b;
      b.maybeSingle = async () => ({
        data: table === "profiles" ? { school: profileSchool, elo: 1200, streak: 0 } : null,
      });
      b.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, count: 0 });
      return b;
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "reader-1" } } }) },
  }),
}));
vi.mock("@/lib/budget", () => ({ isBudgetExceeded: async () => false }));

const { POST } = await import("../src/app/api/judge/route");

const DRAFT_FILE = "fidelity-criteria.draft";

describe("/api/judge's reads from disk", () => {
  it("is actually being recorded, so an empty record means something", () => {
    // The route's import reads the live judge prompt at module scope. If
    // that is not in the record, the recorder is not wired up and the
    // assertions below would pass for nothing.
    expect(reads.some((p) => p.includes("judge.v2.md"))).toBe(true);
  });

  it("never touches the draft criteria while loading", () => {
    expect(reads.filter((p) => p.includes(DRAFT_FILE))).toEqual([]);
  });

  it("never touches the draft criteria while handling a live school either", async () => {
    // A read added lazily on the path a live school takes would not run
    // for a draft school, which stops at the criteria check. A live school
    // gets past it, to the topic lookup, which this stub answers with no
    // topic.
    process.env.KILL_SWITCH_JUDGE = "false";
    profileSchool = "stoicism";
    const before = reads.length;
    const res = await POST(
      new Request("http://localhost/api/judge", {
        method: "POST",
        body: JSON.stringify({ topicSlug: "t", argument: "An argument." }),
      })
    );
    expect(res.status).toBe(404);
    expect(reads.slice(before).filter((p) => p.includes(DRAFT_FILE))).toEqual([]);
  });

  for (const school of ["confucian", "ubuntu", "buddhist"]) {
    it(`never touches the draft criteria while refusing ${school}`, async () => {
      process.env.KILL_SWITCH_JUDGE = "false";
      profileSchool = school;
      const before = reads.length;
      const res = await POST(
        new Request("http://localhost/api/judge", {
          method: "POST",
          body: JSON.stringify({ topicSlug: "t", argument: "An argument." }),
        })
      );
      expect(await res.json()).toMatchObject({ reason: "no_criteria" });
      expect(reads.slice(before).filter((p) => p.includes(DRAFT_FILE))).toEqual([]);
    });
  }
});
