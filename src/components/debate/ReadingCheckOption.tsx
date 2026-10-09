const LETTERS = ["A", "B", "C"];

function Tick() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * One answer on the reading check.
 *
 * Three columns, and the two outer ones are fixed: a letter badge, the
 * option, and a column that holds the mark. The mark column keeps its width
 * whether or not there is a mark in it, so checking an answer never makes
 * the text reflow underneath the reader's eye.
 *
 * The mark is what makes right and wrong legible without colour: a tick on
 * the answer and a cross on a wrong pick differ in shape, and either one is
 * also named for a screen reader. The tint and the border agree with the
 * mark rather than carrying the result alone, which matters for the
 * roughly one reader in twelve who would otherwise be told nothing.
 *
 * 66px rows and a 32px badge are the mockups' own measurements. The badge
 * takes the 10px badge radius rather than the 14px control one: at 32px
 * square, 14 is within 2px of a circle, and a circle here would read as a
 * path node.
 */
export function ReadingCheckOption({
  index,
  option,
  picked,
  isAnswer,
  checked,
  onPick,
}: {
  /** Position in the question, which decides the letter. */
  index: number;
  option: string;
  picked: boolean;
  isAnswer: boolean;
  /** True once the answer has been submitted; the row goes read-only. */
  checked: boolean;
  onPick: () => void;
}) {
  let row = "border-rule-strong bg-surface";
  let badge = "border-rule-strong text-ink-mid";
  let mark: "tick" | "cross" | null = null;
  let markColour = "";
  let dim = "";

  if (!checked && picked) {
    row = "border-ink bg-paper";
    badge = "border-ink bg-ink text-paper";
  }

  if (checked) {
    if (isAnswer) {
      row = "border-[color:var(--color-correct)] bg-[color:var(--color-correct-tint)]";
      badge = "border-[color:var(--color-correct)] bg-[color:var(--color-correct)] text-white";
      mark = "tick";
      markColour = "var(--color-correct)";
    } else if (picked) {
      row = "border-[color:var(--color-wrong)] bg-[color:var(--color-wrong-tint)]";
      badge = "border-[color:var(--color-wrong)] bg-[color:var(--color-wrong)] text-white";
      mark = "cross";
      markColour = "var(--color-wrong)";
    } else {
      dim = "opacity-50";
    }
  }

  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={checked}
      onClick={onPick}
      // The container scrolls the marked row back into view once an answer
      // is checked, since the feedback bar takes the space it was in.
      data-mark={mark ?? undefined}
      className={`chunky flex min-h-[66px] w-full items-center gap-4 rounded-chunky border-2 px-4 py-3 text-left text-base ${row} ${dim}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-badge border-2 font-mono text-sm font-bold ${badge}`}
      >
        {LETTERS[index]}
      </span>
      <span className="min-w-0 flex-1 text-ink">{option}</span>
      <span className="flex size-6 shrink-0 items-center justify-center" style={{ color: markColour }}>
        {mark === "tick" && <Tick />}
        {mark === "cross" && <Cross />}
        {/* The mark in words, for a reader who gets no shape and no colour.
            Only on the two rows that carry one; a row with no mark says
            nothing rather than saying it is neither. */}
        {mark && <span className="sr-only">{mark === "tick" ? "Correct answer" : "Your answer, wrong"}</span>}
      </span>
    </button>
  );
}
