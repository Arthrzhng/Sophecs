import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRevisionId } from "../src/lib/objections";

// A revision whose judging failed leaves an unjudged row. The reader is
// told to try again (src/lib/judging-failed.ts), so the verdict page must
// not call the argument revised and the revise page must not close on it:
// getRevisionId counts only a judged revision.
function recordingClient(row: { id: string } | null) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain = {
    select: (...a: unknown[]) => (calls.push(["select", ...a]), chain),
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), chain),
    not: (...a: unknown[]) => (calls.push(["not", ...a]), chain),
    maybeSingle: async () => ({ data: row, error: null }),
  };
  const client = { from: (t: string) => (calls.push(["from", t]), chain) } as unknown as SupabaseClient;
  return { client, calls };
}

describe("getRevisionId", () => {
  it("asks only for a judged revision of that parent", async () => {
    const { client, calls } = recordingClient({ id: "rev1" });
    expect(await getRevisionId(client, "parent1")).toBe("rev1");
    expect(calls).toContainEqual(["from", "debates"]);
    expect(calls).toContainEqual(["eq", "parent_debate_id", "parent1"]);
    expect(calls).toContainEqual(["not", "verdict", "is", null]);
  });

  it("answers null when there is none", async () => {
    const { client } = recordingClient(null);
    expect(await getRevisionId(client, "parent1")).toBeNull();
  });
});
