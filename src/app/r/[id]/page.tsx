import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { CardViewTracker } from "@/components/card/CardViewTracker";
import { SharePage } from "@/components/share/SharePage";
import { getSchool, pickShareLine } from "@/lib/schools";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { QuizResultRow } from "@/lib/types";

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


  return (
    <>
      <CardViewTracker resultId={id} school={result.school} isOwner={isOwner} referrer={referrer} />
      <SharePage
        resultId={id}
        school={result.school}
        oneLine={school.one_line}
        oneLineAttribution={school.one_line_attribution}
        vector={result.vector}
        otherVector={otherResult?.vector ?? null}
        isOwner={isOwner}
        isSavedToProfile={isSavedToProfile}
        showDebateThem={showDebateThem}
        challengeId={challengeInfo?.challengeId ?? null}
        isSignedIn={Boolean(user)}
        shareLine={shareLine}
        shareLineIndex={shareLineIndex}
      />
    </>
  );
}
