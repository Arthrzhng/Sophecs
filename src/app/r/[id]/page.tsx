import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ResultCard } from "@/components/card/ResultCard";
import { ShareSheet } from "@/components/share/ShareSheet";
import { Page } from "@/components/layout/Page";
import { TextLink } from "@/components/ui/TextLink";
import { ChallengeButton } from "@/components/share/ChallengeButton";
import { DebateThemButton } from "@/components/share/DebateThemButton";
import { CardViewTracker } from "@/components/card/CardViewTracker";
import { getSchool, pickShareLine } from "@/lib/schools";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { QuizResultRow, SchoolId } from "@/lib/types";
import { ButtonLink } from "@/components/ui/Button";

function schoolDisplayName(id: SchoolId): string {
  return SCHOOL_COLORS[id].name;
}

export const revalidate = 86400; // s-maxage=86400 — result rows never change

async function getResult(id: string): Promise<QuizResultRow | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("public_results")
    .select("id, school, secondary, vector, challenge_from, created_at")
    .eq("id", id)
    .single();
  return (data as QuizResultRow) ?? null;
}

async function getOwnerAnonId(id: string): Promise<string | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("quiz_results").select("anon_id").eq("id", id).single();
  return (data?.anon_id as string | undefined) ?? null;
}

// True once a signed-in user has claimed this exact result — separate from
// isOwner (an anon_id cookie match), which stays true even after claiming.
async function getOwnerUserId(id: string): Promise<string | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("quiz_results").select("user_id").eq("id", id).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

interface ChallengeInfo {
  challengeId: string;
  otherResultId: string;
  status: string;
}

// Checks both directions — this result may be the original challenger's or
// the person who accepted it — and only returns a challenge once both
// sides exist ("with both sides present," per the brief).
async function getChallengeInfo(id: string): Promise<ChallengeInfo | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("challenges")
    .select("id, challenger_result_id, challengee_result_id, status")
    .or(`challenger_result_id.eq.${id},challengee_result_id.eq.${id}`)
    .not("challengee_result_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const otherResultId = data.challenger_result_id === id ? data.challengee_result_id : data.challenger_result_id;
  if (!otherResultId) return null;
  return { challengeId: data.id, otherResultId, status: data.status };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getResult(id);
  if (!result) return { title: "Sophecs" };
  const school = getSchool(result.school);
  return {
    title: `${school.name} · Sophecs`,
    description: school.one_line,
    openGraph: {
      title: `${school.name} · Sophecs`,
      description: school.one_line,
      images: [`/r/${id}/opengraph-image`],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Phase 2c: the only two additions this route gets, per the brief —
  // "Debate them" once a challenge has both sides, and a claimed-by-you
  // indicator. Everything above is untouched Phase 1 behavior.
  //
  // All of these are independent lookups (none depends on another's
  // result), so they run as one parallel batch rather than a waterfall of
  // sequential round trips — this route can't be cached (it reads
  // cookies), so every load used to pay for three round trips in series.
  const supabase = await createSupabaseServerClient();
  const [result, cookieStore, headerList, ownerAnonId, ownerUserId, challengeInfo, userResult] =
    await Promise.all([
      getResult(id),
      cookies(),
      headers(),
      getOwnerAnonId(id),
      getOwnerUserId(id),
      getChallengeInfo(id),
      supabase.auth.getUser(),
    ]);
  if (!result) notFound();

  const viewerAnonId = cookieStore.get("anon_id")?.value;
  const isOwner = Boolean(viewerAnonId && ownerAnonId && viewerAnonId === ownerAnonId);
  const referrer = headerList.get("referer") ?? "";
  const user = userResult.data.user;
  const isSavedToProfile = Boolean(user && ownerUserId && user.id === ownerUserId);

  const school = getSchool(result.school);
  const challengerFromLink = result.challenge_from ? await getResult(result.challenge_from) : null;
  const otherResult =
    challengerFromLink ?? (challengeInfo ? await getResult(challengeInfo.otherResultId) : null);
  const { text: shareLine, index: shareLineIndex } = pickShareLine(result.school, result.id);
  const showDebateThem = Boolean(challengeInfo && challengeInfo.status !== "complete");

  // A cold recipient — not the owner, no challenge in play — gets the card
  // and one action. Everything else on this page is for someone who already
  // has a result of their own; showing a stranger four competing next steps
  // is how a shared link stops converting.
  const coldRecipient = !isOwner && !showDebateThem && !otherResult;

  return (
    <Page width="read">
      <CardViewTracker resultId={id} school={result.school} isOwner={isOwner} referrer={referrer} />

      <p className="text-sm text-ink-soft">
        {isOwner ? "Your school" : "Someone shared their result"}
        {isSavedToProfile && " · saved to your profile"}
      </p>

      <div className="mt-4">
        <ResultCard
          school={result.school}
          oneLine={school.one_line}
          oneLineAttribution={school.one_line_attribution}
        />
      </div>

      {coldRecipient ? (
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-ink bg-ink px-5 text-sm font-medium text-paper hover:border-ink-mid hover:bg-ink-mid"
          >
            Take the quiz
          </Link>
          <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
            Ten questions on how AI should decide things. No account needed,
            about eighty seconds.
          </p>
        </div>
      ) : (
        <>
          {/* Percentages live here and nowhere else: beside a second result,
              where a three-way split is a comparison rather than decoration. */}
          {otherResult && (
            <div className="mt-8 grid grid-cols-2 gap-6 border-t border-rule pt-6">
              <VectorColumn label="This result" vector={result.vector} />
              <VectorColumn label="Whoever sent it" vector={otherResult.vector} />
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {showDebateThem && (
              <DebateThemButton
                challengeId={challengeInfo!.challengeId}
                resultId={id}
                isSignedIn={Boolean(user)}
              />
            )}
            <ChallengeButton
              resultId={id}
              school={result.school}
              variant={showDebateThem ? "secondary" : "primary"}
            />
          </div>

          <div className="mt-6">
            <ShareSheet
              resultId={id}
              school={result.school}
              shareLine={shareLine}
              shareLineIndex={shareLineIndex}
            />
          </div>

          <section className="mt-12 border-t border-rule pt-8">
            <h2 className="font-serif text-lg font-medium text-ink">Now defend it</h2>
            <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-ink-mid">
              A result is a starting position, not a verdict. Take a motion and
              defend it — you are scored on how faithfully you argue from{" "}
              {schoolDisplayName(result.school)}, not on whether we agree.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <ButtonLink variant="secondary"
                href="/debate"
              >
                Take a motion
              </ButtonLink>
              <TextLink href={`/s/${result.school}`} className="text-sm">
                Read the case for {schoolDisplayName(result.school)}
              </TextLink>
              <TextLink href="/lessons" className="text-sm">
                Read the lessons
              </TextLink>
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

function VectorColumn({ label, vector }: { label: string; vector: QuizResultRow["vector"] }) {
  const order: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">{label}</p>
      <dl className="space-y-1 text-sm">
        {order.map((id) => (
          <div key={id} className="flex justify-between gap-4">
            <dt className="text-ink-mid">{schoolDisplayName(id)}</dt>
            <dd className="font-mono tabular text-ink">{Math.round(vector[id] * 100)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
