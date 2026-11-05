// One address (docs/decisions.md): a production build sends every page on
// another host to sophecs.com, and a sign-in that fell back to Supabase's
// Site URL to /auth/callback. The rules are matched here with Next's own
// matchers (path-to-regexp for the path, matchHas for the host and query);
// in production Vercel's router runs them, after converting them, and the
// pull request records a check against the live hosts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { matchHas } from "next/dist/shared/lib/router/utils/prepare-destination";
import nextConfig, { canonicalRedirects, CANONICAL_HOST } from "../next.config";

const DEPLOYMENT = "sophecs-abc123def-arthurrzhang-1874s-projects.vercel.app";
type Rule = ReturnType<typeof canonicalRedirects>[number];

/** Where a GET for host + path + query goes, by the first rule that matches, or null. */
function route(rules: Rule[], host: string, path: string, query: Record<string, string> = {}) {
  for (const rule of rules) {
    const params = getPathMatch(rule.source, { strict: true })(path);
    if (!params) continue;
    const req = { headers: { host } } as never;
    if (!matchHas(req, query, rule.has ?? [], rule.missing ?? [])) continue;
    const search = new URLSearchParams(query).toString();
    const to = rule.destination.replace(":path", String((params as Record<string, string>).path ?? ""));
    return { status: rule.permanent ? 308 : 307, location: `${to}${search ? `?${search}` : ""}` };
  }
  return null;
}

afterEach(() => vi.unstubAllEnvs());

describe("the config Next reads", () => {
  it("hands Next these rules on a production build, and none on any other", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", DEPLOYMENT);
    const rules = await nextConfig.redirects!();
    expect(rules).toEqual(canonicalRedirects(process.env));
    expect(rules).toHaveLength(2);

    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await nextConfig.redirects!()).toEqual([]);
    vi.stubEnv("VERCEL_ENV", "");
    expect(await nextConfig.redirects!()).toEqual([]);
  });
});

describe("on production", () => {
  const rules = canonicalRedirects({ VERCEL_ENV: "production", VERCEL_URL: DEPLOYMENT } as never);

  it("leaves sophecs.com where it is, in any case and with a port", () => {
    expect(CANONICAL_HOST).toBe("sophecs.com");
    for (const host of ["sophecs.com", "SOPHECS.com", "sophecs.com:443"])
      for (const path of ["/", "/debate", "/debate/opaque-benefit", "/me"]) expect(route(rules, host, path), `${host}${path}`).toBeNull();
  });

  it("sends every other host to the same path and query on sophecs.com, permanently", () => {
    for (const host of [
      "sophecs.vercel.app",
      "www.sophecs.com",
      "sophecs-arthurrzhang-1874s-projects.vercel.app",
      "sophecs-git-main-arthurrzhang-1874s-projects.vercel.app",
      // A dot is a dot, not any character, and the whole host must match.
      "sophecsxcom",
      "sophecs.com.evil.example",
      "xsophecs.com",
    ]) {
      expect(route(rules, host, "/"), host).toEqual({ status: 308, location: "https://sophecs.com/" });
      expect(route(rules, host, "/debate/opaque-benefit", { x: "1" }), host).toEqual({
        status: 308,
        location: "https://sophecs.com/debate/opaque-benefit?x=1",
      });
    }
  });

  it("leaves /api/ and /_next/ on every host, and the deployment's own URL", () => {
    for (const path of ["/api/judge", "/api/cron/keepalive", "/_next/static/chunks/main.js"])
      expect(route(rules, "sophecs.vercel.app", path), path).toBeNull();
    expect(route(rules, "sophecs.vercel.app", "/apiary")?.location).toBe("https://sophecs.com/apiary");
    expect(route(rules, DEPLOYMENT, "/debate")).toBeNull();
  });

  it("sends a sign-in code at the root to the callback, on any host, for the moment", () => {
    for (const host of ["sophecs.vercel.app", "sophecs.com"])
      expect(route(rules, host, "/", { code: "abc123" }), host).toEqual({
        status: 307,
        location: "https://sophecs.com/auth/callback?code=abc123",
      });
    // Only at the root.
    expect(route(rules, "sophecs.com", "/debate", { code: "abc123" })).toBeNull();
  });

  it("keeps only sophecs.com when the build does not say its own URL", () => {
    const [, rule] = canonicalRedirects({ VERCEL_ENV: "production" } as never);
    expect(rule.missing).toEqual([{ type: "host", value: "^sophecs\\.com$" }]);
  });
});
