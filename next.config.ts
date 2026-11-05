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
if (SIX_SCHOOLS === "1" && process.env.VERCEL_ENV === "production") {
  throw new Error(
    "SIX_SCHOOLS is set for a production build. The six schools are not published: " +
      "unset it for Production in Vercel (docs/stage5-plan.md)."
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

const nextConfig: NextConfig = {
  env: { SIX_SCHOOLS },
  // `npm run check:bundle:six` builds with the flag into a directory of its
  // own, so the flag-on build never overwrites the .next that
  // `npm run check:bundle` reads. Unset everywhere else, Vercel included.
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
