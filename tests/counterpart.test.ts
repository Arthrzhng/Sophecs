import { describe, it, expect } from "vitest";
import {
  authorForSeq,
  checkBody,
  checkQuote,
  isLapsed,
  quoteIsFromSource,
  quoteSourceForSeq,
  MAX_TURN_CHARS,
  MIN_TURN_CHARS,
} from "../src/lib/counterpart";

const SOURCE =
  "Epictetus sorts the world in two.\nWhat is up to us is judgement;\n  everything else is not.";

describe("quoteIsFromSource", () => {
  it("matches across the line breaks a browser selection picks up", () => {
    expect(quoteIsFromSource("What is up to us is judgement;", SOURCE)).toBe(true);
    expect(quoteIsFromSource("up to us is judgement; everything else is not.", SOURCE)).toBe(true);
  });

  it("ignores case and runs of whitespace", () => {
    expect(quoteIsFromSource("EPICTETUS   SORTS   the world", SOURCE)).toBe(true);
  });

  it("rejects a sentence the counterpart never wrote", () => {
    expect(quoteIsFromSource("Bentham sorts the world in two.", SOURCE)).toBe(false);
  });

  it("rejects an empty or whitespace-only quote", () => {
    expect(quoteIsFromSource("   ", SOURCE)).toBe(false);
  });
});

describe("checkQuote", () => {
  it("names the specific problem rather than just failing", () => {
    expect(checkQuote("too short", SOURCE)).toBe("too_short");
    expect(checkQuote("x".repeat(301), SOURCE)).toBe("too_long");
    expect(checkQuote("a sentence from somewhere else entirely", SOURCE)).toBe("not_found");
    expect(checkQuote("What is up to us is judgement;", SOURCE)).toBeNull();
  });
});

describe("checkBody", () => {
  it("enforces both ends of the range, on the trimmed text", () => {
    expect(checkBody("x".repeat(MIN_TURN_CHARS - 1))).toBe("too_short");
    expect(checkBody("x".repeat(MIN_TURN_CHARS))).toBeNull();
    expect(checkBody("x".repeat(MAX_TURN_CHARS))).toBeNull();
    expect(checkBody("x".repeat(MAX_TURN_CHARS + 1))).toBe("too_long");
    // Padding with whitespace does not buy length.
    expect(checkBody(`${" ".repeat(50)}${"x".repeat(MIN_TURN_CHARS - 1)}`)).toBe("too_short");
  });
});

describe("turn order", () => {
  it("alternates strictly, opener first", () => {
    expect(authorForSeq(1, "a", "b")).toBe("a");
    expect(authorForSeq(2, "a", "b")).toBe("b");
    expect(authorForSeq(3, "a", "b")).toBe("a");
    expect(authorForSeq(4, "a", "b")).toBe("b");
  });

  it("answers arguments first, then replies", () => {
    expect(quoteSourceForSeq(1)).toBe("argument");
    expect(quoteSourceForSeq(2)).toBe("argument");
    expect(quoteSourceForSeq(3)).toBe("previous_turn");
    expect(quoteSourceForSeq(4)).toBe("previous_turn");
  });
});

describe("isLapsed", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("is false inside fourteen days and true after", () => {
    expect(isLapsed("2026-09-10T12:00:00Z", now)).toBe(false);
    expect(isLapsed("2026-09-06T12:00:01Z", now)).toBe(false);
    expect(isLapsed("2026-09-06T11:59:00Z", now)).toBe(true);
  });
});
