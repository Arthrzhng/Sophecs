/**
 * Filling the `{{...}}` placeholders in a judge prompt.
 *
 * Its own module rather than a helper inside `src/lib/anthropic.ts` for two
 * reasons. That file is frozen, so the less of this logic lives there the
 * better; and a guard that throws needs a test that makes it throw, which
 * means it has to be callable without building a whole model request. A
 * reviewer found that the earlier in-place version could be reverted to a
 * silent `replace` with the suite still green.
 *
 * Three things here were each a real defect in the naive version:
 *
 * 1. **At most one occurrence.** `String.prototype.replace` with a string
 *    needle fills the first match and says nothing about the rest. A prompt
 *    file is sent to the model whole, HTML comment included, and
 *    `content/prompts/judge.v3.md` named both of its placeholders in its
 *    own header before using them, so the naive call filled the mention in
 *    the comment and left the real placeholder standing. The model would
 *    have been asked to score against a template with nothing to say so.
 *    `replaceAll` is the wrong fix: it would send the criteria twice.
 *
 * 2. **One pass over the raw template.** Filling placeholders one after
 *    another scans text an earlier fill inserted. Fidelity criteria are
 *    content somebody writes, so a criteria string that happened to contain
 *    `{{RIVAL_SCHOOLS}}` would have had the school list substituted into
 *    the middle of the criteria, silently changing a production prompt. The
 *    single regex pass below continues after each replacement and never
 *    re-reads what it inserted.
 *
 * 3. **A function replacer.** `replace(needle, value)` interprets `$&`,
 *    `` $` ``, `$'`, `$1`-`$99` and `$$` inside `value`. None of today's
 *    criteria contains a `$`; a future one is content, and content is not
 *    worth trusting with regex syntax.
 */

export interface Placeholder {
  value: string;
  /** Throw if the template does not contain it at all. */
  required: boolean;
}

const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

function escapeForRegExp(literal: string): string {
  return literal.replace(REGEXP_METACHARACTERS, "\\$&");
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Fill every placeholder in one pass, refusing a template that names one
 * more than once or omits a required one.
 *
 * Counting happens against the template as given, before anything is
 * substituted, so a value that looks like a placeholder cannot affect
 * the count or be filled in turn.
 */
export function fillPlaceholders(
  template: string,
  placeholders: Record<string, Placeholder>
): string {
  for (const [name, { required }] of Object.entries(placeholders)) {
    const occurrences = countOccurrences(template, name);
    if (occurrences > 1) {
      throw new Error(
        `judge prompt names ${name} ${occurrences} times; it must appear at most once`
      );
    }
    if (occurrences === 0 && required) {
      throw new Error(`judge prompt is missing ${name}`);
    }
  }

  const names = Object.keys(placeholders);
  if (names.length === 0) return template;

  const pattern = new RegExp(names.map(escapeForRegExp).join("|"), "g");
  return template.replace(pattern, (match) => placeholders[match].value);
}
