import { SCHOOL_COLORS } from "@/lib/school-colors";
import { TRIANGLE, vectorToPoint } from "@/lib/quiz-position";
import type { SchoolId, SchoolVector } from "@/lib/types";

const CORNER: Record<SchoolId, string> = {
  stoicism: "var(--color-stoic)",
  utilitarianism: "var(--color-utilitarian)",
  "virtue-ethics": "var(--color-virtue)",
};

/**
 * Where the reader sits between the three schools, and where the answer
 * they have selected would move them.
 *
 * The weighting behind it is not new: every option has always carried a
 * three-school vector, and lib/scoring.ts has always summed them. This
 * draws that sum. It computes no score and decides nothing.
 *
 * The solid dot is the position from the answers already committed; the
 * dashed ring is the position the selected-but-not-yet-committed answer
 * would produce. Those two differ in shape, not only in colour, and the
 * figure carries an aria-label naming the two schools the reader currently
 * sits between, so the information is not locked inside the picture.
 */
export function SchoolTriangle({
  vector,
  previewVector,
  primary,
  secondary,
  previewLetter,
  neutral = false,
}: {
  /** Position from the answers already given. */
  vector: SchoolVector;
  /** Position including the currently selected answer, if there is one. */
  previewVector?: SchoolVector | null;
  primary: SchoolId;
  secondary: SchoolId;
  /** The A/B/C letter of the selected answer, for the caption. */
  previewLetter?: string | null;
  /** No answers committed yet, so there is no position to colour in. */
  neutral?: boolean;
}) {
  const here = vectorToPoint(vector);
  const preview = previewVector ? vectorToPoint(previewVector) : null;
  const schools = Object.keys(TRIANGLE.vertices) as SchoolId[];

  return (
    <figure className="m-0 flex flex-col items-center gap-2.5 rounded-panel border-2 border-rule bg-surface p-4">
      <svg
        viewBox={`0 0 ${TRIANGLE.width} ${TRIANGLE.height}`}
        role="img"
        // Before the first answer the "between X and Y" clause would name
        // two schools the reader has not leaned toward, so it is dropped
        // rather than filled with whichever two happen to sort first.
        aria-label={
          neutral
            ? "Your position so far"
            : `Your position so far, between ${SCHOOL_COLORS[primary].name} and ${SCHOOL_COLORS[secondary].name}`
        }
        className="w-full max-w-[280px]"
      >
        <polygon
          points={schools.map((s) => `${TRIANGLE.vertices[s].x},${TRIANGLE.vertices[s].y}`).join(" ")}
          fill="var(--color-paper)"
          stroke="var(--color-rule-strong)"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* The move the selected answer would make, drawn as a dashed line
            from where the reader is to where they would land. */}
        {preview && (
          <line
            x1={here.x}
            y1={here.y}
            x2={preview.x}
            y2={preview.y}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2"
            strokeDasharray="2 5"
            strokeLinecap="round"
          />
        )}

        {schools.map((s) => (
          <circle
            key={s}
            cx={TRIANGLE.vertices[s].x}
            cy={TRIANGLE.vertices[s].y}
            r="16"
            fill={CORNER[s]}
          />
        ))}

        {preview && (
          <circle
            cx={preview.x}
            cy={preview.y}
            r="10"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
        )}

        {/* Where the committed answers put the reader. Before the first
            answer there is no leaning to report, so the marker sits at the
            centre in plain ink rather than borrowing a school's colour. */}
        <circle
          cx={here.x}
          cy={here.y}
          r="10"
          fill={neutral ? "var(--color-ink-soft)" : CORNER[primary]}
          stroke="var(--color-surface)"
          strokeWidth="3"
        />
      </svg>

      {previewLetter && (
        <figcaption className="text-center text-sm text-ink-mid">
          The dashed ring shows where answer {previewLetter} moves you.
        </figcaption>
      )}
    </figure>
  );
}
