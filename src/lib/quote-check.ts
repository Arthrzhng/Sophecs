/**
 * Checking that a quotation is really the source's words.
 *
 * Phase 1 produced a passage in which a sentence attributed to a Pali
 * sermon contained a clause that was not in the research file at all. It
 * had been written from memory, it read exactly like the rest of the
 * paragraph, and it survived a review. The citation was right; the
 * wording was not. Checking footnotes would never have found it.
 *
 * So this checks wording. A content file declares the quotations it is
 * making, each one has to appear verbatim in the research file, and any
 * difference between the research file's words and the content's words
 * has to be named rather than merely happening.
 *
 * Pure, and free of `server-only`, so the test can use it.
 */

/**
 * The editorial changes a quotation is allowed, each of which has to be
 * declared one at a time. Anything not on this list is not an editorial
 * change, it is a different sentence.
 */
export type QuoteException =
  /** The source has it mid-sentence; the content opens with it. */
  | { kind: "capitalise-first" }
  /** The content runs it on after a colon, so the capital goes. */
  | { kind: "lowercase-first" }
  /** The source quotes a clause; the content ends a sentence with it. */
  | { kind: "add-full-stop" }
  /** The content runs it into more of its own sentence. */
  | { kind: "drop-full-stop" }
  /** An attribution the content inserts inside the quotation. */
  | { kind: "interpolate"; text: string }
  /** A span of the source the content leaves out, named in full. */
  | { kind: "omit"; text: string };

export interface DeclaredQuote {
  /** The words exactly as the research file has them. */
  source: string;
  /** Every way the content differs from them. */
  exceptions?: QuoteException[];
  /** Why this is quoted at all, for a reader of the manifest. */
  note?: string;
}

export interface FileQuotes {
  /** Quotations, each verified against the research file. */
  quotes: DeclaredQuote[];
  /**
   * Passages that restate the source in the writer's own words. Declared
   * rather than checked, because a paraphrase is allowed to differ; the
   * point of listing one is that the writer had to decide which it was.
   */
  paraphrases?: { text: string; why: string }[];
}

/** Whitespace and quote marks only, as the rule says. */
export function normalise(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function flipFirst(text: string, to: "upper" | "lower"): string {
  if (text.length === 0) return text;
  const first = to === "upper" ? text[0].toUpperCase() : text[0].toLowerCase();
  return first + text.slice(1);
}

/**
 * The quotation as the content is allowed to print it, after every
 * declared change has been applied in turn.
 */
export function applyExceptions(source: string, exceptions: QuoteException[] = []): string {
  let text = normalise(source);
  for (const exception of exceptions) {
    switch (exception.kind) {
      case "capitalise-first":
        text = flipFirst(text, "upper");
        break;
      case "lowercase-first":
        text = flipFirst(text, "lower");
        break;
      case "add-full-stop":
        text = text.endsWith(".") ? text : `${text}.`;
        break;
      case "drop-full-stop":
        text = text.replace(/\.$/, "");
        break;
      case "interpolate":
        // Handled on the content side, by taking the inserted phrase out
        // before looking for the quotation. The phrase belongs to the
        // content, not to the source, so removing it from the source
        // would be looking for something that was never there.
        break;
      case "omit":
        text = normalise(text.replace(normalise(exception.text), " "));
        break;
    }
  }
  return text;
}

/** The quotation as the content should print it. */
export function expected(quote: DeclaredQuote): string {
  return applyExceptions(quote.source, quote.exceptions);
}

/**
 * The content with everything that is not the source's words taken out:
 * footnote markers, which are file syntax, and any attribution the
 * content inserts inside a quotation.
 */
export function searchableContent(content: string, declared: FileQuotes): string {
  let text = normalise(content).replace(/\[\^\d+\]/g, " ");
  const inserted = declared.quotes.flatMap((q) =>
    (q.exceptions ?? [])
      .filter((e): e is Extract<QuoteException, { kind: "interpolate" }> => e.kind === "interpolate")
      .map((e) => normalise(e.text))
  );
  for (const phrase of inserted) text = text.split(phrase).join(" ");
  return normalise(text);
}

export interface QuoteProblem {
  file: string;
  source: string;
  reason: "not in research file" | "not in content";
  detail?: string;
}

/** Every problem with one file's declared quotations. Empty means sound. */
export function quoteProblems(
  file: string,
  declared: FileQuotes,
  content: string,
  research: string
): QuoteProblem[] {
  const haystackResearch = normalise(research);
  const haystackContent = searchableContent(content, declared);
  const problems: QuoteProblem[] = [];

  for (const quote of declared.quotes) {
    const source = normalise(quote.source);
    if (!haystackResearch.includes(source)) {
      problems.push({ file, source: quote.source, reason: "not in research file" });
      continue;
    }
    const wanted = expected(quote);
    if (!haystackContent.includes(wanted)) {
      problems.push({ file, source: quote.source, reason: "not in content", detail: wanted });
    }
  }
  return problems;
}

/**
 * Spans a reader would take for the source's own words.
 *
 * A reporting cue plus a clause is how this content quotes: it has no
 * quotation marks, by house style. Every sentence carrying one has to be
 * accounted for in the manifest as either a quotation or a paraphrase, so
 * that "I did not notice I was quoting" stops being available.
 */
const CUES = [
  "it says",
  "the passage says",
  "the chapter says",
  "the passage runs",
  "he writes",
  "the Master says",
  "quote whole",
];

export function cueSentences(body: string): string[] {
  return normalise(body)
    .split(/(?<=\.)\s+/)
    .filter((sentence) => CUES.some((cue) => sentence.includes(cue)));
}
