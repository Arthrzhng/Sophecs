import Link from "next/link";
import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";

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
export function OpenExchanges({
  exchanges,
  school,
}: {
  exchanges: ExchangeRow[];
  /** The viewer's own school: replying is their action, not their
      counterpart's. Whose turn it is to speak is said in words. */
  school: SchoolId | null;
}) {
  if (exchanges.length === 0) return null;

  const mine = exchanges.filter((e) => e.myTurn);
  const theirs = exchanges.filter((e) => !e.myTurn);

  return (
    <div className="space-y-8">
      {mine.length > 0 && (
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            Your counterpart is waiting
          </h2>
          <ul className="mt-5 flex flex-col gap-3">
            {mine.map((exchange) => (
              <li
                key={exchange.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-rule bg-surface p-5"
              >
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${SCHOOL_TEXT_CLASS[exchange.theirSchool]}`}>
                    {SCHOOL_COLORS[exchange.theirSchool].name}
                  </p>
                  <p className="mt-1 font-serif text-base text-ink">{exchange.topicTitle}</p>
                </div>
                <ChunkyLink
                  href={`/counterpart/${exchange.id}`}
                  school={school ?? exchange.theirSchool}
                >
                  Reply
                </ChunkyLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      {theirs.length > 0 && (
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            Waiting on your counterpart
          </h2>
          <ul className="mt-5 flex flex-col gap-3">
            {theirs.map((exchange) => (
              <li
                key={exchange.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-rule bg-surface p-5"
              >
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${SCHOOL_TEXT_CLASS[exchange.theirSchool]}`}>
                    {SCHOOL_COLORS[exchange.theirSchool].name}
                  </p>
                  <Link
                    href={`/counterpart/${exchange.id}`}
                    className="mt-1 block font-serif text-base text-ink-mid underline-offset-4 hover:text-ink hover:underline"
                  >
                    {exchange.topicTitle}
                  </Link>
                </div>
                <span className="text-sm text-ink-soft">Their turn</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
