// /auth/callback keeps a sign-in on the site whatever `next` says
// (src/lib/local-path.ts). The exchange and the claim are faked; the route
// is the real one.
import { beforeEach, describe, expect, it, vi } from "vitest";

let claimed = true;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ data: { user: { id: "u1" } }, error: null }) },
  }),
}));
vi.mock("@/lib/claim", () => ({ claimAnonymousResults: async () => ({ claimed }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { GET } = await import("../src/app/auth/callback/route");

async function land(next: string | null) {
  const url = new URL("https://sophecs.com/auth/callback?code=x");
  if (next !== null) url.searchParams.set("next", next);
  const res = await GET(new Request(url));
  return new URL(res.headers.get("location")!);
}

const HOSTILE = [
  "//evil.example",
  "/\\evil.example",
  "https://evil.example",
  "/..//evil.example",
  "/.//evil.example",
  "/%2e%2e//evil.example",
  "/a/..//evil.example",
  "/x/../..//evil.example",
  "/./\\evil.example",
];

beforeEach(() => {
  claimed = true;
});

describe("/auth/callback", () => {
  it("follows a path on the site, for a reader with a result and one without", async () => {
    const to = await land("/debate/opaque-benefit");
    expect(`${to.host}${to.pathname}`).toBe("sophecs.com/debate/opaque-benefit");
    expect(to.searchParams.get("welcome")).toBe("1");
    claimed = false;
    const quiz = await land("/debate/opaque-benefit");
    expect(`${quiz.host}${quiz.pathname}`).toBe("sophecs.com/quiz");
    expect(quiz.searchParams.get("next")).toBe("/debate/opaque-benefit");
  });

  it("never leaves sophecs.com, whatever next says", async () => {
    for (const next of HOSTILE) {
      claimed = true;
      const to = await land(next);
      expect(to.host, next).toBe("sophecs.com");
      expect(to.pathname, next).toBe("/me");
      claimed = false;
      const quiz = await land(next);
      expect(quiz.host, next).toBe("sophecs.com");
      expect(quiz.searchParams.get("next"), next).toBe("/debate");
    }
  });
});
