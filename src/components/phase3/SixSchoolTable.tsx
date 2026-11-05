import { RANK_MIN_ARGUMENTS, unrankedNote } from "@/lib/school-table";

/**
 * The school table with six rows: Phase 3.0 preview only (Stage 4 of the
 * brief of 2026-11-03).
 *
 * A school is ranked once it has RANK_MIN_ARGUMENTS judged original
 * arguments in the week (Arthur's ruling (e)5 of 2026-11-05), the live
 * table's rule; until then its row says so instead of showing a rank.
 * Copy: docs/daily-path-copy.md, "School table, a school not yet ranked".
 */

export interface SixSchoolRow {
  id: string;
  name: string;
  /** A CSS colour: a token reference for a live school, a candidate for a draft. */
  colour: string;
  /** Judged original arguments this week. */
  arguments: number;
  /** Mean fidelity, 0 to 10; null when there is nothing to average. */
  fidelity: number | null;
}

export function SixSchoolTable({ rows }: { rows: SixSchoolRow[] }) {
  const ranked = rows
    .filter((r) => r.arguments >= RANK_MIN_ARGUMENTS && r.fidelity !== null)
    .sort((a, b) => (b.fidelity ?? 0) - (a.fidelity ?? 0));
  const unranked = rows.filter((r) => !ranked.includes(r));

  return (
    <ol className="space-y-3">
      {ranked.map((row, i) => (
        <Row key={row.id} row={row} rank={i + 1} />
      ))}
      {unranked.map((row) => (
        <Row
          key={row.id}
          row={row}
          rank={null}
          note={unrankedNote(row.arguments)}
        />
      ))}
    </ol>
  );
}

// The live table's pattern (src/components/table/SchoolTable.tsx): the rank
// is read out as "Rank N" or "Not ranked yet", and the digit, or the null
// glyph, is decoration.
function Row({ row, rank, note }: { row: SixSchoolRow; rank: number | null; note?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border-2 border-rule bg-surface px-4 py-3">
      <span className="min-w-10 text-center">
        <span className="sr-only">{rank == null ? "Not ranked yet" : `Rank ${rank}`}</span>
        <span aria-hidden="true" className="font-mono tabular text-lg font-extrabold text-ink">
          {rank ?? "\u2014"}
        </span>
      </span>
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: row.colour }} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-extrabold text-ink">{row.name}</span>
        {note && <span className="block text-sm text-ink-mid">{note}</span>}
      </span>
      <span className="flex flex-col text-right">
        <span className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">Fidelity</span>
        <strong className="font-mono tabular text-base text-ink">
          {row.fidelity === null ? "—" : row.fidelity.toFixed(1)}
        </strong>
      </span>
    </li>
  );
}
