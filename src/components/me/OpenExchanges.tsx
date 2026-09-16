import Link from "next/link";
import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

export interface ExchangeRow {
  id: string;
  topicTitle: string;
  theirSchool: SchoolId;
  myTurn: boolean;
}

// Two groups, and the one that needs something from you leads. Nothing is
// rendered at all when there is nothing waiting — an empty "Counterpart"
// heading on every profile would be a permanent reminder that a feature
// exists rather than a reason to open it.
export function OpenExchanges({ exchanges }: { exchanges: ExchangeRow[] }) {
  if (exchanges.length === 0) return null;

  const mine = exchanges.filter((e) => e.myTurn);
  const theirs = exchanges.filter((e) => !e.myTurn);

  return (
    <div className="space-y-8">
      {mine.length > 0 && (
        <div>
          <p className="eyebrow text-ink-soft mb-4">Your counterpart is waiting</p>
          <ul className="space-y-4">
            {mine.map((exchange) => (
              <li key={exchange.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`eyebrow-sm ${SCHOOL_TEXT_CLASS[exchange.theirSchool]}`}>
                    {SCHOOL_COLORS[exchange.theirSchool].name}
                  </p>
                  <p className="mt-1 font-serif text-base">{exchange.topicTitle}</p>
                </div>
                <Link
                  href={`/counterpart/${exchange.id}`}
                  className="min-h-11 inline-flex items-center rounded-md bg-ink px-5 text-sm font-medium text-surface hover:opacity-85"
                >
                  Reply
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {theirs.length > 0 && (
        <div>
          <p className="eyebrow text-ink-soft mb-4">Waiting on your counterpart</p>
          <ul className="space-y-3">
            {theirs.map((exchange) => (
              <li key={exchange.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`eyebrow-sm ${SCHOOL_TEXT_CLASS[exchange.theirSchool]}`}>
                    {SCHOOL_COLORS[exchange.theirSchool].name}
                  </p>
                  <Link
                    href={`/counterpart/${exchange.id}`}
                    className="mt-1 block font-serif text-base text-ink-mid hover:text-ink"
                  >
                    {exchange.topicTitle}
                  </Link>
                </div>
                <span className="font-mono text-xs text-ink-soft">Their turn</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
