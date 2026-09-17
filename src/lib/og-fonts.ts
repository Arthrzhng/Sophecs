import { readFile } from "node:fs/promises";
import { join } from "node:path";

// TTF, not WOFF2 — Satori (the engine behind ImageResponse) can't parse
// WOFF2, so these are a separate set from the WOFF2 files next/font/local
// uses for the live site. next.config.ts traces them into the Lambda;
// process.cwd() alone doesn't put them there.
const FILES = ["spectral-500.ttf", "plex-sans-400.ttf", "plex-mono-500.ttf"];

// The result card's set, which is not the same set. It needs Spectral
// italic, because Satori does not synthesise obliques — a fontStyle:
// "italic" with only a roman face registered renders upright, so the card's
// quotation and its source would silently lose their italic in the image
// routes while keeping it on screen. The file is the same face the live site
// loads (public/fonts/spectral-400-italic.woff2), converted to TTF.
//
// It needs no mono, because the card holds no measured value. The verdict
// OG image still does, which is why this is a second list rather than a
// change to the one above.
const CARD_FILES = [
  "spectral-500.ttf",
  "spectral-400-italic.ttf",
  "plex-sans-400.ttf",
];

let cached: Promise<Buffer[]> | undefined;
let cardCached: Promise<Buffer[]> | undefined;

function read(files: string[]): Promise<Buffer[]> {
  return Promise.all(
    files.map((file) => readFile(join(process.cwd(), "src/assets/og-fonts", file)))
  );
}

// Read once per Lambda, but lazily. Kicking the reads off at module scope
// instead rejects before any handler has awaited them, which Node treats as
// an unhandled rejection and answers by killing the whole process — in
// production every /r/[id] view took down its Lambda this way, so the next
// request paid a full cold start.
export function loadOgFonts(): Promise<Buffer[]> {
  cached ??= read(FILES);
  return cached;
}

/** Spectral 500 roman, Spectral 400 italic, IBM Plex Sans 400 — in order. */
export function loadCardFonts(): Promise<Buffer[]> {
  cardCached ??= read(CARD_FILES);
  return cardCached;
}

let serifCached: Promise<Buffer> | undefined;

// The icon routes draw one letter, so they load Spectral alone rather than
// all three faces. Lazy for the same reason as above.
export function loadSerifFont(): Promise<Buffer> {
  serifCached ??= readFile(join(process.cwd(), "src/assets/og-fonts", "spectral-500.ttf"));
  return serifCached;
}
