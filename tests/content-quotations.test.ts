import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  cueSentences,
  normalise,
  quoteProblems,
  applyExceptions,
  expected,
  searchableContent,
} from "../src/lib/quote-check";
import { DECLARED, REPORT_ONLY } from "./content-quotations";

const RESEARCH = fs.readFileSync(
  path.join(process.cwd(), "content/research/non-western-sources.md"),
  "utf8"
);
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("quote-check", () => {
  it("normalises whitespace and quote marks, and nothing else", () => {
    expect(normalise("a  \n b")).toBe("a b");
    expect(normalise("“x” ‘y’")).toBe("\"x\" 'y'");
    // Punctuation is not whitespace: a comma dropped from a quotation is a
    // different sentence, which is the whole point.
    expect(normalise("a, b")).not.toBe(normalise("a b"));
  });

  it("applies each declared exception and no others", () => {
    expect(applyExceptions("a sentence", [{ kind: "capitalise-first" }])).toBe("A sentence");
    expect(applyExceptions("A sentence", [{ kind: "lowercase-first" }])).toBe("a sentence");
    expect(applyExceptions("x", [{ kind: "add-full-stop" }])).toBe("x.");
    expect(applyExceptions("x.", [{ kind: "drop-full-stop" }])).toBe("x");
    expect(applyExceptions("keep this away", [{ kind: "omit", text: "this" }])).toBe("keep away");
  });

  it("takes an interpolated attribution out of the content, not the source", () => {
    const declared = {
      quotes: [
        { source: "one two", exceptions: [{ kind: "interpolate" as const, text: ", he said," }] },
      ],
    };
    expect(searchableContent("one, he said, two", declared)).toBe("one two");
    expect(expected(declared.quotes[0])).toBe("one two");
  });

  it("ignores footnote markers, which are file syntax and not words", () => {
    expect(searchableContent("a quotation.[^2] Then more.", { quotes: [] })).toBe(
      "a quotation. Then more."
    );
  });
});

describe("non-Western content quotations", () => {
  const files = Object.keys(DECLARED);

  it("covers every non-Western content file that carries a source", () => {
    const sourced: string[] = [];
    for (const dir of ["content/schools", "content/micro", "content/modules", "content/prompts"]) {
      for (const name of fs.readdirSync(path.join(process.cwd(), dir))) {
        if (!name.endsWith(".md") || name.toLowerCase() === "readme.md") continue;
        const file = `${dir}/${name}`;
        if (REPORT_ONLY.includes(file)) continue;
        const text = read(file);
        // Legacy micro-lessons cite editions the research file does not
        // hold; they are covered by the report-only block below.
        const nonWestern =
          file.endsWith("-elsewhere.md") ||
          /^content\/schools\/(confucian|ubuntu|buddhist)\.md$/.test(file) ||
          (dir === "content/modules" && /status:\s*draft/.test(text)) ||
          // The draft fidelity criteria, which quote the Nguni maxim the
          // Ubuntu school leads with. The judge prompts themselves quote
          // nothing, so only this one file in the directory is sourced.
          file === "content/prompts/fidelity-criteria.draft.md";
        if (nonWestern) sourced.push(file);
      }
    }
    expect(sourced.sort()).toEqual(files.sort());
  });

  it.each(files)("%s quotes the research file verbatim", (file) => {
    expect(quoteProblems(file, DECLARED[file], read(file), RESEARCH)).toEqual([]);
  });

  // The failure this exists for: a sentence that reads as the source's own
  // words but was written from memory. Every such sentence has to be
  // declared as one thing or the other.
  it.each(files)("%s accounts for every sentence that reads as a quotation", (file) => {
    const declared = DECLARED[file];
    const covered: string[] = [
      ...declared.quotes.map(expected),
      ...(declared.paraphrases ?? []).map((p) => normalise(p.text)),
    ];
    const body = searchableContent(read(file), declared);
    const unaccounted = cueSentences(body).filter(
      (sentence) => !covered.some((c) => sentence.includes(c))
    );
    expect(unaccounted).toEqual([]);
  });
});

// Changes nothing. Prints what cannot be traced, which for these files is
// everything, because their editions were never written down.
describe("original schools, report only", () => {
  it("reports quotations with no entry in the research file", () => {
    const untraceable: string[] = [];
    for (const file of REPORT_ONLY) {
      const text = read(file);
      const oneLine = /one_line: >-\n([\s\S]*?)\none_line_attribution:/.exec(text);
      if (!oneLine) continue;
      const quote = normalise(oneLine[1]);
      if (!normalise(RESEARCH).includes(quote)) untraceable.push(`${file}: ${quote}`);
    }
    console.log(
      `\n  Report only, nothing changed. ${untraceable.length} quotation(s) not in the research file:\n` +
        untraceable.map((u) => `    ${u}`).join("\n")
    );
    expect(untraceable.length).toBeLessThanOrEqual(REPORT_ONLY.length);
  });
});
