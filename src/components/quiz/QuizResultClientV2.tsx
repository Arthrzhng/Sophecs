"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ResultCard } from "@/components/card/ResultCard";
import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { ShareSheet } from "@/components/share/ShareSheet";
import { ChunkyButton, ChunkyLink } from "@/components/daily-path/ChunkyButton";
import { SchoolMap, type MapSchool } from "@/components/phase3/SchoolMap";
import { ChallengeButton } from "@/components/share/ChallengeButton";
import { PENDING_RESULT_KEY_V2, type PendingResultV2 } from "@/components/quiz/QuizShellV2";
import { submitQuizResultV2 } from "@/app/actions";
import { track } from "@/lib/analytics/client";
import { pickShareLineFrom } from "@/lib/share-line";
import { SCHOOL_ADHERENT, SCHOOL_ARTICLE } from "@/lib/school-colors";
import type { SchoolContent } from "@/lib/schools";
import type { SchoolId } from "@/lib/types";

/**
 * Quiz v2's result, on a SIX_SCHOOLS build (docs/stage5-plan.md, step 4).
 * The same page as v1's QuizResultClient, with the reader's point on the
 * map beside their card: rendered at once from what QuizShellV2 scored,
 * while submitQuizResultV2 scores the answers again on the server and saves
 * the row. If the server's school differs, the page takes the server's.
 *
 * Saving a v2 result does not move a profile's school (Gate 2, option (i)),
 * so "Start my path" leads to the school the account already has, if any.
 */
export function QuizResultClientV2({
  schools,
  mapSchools,
  axes,
}: {
  schools: Partial<Record<SchoolId, SchoolContent>>;
  mapSchools: MapSchool[];
  axes: { x: [string, string]; y: [string, string] };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingResultV2 | null>(null);
  const [saved, setSaved] = useState<{ id: string; primary: SchoolId } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let parsed: PendingResultV2 | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_RESULT_KEY_V2);
      parsed = raw ? (JSON.parse(raw) as PendingResultV2) : null;
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.version !== 2 || !schools[parsed.primary]) {
      router.replace("/quiz");
      return;
    }
    setPending(parsed);
    const p = parsed;

    submitQuizResultV2({ answers: p.answers, challengeId: p.challengeId, referrer: p.referrer }).then((result) => {
      if (!result.ok) {
        setFailed(true);
        return;
      }
      track({
        name: "quiz_completed",
        props: { school: result.primary, secondary: result.secondary, duration_ms: p.durationMs, result_id: result.id },
      });
      if (p.challengeId && result.challengerSchool) {
        track({
          name: "challenge_accepted",
          props: { challenge_id: p.challengeId, challenger_school: result.challengerSchool, challengee_school: result.primary },
        });
      }
      try {
        sessionStorage.removeItem(PENDING_RESULT_KEY_V2);
      } catch {
        // Non-fatal.
      }
      // As v1 does: the address becomes the result's own, without a navigation.
      window.history.replaceState(null, "", `/r/${result.id}`);
      setSaved({ id: result.id, primary: result.primary });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pending) return null;

  const primary = saved?.primary ?? pending.primary;
  const school = schools[primary];
  if (!school) return null;
  const resultId = saved?.id ?? null;
  const shareLine = resultId ? pickShareLineFrom(school.share_lines, resultId) : null;

  return (
    <Page width="read">
      <div>
        <p className="text-sm text-ink-mid">You argue like {SCHOOL_ARTICLE[primary]}</p>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight text-ink">{SCHOOL_ADHERENT[primary]}</h1>

        <div className="mt-5">
          <ResultCard school={primary} oneLine={school.one_line} oneLineAttribution={school.one_line_attribution} />
        </div>

        <div className="mt-6">
          <SchoolMap
            title="Where your answers put you, on the map of the schools"
            schools={mapSchools}
            axes={axes}
            reader={pending.point}
            caption="Where your answers put you"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <ChunkyLink href="/today" school={primary}>
            Start my path
          </ChunkyLink>
        </div>

        <p className="mt-4 text-sm text-ink-mid">Your card names your school, never you.</p>

        {!resultId && !failed && <p className="mt-6 text-sm text-ink-soft">Saving your result…</p>}

        {resultId && shareLine && (
          <div className="mt-6">
            <ShareSheet resultId={resultId} school={primary} shareLine={shareLine.text} shareLineIndex={shareLine.index} />
          </div>
        )}

        {failed && (
          <div className="mt-6">
            <ErrorState
              title="Couldn't save this result."
              body="The card above is correct and the case for your school is below. What a save buys you is a link worth sharing, so try again in a moment if you want one."
              action={
                <ChunkyButton tone="paper" className="border-2 border-rule-strong" onClick={() => window.location.reload()}>
                  Try again
                </ChunkyButton>
              }
            />
          </div>
        )}

        <section className="mt-12 border-t-2 border-rule pt-8">
          <p className="text-sm text-ink-mid">The case for your school</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight text-ink">{school.name}</h2>
          <div className="prose-reading mt-5 text-ink">
            {school.read.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-soft">{school.one_line_attribution}</p>
          <p className="mt-4 text-sm">
            <TextLink href={`/s/${primary}`}>What this school gets wrong</TextLink>
          </p>
        </section>

        <section className="mt-12 border-t-2 border-rule pt-8">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Now defend it</h2>
          <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
            The quiz gives you a starting position. The rest of Sophecs is about
            holding it: take a motion, write a case, and get scored on how
            faithfully you argue from {school.name} — not on whether anyone agrees.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/debate"
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-ink bg-ink px-5 text-sm font-medium text-paper hover:border-ink-mid hover:bg-ink-mid"
            >
              Take a motion
            </Link>
            {resultId && <ChallengeButton resultId={resultId} school={primary} variant="secondary" />}
            <TextLink href="/lessons" className="text-sm">
              Read the lessons
            </TextLink>
          </div>
        </section>
      </div>
    </Page>
  );
}
