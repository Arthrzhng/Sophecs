import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The OG/card image routes read these TTFs from disk at runtime. Next's
  // tracer can't see through join(process.cwd(), ...), so without this they
  // are simply absent from the deployed Lambda — which is what produced the
  // ENOENT on every /r/[id] view in production. Keys are globs, so the
  // literal "[id]"/"[slug]" segments can't be written out (brackets mean a
  // character class); "/**" matches through them instead.
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./src/assets/og-fonts/**"],
    "/**/card.png": ["./src/assets/og-fonts/**"],
  },
};

export default nextConfig;
