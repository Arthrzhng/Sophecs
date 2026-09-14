import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
