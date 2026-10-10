import Link from "next/link";
import { TurnComposer } from "./TurnComposer";
import { TurnActions } from "./TurnActions";
import { ExchangePublishToggle } from "./PublishToggle";
import { SCHOOL_COLORS, SCHOOL_TEXT_CLASS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

/** One reply, as the page shows it. `mine` replaces the author comparison. */
export interface ViewTurn {
  id: string;
  seq: number;
  mine: boolean;
  quotedClaim: string;
  body: string;
  /** Screened and not cleared. Only its own author sees it at all. */
  held: boolean;
}

export type ExchangeStatus = "open" | "complete" | "lapsed" | "blocked";

function Argument({
  eyebrow,
  school,
  text,
}: {
  eyebrow: string;
  school: SchoolId;
  text: string;
}) {
  return (
    <div className="rounded-card border-2 border-rule bg-surface p-5">
      <p className={`text-sm font-bold ${SCHOOL_TEXT_CLASS[school]}`}>{eyebrow}</p>
      <p className="mt-3 whitespace-pre-wrap font-serif text-base leading-relaxed text-ink">
        {text || "This argument is no longer available."}
      </p>
    </div>
  );
}

/**
 * The exchange, as a page.
 *
 * Presentational, because the route needs two debates, a row of turns and
 * a participant to read them as, which means it cannot be looked at while
 * it is being built. Who is who arrives as `mine` on each turn rather than
 * as an id to compare against, so a fixture does not have to invent a user.
 *
 * Two schools are on screen and only one of them is the reader's. Every
 * marker here names a speaker; the one control that is a primary action,
 * sending a reply, takes the reader's own school. See docs/decisions.md.
 */
export function ExchangeView({
  exchangeId,
  userId,
  topicSlug,
  myDebateId,
  motion,
  mySchool,
  theirSchool,
  myArgument,
  theirArgument,
  turns,
  counterpartLeft,
  anyRemoved,
  myHeld,
  status,
  myTurn,
  nextSeq,
  sourceLabel,
  sourceText,
  publishMine,
  publishTheirs,
}: {
  exchangeId: string;
  userId: string;
  topicSlug: string;
  myDebateId: string;
  motion: string;
  mySchool: SchoolId;
  theirSchool: SchoolId;
  myArgument: string;
  theirArgument: string;
  turns: ViewTurn[];
  counterpartLeft: boolean;
  anyRemoved: boolean;
  /** The reader's own reply is held: they see it, nobody else does yet. */
  myHeld: boolean;
  status: ExchangeStatus;
  myTurn: boolean;
  nextSeq: number;
  sourceLabel: string;
  sourceText: string;
  publishMine: boolean;
  publishTheirs: boolean;
}) {
  return (
    <div className="mx-auto max-w-read px-6 py-10">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
        Counterpart
      </p>
      <h1 className="mt-2 max-w-[40ch] font-serif text-xl font-medium leading-tight text-ink">
        {motion}
      </h1>

      {counterpartLeft && (
        <p className="mt-6 text-sm text-ink-mid">Your counterpart has left.</p>
      )}
      {anyRemoved && (
        <p className="mt-4 text-sm text-ink-mid">
          A reply was removed for breaking the rules.
        </p>
      )}

      {/* Stacked at 375 px, side by side from `sm` up. */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Argument
          eyebrow={`You · ${SCHOOL_COLORS[mySchool].name}`}
          school={mySchool}
          text={myArgument}
        />
        <Argument
          eyebrow={`Counterpart · ${SCHOOL_COLORS[theirSchool].name}`}
          school={theirSchool}
          text={theirArgument}
        />
      </div>

      {turns.length > 0 && (
        <div className="mt-12 flex flex-col gap-5 border-t-2 border-rule pt-10">
          {turns.map((turn) => (
            <div key={turn.id} className="rounded-card border-2 border-rule bg-surface p-5">
              {/* Whose reply this is, in their school's colour. The marker
                  names the speaker; it is never on a control, which
                  belongs to whoever presses it. */}
              <p
                className={`text-sm font-bold ${
                  turn.mine ? SCHOOL_TEXT_CLASS[mySchool] : SCHOOL_TEXT_CLASS[theirSchool]
                }`}
              >
                {turn.mine ? "You" : "Counterpart"} &middot; Reply {turn.seq}
                {turn.held && " · held for review"}
              </p>
              <blockquote className="mt-3 max-w-[60ch] border-l-2 border-rule pl-4 font-serif text-base italic leading-relaxed text-ink-mid">
                {turn.quotedClaim}
              </blockquote>
              <p className="mt-4 max-w-[60ch] whitespace-pre-wrap font-serif text-base leading-relaxed text-ink">
                {turn.body}
              </p>
              {!turn.mine && <TurnActions turnId={turn.id} exchangeId={exchangeId} />}
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 border-t-2 border-rule pt-10">
        {myHeld ? (
          <p className="text-sm text-ink-mid">This reply was held for review.</p>
        ) : status === "blocked" ? (
          <p className="text-sm text-ink-mid">This exchange is closed.</p>
        ) : status === "lapsed" ? (
          <p className="text-sm text-ink-mid">
            This exchange lapsed after two weeks without a reply.
          </p>
        ) : status === "complete" ? (
          <div>
            <p className="text-sm text-ink-mid">
              Four replies, and it&apos;s finished. Neither of you has to concede.
            </p>
            <div className="mt-6">
              <ExchangePublishToggle
                exchangeId={exchangeId}
                initial={publishMine}
                otherAgreed={publishTheirs}
              />
            </div>
          </div>
        ) : myTurn ? (
          <TurnComposer
            exchangeId={exchangeId}
            seq={nextSeq}
            userId={userId}
            sourceLabel={sourceLabel}
            sourceText={sourceText}
            // Your school, because you are the one sending. Your
            // counterpart's colour is on their words, not on your button.
            school={mySchool}
          />
        ) : (
          <p className="text-sm text-ink-mid">Waiting for your counterpart.</p>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-6">
        <Link
          href={`/debate/${topicSlug}/${myDebateId}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Your verdict
        </Link>
        <Link
          href="/debate/rubric"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
        >
          Counterpart rules
        </Link>
      </div>
    </div>
  );
}
