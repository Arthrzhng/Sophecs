import Link from "next/link";
import { ResultCard } from "@/components/card/ResultCard";
import { ShareSheet } from "@/components/share/ShareSheet";
import { ChallengeButton } from "@/components/share/ChallengeButton";
import { DebateThemButton } from "@/components/share/DebateThemButton";
import { ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { QuizResultRow, SchoolId } from "@/lib/types";

export interface SharePageProps {
  resultId: string;
  school: SchoolId;
  oneLine: string;
  oneLineAttribution: string;
  vector: QuizResultRow["vector"];
  /** The other side of a challenge, when there is one. */
  otherVector: QuizResultRow["vector"] | null;
  isOwner: boolean;
  isSavedToProfile: boolean;
  showDebateThem: boolean;
  challengeId: string | null;
  isSignedIn: boolean;
  shareLine: string;
  shareLineIndex: number;
}

/**
 * The body of /r/[id], as a component rather than inline in the route.
 *
 * The route needs the admin client for four lookups, so it cannot render
 * anywhere without Supabase — which is every machine except a deployment.
 * Splitting the markup out is what lets /styleguide/arena draw it against
 * fixtures, which is the only way this page gets looked at while it is
 * being changed. The route keeps every lookup and the analytics tracker.
 *
 * The card itself is untouched. It renders from card-tokens.ts, which is
 * deliberately frozen against the site palette so that everything already
 * shared stays the colour it was shared as.
 */
export function SharePage({
  resultId,
  school,
  oneLine,
  oneLineAttribution,
  vector,
  otherVector,
  isOwner,
  isSavedToProfile,
  showDebateThem,
  challengeId,
  isSignedIn,
  shareLine,
  shareLineIndex,
}: SharePageProps) {
  const name = SCHOOL_COLORS[school].name;

  // A cold recipient — not the owner, no challenge in play — gets the card
  // and one action. Everything else on this page is for someone who already
  // has a result of their own; showing a stranger four competing next steps
  // is how a shared link stops converting.
  const coldRecipient = !isOwner && !showDebateThem && !otherVector;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-read px-6 py-10">
        <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">
          {isOwner ? "Your school" : "Someone shared their result"}
          {isSavedToProfile && " · saved to your profile"}
        </p>

        <div className="mt-4">
          <ResultCard
            school={school}
            oneLine={oneLine}
            oneLineAttribution={oneLineAttribution}
          />
        </div>

        {coldRecipient ? (
          <div className="mt-8">
            <ChunkyLink href="/" school={school}>
              Take the quiz
            </ChunkyLink>
            <p className="mt-6 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
              Ten questions on how AI should decide things. No account needed,
              about eighty seconds.
            </p>
          </div>
        ) : (
          <>
            {/* Percentages live here and nowhere else: beside a second
                result, where a three-way split is a comparison rather than
                decoration. */}
            {otherVector && (
              <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-4">
                <VectorColumn label="This result" vector={vector} />
                <VectorColumn label="Whoever sent it" vector={otherVector} />
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {showDebateThem && challengeId && (
                <DebateThemButton
                  challengeId={challengeId}
                  resultId={resultId}
                  isSignedIn={isSignedIn}
                  school={school}
                />
              )}
              <ChallengeButton
                resultId={resultId}
                school={school}
                variant={showDebateThem ? "secondary" : "primary"}
              />
            </div>

            <div className="mt-6">
              {/* Never the page's primary: the action row above it is
                  always either "Debate them" or "Challenge a friend". */}
              <ShareSheet
                resultId={resultId}
                school={school}
                shareLine={shareLine}
                shareLineIndex={shareLineIndex}
                primary={false}
              />
            </div>

            <section className="mt-12 border-t-2 border-rule pt-10">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">Now defend it</h2>
              <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
                A result is a starting position, not a verdict. Take a motion and
                defend it — you are scored on how faithfully you argue from{" "}
                {name}, not on whether we agree.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
                <ChunkyLink href="/debate" tone="paper">
                  Take a motion
                </ChunkyLink>
                <Link
                  href={`/s/${school}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
                >
                  Read the case for {name}
                </Link>
                <Link
                  href="/lessons"
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4"
                >
                  Read the lessons
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const ORDER: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

function VectorColumn({ label, vector }: { label: string; vector: QuizResultRow["vector"] }) {
  return (
    <div className="rounded-card border-2 border-rule bg-surface px-5 py-4">
      <p className="text-xs font-extrabold tracking-widest uppercase text-ink-mid">{label}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {ORDER.map((id) => (
          <div key={id} className="flex justify-between gap-4">
            <dt className="font-semibold text-ink-mid">{SCHOOL_COLORS[id].name}</dt>
            <dd className="font-mono tabular font-bold text-ink">
              {Math.round(vector[id] * 100)}%
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
