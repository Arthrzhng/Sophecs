import localFont from "next/font/local";

// Self-hosted, Latin-subset only, display: swap. Files pulled from Google
// Fonts' own CDN once at build time and committed under public/fonts — see
// docs/decisions.md for how they were sourced.
//
// IBM Plex Sans ships from Google as a single variable-font binary covering
// its whole weight axis (confirmed: the CSS2 API returns byte-identical
// files for wght=400/500/600), so it gets one file with a weight range
// rather than three near-duplicate files.

// Bricolage Grotesque carries the interface in the Daily path design.
// Google serves it as a single variable binary across its whole weight axis
// (all three of the weights we asked for, 500/600/800, return the same
// byte-identical file), so it gets one file with a weight range for the same
// reason IBM Plex Sans does above, rather than three duplicates.
export const bricolage = localFont({
  src: [
    { path: "../../public/fonts/bricolage-var.woff2", weight: "500 800", style: "normal" },
  ],
  variable: "--font-bricolage",
  display: "swap",
  preload: true,
});

export const spectral = localFont({
  src: [
    { path: "../../public/fonts/spectral-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/spectral-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/spectral-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-spectral",
  display: "swap",
  preload: true,
});

export const plexSans = localFont({
  src: [
    { path: "../../public/fonts/plex-sans-var.woff2", weight: "400 600", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
  preload: true,
});

export const plexMono = localFont({
  src: [
    { path: "../../public/fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  preload: true,
});
