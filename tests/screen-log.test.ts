// The screen's log row (src/lib/screen.ts). `for_sample` (migration 0029)
// is written only on a sample's screen, so every reader's own screen is
// the insert it was before 0029 and still works on a database without the
// column.
import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        expect(table).toBe("ai_calls");
        inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

let modelText = '{"result":"ok","reason":""}';
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: async () => ({
        usage: { input_tokens: 400, output_tokens: 20 },
        content: [{ type: "text", text: modelText }],
      }),
    };
  }
  return { default: MockAnthropic };
});

const { logScreenCall, screenAndLog } = await import("../src/lib/screen");

beforeEach(() => {
  inserted.length = 0;
  modelText = '{"result":"ok","reason":""}';
});

describe("the screen's log row", () => {
  it("a reader's screen carries no for_sample key at all", async () => {
    await screenAndLog({ quotedClaim: "a claim", body: "a reply", userId: "u1" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].kind).toBe("screen");
    expect(inserted[0].user_id).toBe("u1");
    expect("for_sample" in inserted[0]).toBe(false);
  });

  it("nor does one whose response could not be read, which is still logged", async () => {
    modelText = "not json";
    await expect(screenAndLog({ quotedClaim: "a claim", body: "a reply", userId: "u1" })).rejects.toThrow();
    expect(inserted).toHaveLength(1);
    expect("for_sample" in inserted[0]).toBe(false);
  });

  it("logScreenCall with forSample false sends no key; with true, the mark", async () => {
    await logScreenCall({ userId: "u1", costUsd: 0.0005, latencyMs: 1, forSample: false });
    await logScreenCall({ userId: "u1", costUsd: 0.0005, latencyMs: 1, forSample: true });
    expect("for_sample" in inserted[0]).toBe(false);
    expect(inserted[1].for_sample).toBe(true);
    expect(inserted[1].kind).toBe("screen");
  });
});
