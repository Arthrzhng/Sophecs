// A school's verdict share line without its "The judge's note:" sentence.
//
// For a private argument seen by someone other than its author, the
// verdict line is withheld (migration 0018: the judge quotes the
// argument), and the template's `The judge's note: {verdict_line}.` would
// otherwise read "The judge's note: ." The template lives in
// content/schools/*.md and is not edited here; tests/verdict-privacy.test.ts
// checks that every school's template carries the sentence in this form,
// so a reworded template fails a test rather than shipping a broken line.
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
