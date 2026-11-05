// One address (docs/decisions.md): a production build sends every page on
// another host to sophecs.com, and a sign-in that fell back to Supabase's
// Site URL to /auth/callback. The rules are built from the environment the
// build runs in, so each case passes its own.
import { describe, expect, it } from "vitest";
import { canonicalRedirects, CANONICAL_HOST } from "../next.config";

const DEPLOYMENT = "sophecs-abc123def-arthurrzhang-1874s-projects.vercel.app";

// Next matches a host value as a regular expression anchored at both ends
// (matchHas in next/dist/shared/lib/router/utils/prepare-destination).
const matches = (value: string, host: string) => new RegExp(`^${value}$`).test(host);

describe("canonicalRedirects", () => {
  it("redirects nothing on a preview or a local build", () => {
    expect(canonicalRedirects({ VERCEL_ENV: "preview", VERCEL_URL: DEPLOYMENT } as never)).toEqual([]);
    expect(canonicalRedirects({ VERCEL_ENV: "development" } as never)).toEqual([]);
    expect(canonicalRedirects({} as never)).toEqual([]);
  });

  it("on production, sends a fallen-back sign-in to the callback, then every other host home", () => {
    const [signIn, host] = canonicalRedirects({ VERCEL_ENV: "production", VERCEL_URL: DEPLOYMENT } as never);
    expect(CANONICAL_HOST).toBe("sophecs.com");

    expect(signIn).toEqual({
      source: "/",
      has: [{ type: "query", key: "code" }],
      destination: "https://sophecs.com/auth/callback",
      permanent: false,
    });

    expect(host.destination).toBe("https://sophecs.com/:path");
    expect(host.permanent).toBe(true);
    // /api/ is left where it was asked for; every other path is moved.
    const path = new RegExp(`^/${host.source.slice("/:path".length).replace(/^\((.*)\)$/, "$1")}$`);
    for (const p of ["/", "/debate", "/debate/opaque-benefit", "/apiary", "/api"]) expect(path.test(p), p).toBe(true);
    for (const p of ["/api/judge", "/api/cron/keepalive"]) expect(path.test(p), p).toBe(false);
  });

  it("keeps sophecs.com and the deployment's own URL, and moves every other host", () => {
    const [, rule] = canonicalRedirects({ VERCEL_ENV: "production", VERCEL_URL: DEPLOYMENT } as never);
    const kept = (h: string) => (rule.missing ?? []).some((m) => matches(m.value, h));
    expect(kept("sophecs.com")).toBe(true);
    expect(kept(DEPLOYMENT)).toBe(true);
    for (const h of [
      "sophecs.vercel.app",
      "www.sophecs.com",
      "sophecs-arthurrzhang-1874s-projects.vercel.app",
      "sophecs-git-main-arthurrzhang-1874s-projects.vercel.app",
      // A dot is a dot, not any character, and the whole host must match.
      "sophecsxcom",
      "sophecs.com.evil.example",
      "xsophecs.com",
    ]) {
      expect(kept(h), h).toBe(false);
    }
  });

  it("keeps only sophecs.com when the build does not say its own URL", () => {
    const [, rule] = canonicalRedirects({ VERCEL_ENV: "production" } as never);
    expect(rule.missing).toEqual([{ type: "host", value: "^sophecs\\.com$" }]);
  });
});
