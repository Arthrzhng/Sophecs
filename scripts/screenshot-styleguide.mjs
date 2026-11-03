// Screenshots of /styleguide sections, at phone and desktop widths, for a
// pull request to show what changed. Each section is found by its heading
// text and captured on its own.
//
// Usage: node scripts/screenshot-styleguide.mjs <base url> <route> <out dir> "<heading>"...
// Needs the app running with SOPHECS_PREVIEW=1 at build time, which is what
// makes /styleguide render outside a Vercel preview.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

// Playwright is installed once for the machine, not as a dependency here,
// and only `require` finds it there.
const { chromium } = createRequire(import.meta.url)("playwright");

const [base, route, outDir, ...headings] = process.argv.slice(2);
if (!base || !route || !outDir || headings.length === 0) {
  console.error('usage: screenshot-styleguide.mjs <base> <route> <out dir> "<heading>"...');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const browser = await chromium.launch();
let failed = false;
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(new URL(route, base).toString(), { waitUntil: "networkidle" });
  for (const heading of headings) {
    const section = page.locator("section", { has: page.getByText(heading, { exact: true }) }).first();
    if ((await section.count()) === 0) {
      console.error(`not found at ${width}px: ${heading}`);
      failed = true;
      continue;
    }
    const file = path.join(outDir, `${slug(heading)}-${width}.png`);
    await section.screenshot({ path: file });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${file}${overflow ? "  (page scrolls sideways)" : ""}`);
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
