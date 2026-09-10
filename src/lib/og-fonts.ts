import { readFile } from "node:fs/promises";
import { join } from "node:path";

// TTF, not WOFF2 — Satori (the engine behind ImageResponse) can't parse
// WOFF2, so these are a separate set from the WOFF2 files next/font/local
// uses for the live site. next.config.ts traces them into the Lambda;
// process.cwd() alone doesn't put them there.
const FILES = ["spectral-500.ttf", "plex-sans-400.ttf", "plex-mono-500.ttf"];

let cached: Promise<Buffer[]> | undefined;

// Read once per Lambda, but lazily. Kicking the reads off at module scope
// instead rejects before any handler has awaited them, which Node treats as
// an unhandled rejection and answers by killing the whole process — in
// production every /r/[id] view took down its Lambda this way, so the next
// request paid a full cold start.
export function loadOgFonts(): Promise<Buffer[]> {
  cached ??= Promise.all(
    FILES.map((file) => readFile(join(process.cwd(), "src/assets/og-fonts", file)))
  );
  return cached;
}
