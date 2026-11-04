// Colour candidates for the three new schools, for Checkpoint A.
//
// Stage 4 of the brief of 2026-11-03 asks for three candidates for each new
// school, under constraints this script measures rather than eyeballs:
//
// - AA contrast for white text on the Today hero banner, which is the
//   school colour with white text at 90% opacity on it;
// - visible as a small dot on cream: 3:1 against --color-paper, WCAG's
//   bar for a graphical object;
// - distinct from Stoic green, Utilitarian ochre and Virtue oxblood by
//   CIEDE2000 20 or more, and from the judge's right-answer blue and the
//   step-done orange by 15 or more. The second bar is lower because those
//   two are interface colours, not schools, and a school's colour never
//   appears without its name; at 20 the only hues left are violets;
// - distinguishable from the existing three schools under deuteranopia and
//   protanopia, simulated with Machado, Oliveira and Fernandes (2009) at
//   full severity, in linear RGB;
// - no culturally stereotyped choice: no red or gold for Confucianism, no
//   saffron for Buddhist ethics, no kente or earth palette for Ubuntu.
//   These are hue exclusions, written below with the hues they cover.
//
// It writes docs/phase3-styleguide/colour-candidates.json, which the
// styleguide page renders, and prints a table. It decides nothing: the
// colours are Arthur's (CLAUDE.md, item (e)).
//
// Usage: node scripts/colour-candidates.mjs
import fs from "node:fs";

// ---- colour maths ----------------------------------------------------------
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgbToHex = (rgb) =>
  "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
const lum = (rgb) => {
  const [r, g, b] = rgb.map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// What the browser paints: text at 90% opacity, blended in sRGB.
const over = (fg, bg, alpha) => fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]);

// OKLCH to sRGB (Björn Ottosson's OKLab), null when out of gamut.
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  if (lin.some((c) => c < -1e-4 || c > 1 + 1e-4)) return null;
  return lin.map((c) => toSrgb(Math.min(1, Math.max(0, c))));
}

// sRGB to CIELAB (D65), for CIEDE2000.
function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(toLin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// CIEDE2000 (Sharma, Wu and Dalal, 2005).
function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h = (a, b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const h1p = h(a1p, b1);
  const h2p = h(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  );
}

// Machado, Oliveira and Fernandes (2009), severity 1.0, on linear RGB.
const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};
function simulate(rgb, kind) {
  const lin = rgb.map(toLin);
  return CVD[kind].map((row) => toSrgb(Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))));
}
const dE = (a, b) => deltaE2000(rgbToLab(a), rgbToLab(b));
const dECvd = (a, b, kind) => dE(simulate(a, kind), simulate(b, kind));

// ---- the palette it must fit ----------------------------------------------
// From src/app/globals.css.
const WHITE = [1, 1, 1];
const PAPER = hexToRgb("#f7f3ea");
const SCHOOLS = { stoic: "#3e5c4b", utilitarian: "#8a6320", virtue: "#7a3540" };
const OTHERS = { "correct (judge blue)": "#1e5fa0", "step-done orange": "#d9822b" };

// src/lib/card-tokens.ts CARD_INK: the near-white the result card sets its
// text in, at as little as 0.8 opacity (src/components/card/CardLayout.tsx).
const CARD_INK = hexToRgb("#faf8f2");
const CARD_INK_LOWEST_OPACITY = 0.8;

const MIN_WHITE_TEXT = 4.5;
const MIN_DOT_ON_PAPER = 3;
const MIN_DE = 20; // to the three schools, normal vision
const MIN_DE_OTHERS = 15; // to the blue and the orange, normal vision
const MIN_DE_CVD = 12; // to the three schools, each simulation
const MIN_DE_BETWEEN = 10; // between any two candidates offered, normal vision

// Hues each school may not take, in OKLCH degrees, with what they cover.
// For reference, OKLCH puts red near 25, orange near 55, gold and yellow
// near 75 to 110, green near 145, cyan near 195, blue near 255, violet
// near 300 and magenta near 340.
const EXCLUDED = {
  confucian: [
    [340, 360, "red"],
    [0, 45, "red"],
    [65, 115, "gold"],
  ],
  buddhist: [[40, 95, "saffron, orange to yellow"]],
  ubuntu: [
    [25, 110, "earth palette: terracotta, browns, ochres, and kente's gold"],
    [130, 160, "kente's green"],
  ],
};
const excludedBy = (school, H) =>
  EXCLUDED[school].find(([lo, hi]) => H >= lo && H < hi)?.[2] ?? null;

// ---- search ----------------------------------------------------------------
const pool = [];
// Integer steps, so float error cannot drop the last one (0.34 + 11 * 0.02
// summed in floats overshoots 0.56).
for (let Li = 0; Li <= 11; Li++) {
  const L = 0.34 + Li * 0.02;
  for (let C = 0.05; C <= 0.17; C += 0.01) {
    for (let H = 0; H < 360; H += 5) {
      const rgb = oklchToRgb(L, C, H);
      if (!rgb) continue;
      const hex = rgbToHex(rgb);
      const q = hexToRgb(hex);
      const textOnHero = contrast(over(WHITE, q, 0.9), q);
      if (textOnHero < MIN_WHITE_TEXT) continue;
      const dot = contrast(q, PAPER);
      if (dot < MIN_DOT_ON_PAPER) continue;
      const dENormal = Math.min(...Object.values(SCHOOLS).map((h) => dE(q, hexToRgb(h))));
      if (dENormal < MIN_DE) continue;
      const dEOthers = Math.min(...Object.values(OTHERS).map((h) => dE(q, hexToRgb(h))));
      if (dEOthers < MIN_DE_OTHERS) continue;
      const dEDeut = Math.min(...Object.values(SCHOOLS).map((h) => dECvd(q, hexToRgb(h), "deuteranopia")));
      const dEProt = Math.min(...Object.values(SCHOOLS).map((h) => dECvd(q, hexToRgb(h), "protanopia")));
      if (Math.min(dEDeut, dEProt) < MIN_DE_CVD) continue;
      pool.push({ hex, rgb: q, L, C, H, textOnHero, dot, dENormal, dEOthers, dEDeut, dEProt });
    }
  }
}

// Three candidates per school, nine different colours in all. The schools
// take turns, one pick each per round, so no school gets all the best
// ones. Each pick is the allowed colour that stays furthest from the
// existing schools under the worst of the three views, at least
// MIN_DE_BETWEEN from every colour already offered, and 10° of hue from
// its own school's other candidates. Only the three chosen will ever sit
// together, so it is the recommended set below, not every pair of the
// nine, that has to survive the simulations. Chroma is capped at 0.15:
// the existing schools sit at about 0.05 (Stoic) to 0.10 (the other two),
// and without the cap the search reaches for the loudest violets.
const worst = (c) => Math.min(c.dENormal, c.dEDeut, c.dEProt);
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const NEW = ["confucian", "ubuntu", "buddhist"];
const byschool = Object.fromEntries(NEW.map((s) => [s, []]));
const offered = [];
const ranked = [...pool].filter((c) => c.C <= 0.15).sort((a, b) => worst(b) - worst(a));
for (let round = 0; round < 3; round++) {
  for (const school of NEW) {
    const pick = ranked.find(
      (c) =>
        !excludedBy(school, c.H) &&
        offered.every((o) => dE(o.rgb, c.rgb) >= MIN_DE_BETWEEN) &&
        byschool[school].every((p) => hueGap(p.H, c.H) >= 10)
    );
    if (!pick) throw new Error(`no candidate left for ${school} in round ${round + 1}`);
    byschool[school].push(pick);
    offered.push(pick);
  }
}

// The recommended set: one per school, chosen so the three new colours
// are as far from each other as possible under all three views. Nothing
// holds that distance to MIN_DE_CVD: no set of the 27 reaches 12, and the
// best one's smallest difference (11.4) is reported as it is.
let best = null;
for (const a of byschool.confucian)
  for (const b of byschool.ubuntu)
    for (const c of byschool.buddhist) {
      const set = [a, b, c];
      let min = Infinity;
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++) {
          min = Math.min(
            min,
            dE(set[i].rgb, set[j].rgb),
            dECvd(set[i].rgb, set[j].rgb, "deuteranopia"),
            dECvd(set[i].rgb, set[j].rgb, "protanopia")
          );
        }
      if (!best || min > best.min) best = { set: set.map((s) => s.hex), min };
    }

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// The result card's own surface, as the live schools have one darker than
// their marker (--color-*-surface): the candidate's hue and chroma at the
// highest lightness, in 0.005 steps down, where the card's ink at its
// lowest opacity still reads at AA.
const inkOn = (surface, opacity) => contrast(over(CARD_INK, surface, opacity), surface);
function cardSurfaceFor(c) {
  for (let step = 0; c.L - step * 0.005 > 0.1; step++) {
    const L = c.L - step * 0.005;
    const rgb = oklchToRgb(L, c.C, c.H);
    if (!rgb) continue;
    const q = hexToRgb(rgbToHex(rgb));
    if (inkOn(q, CARD_INK_LOWEST_OPACITY) >= MIN_WHITE_TEXT) return q;
  }
  throw new Error(`no card surface for ${c.hex}`);
}
const describe = (c) => ({
  hex: c.hex,
  oklch: { L: round(c.L, 2), C: round(c.C, 2), H: c.H },
  textOnHero: round(c.textOnHero, 2),
  dotOnPaper: round(c.dot, 2),
  minDeltaE: round(c.dENormal),
  minDeltaEBlueOrange: round(c.dEOthers),
  minDeltaEDeuteranopia: round(c.dEDeut),
  minDeltaEProtanopia: round(c.dEProt),
  deuteranopia: rgbToHex(simulate(c.rgb, "deuteranopia")),
  protanopia: rgbToHex(simulate(c.rgb, "protanopia")),
  ...(() => {
    const surface = cardSurfaceFor(c);
    return {
      cardSurface: rgbToHex(surface),
      cardInkFull: round(inkOn(surface, 1), 2),
      cardInkAtLowestOpacity: round(inkOn(surface, CARD_INK_LOWEST_OPACITY), 2),
    };
  })(),
});
const existing = Object.fromEntries(
  Object.entries({ ...SCHOOLS, ...OTHERS }).map(([k, h]) => [
    k,
    {
      hex: h,
      deuteranopia: rgbToHex(simulate(hexToRgb(h), "deuteranopia")),
      protanopia: rgbToHex(simulate(hexToRgb(h), "protanopia")),
      textOnHero: round(contrast(over(WHITE, hexToRgb(h), 0.9), hexToRgb(h)), 2),
    },
  ])
);
const out = {
  what: "Colour candidates for the three new schools, from scripts/colour-candidates.mjs. Arthur's to choose; nothing here is in use.",
  thresholds: { MIN_WHITE_TEXT, MIN_DOT_ON_PAPER, MIN_DE, MIN_DE_OTHERS, MIN_DE_CVD, MIN_DE_BETWEEN },
  excluded: EXCLUDED,
  existing,
  candidates: Object.fromEntries(NEW.map((s) => [s, byschool[s].map(describe)])),
  recommended: { confucian: best.set[0], ubuntu: best.set[1], buddhist: best.set[2], minPairwiseDeltaE: round(best.min) },
  poolSize: pool.length,
};
fs.mkdirSync("docs/phase3-styleguide", { recursive: true });
fs.writeFileSync("docs/phase3-styleguide/colour-candidates.json", JSON.stringify(out, null, 2) + "\n");

console.log(`${pool.length} colours pass every constraint before the per-school hue exclusions\n`);
for (const s of NEW) {
  console.log(s);
  for (const c of out.candidates[s])
    console.log(
      `  ${c.hex}  H ${String(c.oklch.H).padStart(3)}  white text ${c.textOnHero}:1  dot ${c.dotOnPaper}:1  ` +
        `dE ${c.minDeltaE}  blue/orange ${c.minDeltaEBlueOrange}  deut ${c.minDeltaEDeuteranopia}  prot ${c.minDeltaEProtanopia}`
    );
}
console.log(`\nrecommended: ${JSON.stringify(out.recommended)}`);
