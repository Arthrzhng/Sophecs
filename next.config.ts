import path from "node:path";
import type { NextConfig } from "next";

// SIX_SCHOOLS=1 builds the six-school product: the three schools that are
// not yet published are shown on that build, and on no other
// (docs/stage5-plan.md). It is meant for Vercel's Preview environment
// only, until launch.
//
// It is read here, once, when the build starts, and handed to the code
// through `env`, which writes the value into server and client code alike
// as a constant. A runtime read would not do: a client component cannot
// read a server variable, so a page would render six schools on the server
// and hydrate with three. Written in as a constant, `process.env.SIX_SCHOOLS
// === "1"` is false at compile time on a build without the flag, and the
// code behind it, with every new school's id, name and colour, is dropped
// as dead. `npm run check:bundle` confirms that it was, and reads which
// kind of build it is checking from `config.env` in the build's
// required-server-files.json, not from the environment the check runs in.
//
// Always "0" or "1", never absent: an absent key would leave
// `process.env.SIX_SCHOOLS` unreplaced in client code, which is no
// constant at all.
const SIX_SCHOOLS = process.env.SIX_SCHOOLS === "1" ? "1" : "0";

// Vercel's production build is a plain `next build`, which runs no bundle
// check, so a flag ticked for Production by mistake would publish the
// three with every gate green. That is Arthur's decision (c), taken at
// launch, and the launch merge removes this refusal; until then a
// production deploy with the flag fails to build and the live one stays.
//
// It fails closed: a build on Vercel (`VERCEL=1`) that cannot say which
// environment it is for is refused as well, rather than let through. It
// covers builds only. Promoting a flag-on preview deployment to Production
// does not rebuild, so it would publish the three without passing here;
// docs/review-charter.md, rule 4, counts that as publishing.
const onVercelUnsure = process.env.VERCEL === "1" && !process.env.VERCEL_ENV;
if (SIX_SCHOOLS === "1" && (process.env.VERCEL_ENV === "production" || onVercelUnsure)) {
  throw new Error(
    "SIX_SCHOOLS is set for a production build, or for a Vercel build that does not say " +
      "which environment it is for. The six schools are not published: unset it for " +
      "Production in Vercel (docs/stage5-plan.md)."
  );
}

// The new schools' colour tokens are a stylesheet of their own, and a
// build without the flag gets an empty one in its place, so their names
// and hexes reach no stylesheet production serves. The layout imports the
// name below; it resolves only through this alias, so a bundler that
// skipped this config would fail to build rather than ship the tokens.
const SIX_SCHOOLS_TOKENS = path.join(
  process.cwd(),
  "src/app",
  SIX_SCHOOLS === "1" ? "six-schools.css" : "six-schools.off.css"
);

// One address: readers see sophecs.com and no other (docs/decisions.md,
// "One address"). A production deployment also answers at www.sophecs.com,
// sophecs.vercel.app and two vercel.app aliases Vercel assigns, and a
// reader who arrived at one stayed there, because every link on the site is
// relative. Signing in is how they arrived: Supabase Auth sends a sign-in
// whose return address it does not recognise to its Site URL, which was
// sophecs.vercel.app.
//
// So a production build sends every page request on any other host to the
// same path and query on sophecs.com. Not redirected:
// - /api/, which no reader sees as an address. Vercel's cron calls one and
//   does not follow redirects, and a fetch from a tab left open on an old
//   host could not follow one either: sophecs.com would see none of that
//   host's cookies, and answers no cross-origin request.
// - /_next and anything under it, the scripts and styles a page already
//   on an old host loads: the same files on every host. Next adds this
//   exclusion to every redirect it runs itself, so it is written into the
//   rule for Vercel's router, which runs these rules in production.
// - the deployment's own URL (VERCEL_URL), so a past deployment can still
//   be opened at its own address; Vercel asks for a login there.
// - previews and local builds, whose VERCEL_ENV is not "production".
//
// A sign-in that fell back to the Site URL arrives at the root with ?code=,
// which only /auth/callback can exchange, and the root would drop it. It is
// sent there on sophecs.com, wherever it landed, so the sign-in completes
// (at /me, or at the quiz for a reader who has not taken it, since the page
// the reader started from is not in the fallback). The exchange needs the
// cookie the sign-in set when it started, which is on sophecs.com once
// readers can no longer start one anywhere else.
//
// Never point a Vercel domain redirect from sophecs.com to another host
// (www, say): these rules send that host back, and the two would loop.
//
// The host rule is a 307 until a live check has shown sophecs.com is left
// alone in production (to be recorded in docs/progress.md), and a 308 after. A browser keeps
// a 308, so a rule Vercel read differently from Next could otherwise leave
// readers in a loop that no rollback reaches.
//
// Host values are regular expressions. Next anchors them; the anchors here
// say so for any reader or router that does not.
export const CANONICAL_HOST = "sophecs.com";

export function canonicalRedirects(env: NodeJS.ProcessEnv) {
  if (env.VERCEL_ENV !== "production") return [];
  const exactly = (host: string) => `^${host.replace(/\./g, "\\.")}$`;
  const kept = [CANONICAL_HOST, env.VERCEL_URL].filter((h): h is string => Boolean(h));
  return [
    {
      source: "/",
      has: [{ type: "query" as const, key: "code" }],
      destination: `https://${CANONICAL_HOST}/auth/callback`,
      permanent: false,
    },
    {
      source: "/:path((?!api/|_next).*)",
      missing: kept.map((host) => ({ type: "host" as const, value: exactly(host) })),
      destination: `https://${CANONICAL_HOST}/:path`,
      permanent: false,
    },
  ];
}

const nextConfig: NextConfig = {
  env: { SIX_SCHOOLS },
  async redirects() {
    return canonicalRedirects(process.env);
  },
  // `npm run check:bundle:six` builds with the flag into a directory of its
  // own, so the flag-on build never overwrites the .next that
  // `npm run check:bundle` reads. Unset everywhere else, Vercel included,
  // and never in .env.local: `next build` would read it there, but the
  // check, run by tsx, does not load .env.local, and would read .next.
  ...(process.env.SOPHECS_DIST_DIR ? { distDir: process.env.SOPHECS_DIST_DIR } : {}),
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@six-schools/tokens.css": SIX_SCHOOLS_TOKENS,
    };
    // Webpack's build cache keys on Next's own config, which leaves out
    // both `env` and this alias, and on this file's text, which does not
    // change when the variable does. Without the flag in the cache's
    // version, a build reusing the other kind's cache kept the stylesheet
    // that cache resolved: a flag-off build over a flag-on cache shipped
    // the three's tokens. Vercel restores .next/cache between deploys, so
    // each kind of build now reads only a cache written by its own kind.
    // Only a filesystem cache has a version; a memory cache starts empty.
    if (config.cache && typeof config.cache === "object" && config.cache.type === "filesystem") {
      config.cache.version = `${config.cache.version ?? ""}|six-schools:${SIX_SCHOOLS}`;
    }
    return config;
  },
  // Every image route (the two card routes, both OG images, and the two icon
  // routes) reads these TTFs from disk at runtime. Next's tracer can't see
  // through join(process.cwd(), ...), so without this they are absent from
  // the deployed Lambda — which is what produced the ENOENT that crashed the
  // process on every /r/[id] view in production.
  //
  // Matched against all routes rather than named ones on purpose: the keys
  // are globs, so route paths containing "[id]"/"[slug]" can't be written
  // literally (brackets are character-class syntax), and a near-miss here
  // fails silently at runtime rather than at build. ~500KB per function is
  // a cheap price for that not happening twice.
  outputFileTracingIncludes: {
    "/**": ["./src/assets/og-fonts/**"],
  },
};

export default nextConfig;
