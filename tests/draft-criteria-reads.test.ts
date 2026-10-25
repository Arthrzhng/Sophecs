import { describe, it, expect, vi } from "vitest";

/**
 * What /api/judge actually reads from disk.
 *
 * tests/draft-criteria.test.ts walks src/ for the draft file's name. A
 * reviewer showed that is not enough: building the path from pieces,
 * ["content/prompts/fidelity-criteria", "draft", "md"].join("."), put a
 * real read past it with every test green. A search for a name cannot see
 * a name that is assembled at runtime.
 *
 * So this records every file the filesystem is asked for while the route
 * is imported and while it handles a request from each draft school, and
 * fails if the draft criteria are among them, however the path was built.
 * It lives in its own file so that nothing else here reads the draft file
 * for a legitimate reason and muddies the record.
 */

// vi.mock is hoisted above everything else in the file, so the recorder
// and the factory are hoisted with it. Both specifiers, so a module that
// imports "fs" rather than "node:fs" is recorded too. Every read passes
// through to the real filesystem: the route still loads its prompt, and
// this only watches.
const { reads, recordingFs } = vi.hoisted(() => {
  const reads: string[] = [];
  const recordingFs = async (importOriginal: () => Promise<unknown>) => {
    const actual = (await importOriginal()) as typeof import("node:fs");
    const watch =
      <F extends (...a: never[]) => unknown>(fn: F) =>
      (...args: unknown[]) => {
        reads.push(String(args[0]));
        return (fn as unknown as (...a: unknown[]) => unknown)(...args);
      };
    const wrapped = {
      ...actual,
      readFileSync: watch(actual.readFileSync),
      readFile: watch(actual.readFile),
      openSync: watch(actual.openSync),
      createReadStream: watch(actual.createReadStream),
      promises: { ...actual.promises, readFile: watch(actual.promises.readFile) },
    };
    return { ...wrapped, default: wrapped };
  };
  return { reads, recordingFs };
});

vi.mock("node:fs", recordingFs);
vi.mock("fs", recordingFs);

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
