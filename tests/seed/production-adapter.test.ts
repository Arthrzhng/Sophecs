// The production adapter, against a fake client: what it asks Supabase Auth
// for when it creates a sample user, and what it never asks for.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SupabaseAdapter, sampleUserAttributes, BAN_DURATION } from "../../scripts/seed/adapter-supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const REF = "tekifezydjlgxgndkxul";
const target = { kind: "production" as const, url: `https://${REF}.supabase.co`, ref: REF, serviceKey: "sb_secret_test" };

describe("sample users cannot sign in", () => {
  it("are created confirmed, banned for a century, without a password, on .test", async () => {
    const calls: unknown[] = [];
    const fake = {
      auth: {
        admin: {
          createUser: async (attrs: Record<string, unknown>) => {
            calls.push(attrs);
            return { data: { user: { id: attrs.id, email: attrs.email } }, error: null };
          },
        },
      },
    } as unknown as SupabaseClient;
    const a = new SupabaseAdapter(target, fake);
    await a.createAuthUser({ id: "00000000-0000-4000-8000-000000000001", email: "seed+sample-1-202611041200-0@sophecs.test", runId: "sample-1-202611041200", n: 0 });
    expect(calls).toEqual([sampleUserAttributes({ id: "00000000-0000-4000-8000-000000000001", email: "seed+sample-1-202611041200-0@sophecs.test", runId: "sample-1-202611041200", n: 0 })]);
    const attrs = calls[0] as Record<string, unknown>;
    expect(attrs.email_confirm).toBe(true);
    expect(attrs.ban_duration).toBe(BAN_DURATION);
    expect(BAN_DURATION).toBe("876000h");
    expect(attrs).not.toHaveProperty("password");
    expect(attrs).not.toHaveProperty("password_hash");
    expect(String(attrs.email)).toMatch(/@sophecs\.test$/);
    expect(attrs.app_metadata).toMatchObject({ sophecs_sample: true, seed_run: "sample-1-202611041200" });
  });

  it("never invites, links, signs in, resets or backdates", () => {
    const src = readFileSync("scripts/seed/adapter-supabase.ts", "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const call of ["inviteUserByEmail", "generateLink", "signInWith", "signUp", "resetPasswordForEmail", "updateUserById", "last_sign_in_at", "email_confirmed_at", "confirmed_at:"])
      expect(src, call).not.toContain(call);
  });
});
