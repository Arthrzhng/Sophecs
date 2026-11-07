import { notFound } from "next/navigation";
import { SamplePageMarker } from "@/components/sample/SamplePageMarker";
import { SAMPLE_PAGE_REFERRER } from "@/lib/sample";
import { cookies, headers } from "next/headers";
import { CardViewTracker } from "@/components/card/CardViewTracker";
import { SharePage } from "@/components/share/SharePage";
import { getSchool, pickShareLine } from "@/lib/schools";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { viewerIsChallengeParty } from "@/lib/challenge";
import { PUBLIC_RESULT_COLUMNS, comparable, quizVersionOf, shownOnThisBuild } from "@/lib/quiz-result";
import { SchoolMap } from "@/components/phase3/SchoolMap";
import { QUIZ_V2_ON, quizV2, quizV2MapSchools } from "@/lib/quiz-v2";
import type { QuizResultRow } from "@/lib/types";

export const revalidate = 86400; // s-maxage=86400 — result rows never change

// A result this build does not show (a v2 result on a build without
// SIX_SCHOOLS, src/lib/quiz-result.ts) is answered as not found, as an
// unknown id is, and so is one as the other side of a comparison.
async function getResult(id: string): Promise<QuizResultRow | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("public_results")
    .select(PUBLIC_RESULT_COLUMNS)
    .eq("id", id)
    .single();
  const row = (data as QuizResultRow | null) ?? null;
  return row && shownOnThisBuild(row) ? row : null;
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

async function getResultOwners(id: string): Promise<{ anon_id: string | null; user_id: string | null } | null> {
  if (!isAdminConfigured()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("quiz_results").select("anon_id, user_id").eq("id", id).maybeSingle();
  return (data as { anon_id: string | null; user_id: string | null } | null) ?? null;
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
  // A sample account's result says so in the title and the link preview.
  const title = result.is_sample ? `${school.name} · Sample · Sophecs` : `${school.name} · Sophecs`;
  return {
    title,
    description: school.one_line,
    // A sample's page passes no referrer on (src/lib/sample.ts).
    ...(result.is_sample && { referrer: SAMPLE_PAGE_REFERRER }),
    openGraph: {
      title,
      description: school.one_line,
      images: [`/r/${id}/opengraph-image`],
    },
    twitter: { card: "summary_large_image", title },
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
  const challengeOther = challengeInfo ? await getResult(challengeInfo.otherResultId) : null;
  const otherResult = challengerFromLink ?? challengeOther;
  // The weights side by side only for two v1 results: a v2 result has none,
  // and the two quizzes asked different questions.
  const compareWith = otherResult && comparable(result, otherResult) ? otherResult : null;
  const { text: shareLine, index: shareLineIndex } = pickShareLine(result.school, result.id);
  // "Debate them" is for the challenge's two parties only. assignChallengeTopic
  // refuses anyone else, so for them it would end in an error; they get
  // the ordinary challenge button as the page's main action instead.
  const viewerIsParty =
    challengeInfo !== null &&
    viewerIsChallengeParty({ anonId: viewerAnonId, userId: user?.id }, [
      { anon_id: ownerAnonId, user_id: ownerUserId },
      await getResultOwners(challengeInfo.otherResultId),
    ]);
  // Only between two v1 results, on every build, until launch, so that a
  // challenge made on a SIX_SCHOOLS preview is not recorded, completed or
  // pairwise-rated in production (Gate 2, option (i)). resolveChallengeSide
  // refuses the same for assignChallengeTopic and /api/judge. A side this
  // build does not show reads as null here, so without SIX_SCHOOLS a v2
  // other side is never offered either.
  const showDebateThem = Boolean(
    challengeInfo &&
      challengeInfo.status !== "complete" &&
      viewerIsParty &&
      challengeOther &&
      comparable(result, challengeOther)
  );

  // A v2 result's point on the map, which only a SIX_SCHOOLS build shows.
  const figure =
    QUIZ_V2_ON && quizVersionOf(result) === 2 && typeof result.map_x === "number" && typeof result.map_y === "number" ? (
      <SchoolMap
        title="Where these answers put them, on the map of the schools"
        schools={quizV2MapSchools()}
        axes={quizV2().axes}
        reader={{ x: result.map_x, y: result.map_y }}
        caption="Where these answers landed"
        whose="their"
      />
    ) : null;


  return (
    <>
      {/* A view of a sample result is not a share converting, so it is
          not counted (docs/sample-activity.md, "Metrics"). */}
      {result.is_sample ? (
        <SamplePageMarker />
      ) : (
        <CardViewTracker resultId={id} school={result.school} isOwner={isOwner} referrer={referrer} />
      )}
      <SharePage
        resultId={id}
        school={result.school}
        oneLine={school.one_line}
        oneLineAttribution={school.one_line_attribution}
        vector={compareWith ? result.vector : null}
        otherVector={compareWith?.vector ?? null}
        hasOtherResult={otherResult !== null}
        isOwner={isOwner}
        isSavedToProfile={isSavedToProfile}
        showDebateThem={showDebateThem}
        challengeId={challengeInfo?.challengeId ?? null}
        isSignedIn={Boolean(user)}
        shareLine={shareLine}
        shareLineIndex={shareLineIndex}
        isSample={Boolean(result.is_sample)}
        figure={figure}
      />
    </>
  );
}
