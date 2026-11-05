// The sentence a verdict page offers to share (verdictShareLine), and a
// school's share template without its "The judge's note:" sentence.
//
// For a private argument seen by someone other than its author, the
// verdict line is withheld (migration 0018: the judge quotes the
// argument), and the template's `The judge's note: {verdict_line}.` would
// otherwise read "The judge's note: ." The template lives in
// content/schools/*.md and is not edited here; tests/verdict-privacy.test.ts
// checks that every school's template carries the sentence in this form,
// so a reworded template fails a test rather than shipping a broken line.
import { SCHOOL_COLORS } from "./school-colors";
import type { SchoolId } from "./types";

export const JUDGES_NOTE_SENTENCE = /\s*The judge's\s+note:\s*\{verdict_line\}\.\s*/;

export function withoutJudgesNote(template: string): string {
  return template.replace(JUDGES_NOTE_SENTENCE, " ").trim();
}

/**
 * The share template for a verdict page: the school's own, or, for
 * someone other than the author of a private argument, the same without
 * its judge's-note sentence, whose verdict line is withheld.
 */
export function shareTemplateFor(template: string, textWithheld: boolean): string {
  return textWithheld ? withoutJudgesNote(template) : template;
}

export type VerdictShareInput = {
  /** A sample account's verdict: a template the judge never read. */
  sample: boolean;
  /** The school's `verdict_share_line`, from content/schools/*.md. */
  template: string;
  textWithheld: boolean;
  school: SchoolId;
  shortMotion: string;
  score: number | null;
  verdictLine: string | null | undefined;
  slug: string;
  debateId: string;
  /** A revision that answered its parent's objection, or null. */
  answeredObjection: { school: SchoolId; firstScore: number | null } | null;
};

/**
 * The sentence a verdict page offers to share.
 *
 * A sample account's page gets none, not even in the page's data: the
 * share row is not shown for one, and the sentence says "The judge's
 * note" about a verdict the judge never read.
 *
 * A revision that actually answered its objection gets its own line,
 * since the movement is the interesting part, not the absolute score. It
 * is built here rather than as a fourth per-school frontmatter field: it
 * is the same sentence for every school. Anything else (objection still
 * standing, or a v1 parent with no objection at all) falls back to the
 * school's ordinary line.
 */
export function verdictShareLine(v: VerdictShareInput): string {
  if (v.sample) return "";
  if (v.answeredObjection) {
    return (
      `Answered the ${SCHOOL_COLORS[v.answeredObjection.school].name} objection to my ` +
      `${SCHOOL_COLORS[v.school].name} case on ${v.shortMotion}: ` +
      `${v.answeredObjection.firstScore} → ${v.score}. sophecs.com/debate/${v.slug}/${v.debateId}`
    );
  }
  return shareTemplateFor(v.template, v.textWithheld)
    .replaceAll("{score}", String(v.score ?? ""))
    .replaceAll("{topic}", v.shortMotion)
    .replaceAll("{verdict_line}", v.verdictLine ?? "")
    .replaceAll("{slug}", v.slug)
    .replaceAll("{id}", v.debateId);
}
