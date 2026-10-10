import { notFound, redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  ExchangeView,
  type ExchangeStatus,
} from "@/components/counterpart/ExchangeView";
import { isLapsed, quoteSourceForSeq, MAX_SEQ } from "@/lib/counterpart";
import type { SchoolId } from "@/lib/types";

export const metadata = { title: "Counterpart · Sophecs" };

interface TurnRow {
  id: string;
  author_id: string | null;
  seq: number;
  quoted_claim: string;
  body: string;
  screen_result: "pending" | "ok" | "flagged" | "removed";
}

// Participants only. A non-participant gets 404 rather than 403 — that
// someone else's private exchange exists is not information this route
// should confirm.
export default async function CounterpartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/counterpart/${id}`)}`);

  if (!isAdminConfigured()) notFound();
  const admin = createAdminClient();

  const { data: exchange } = await admin
    .from("exchanges")
    .select(
      "id, topic_slug, debate_a, debate_b, user_a, user_b, school_a, school_b, status, publish_a, publish_b, next_turn, last_turn_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!exchange || (exchange.user_a !== user.id && exchange.user_b !== user.id)) notFound();

  const iAmA = exchange.user_a === user.id;
  const mySchool = (iAmA ? exchange.school_a : exchange.school_b) as SchoolId;
  const theirSchool = (iAmA ? exchange.school_b : exchange.school_a) as SchoolId;
  const myDebateId = iAmA ? exchange.debate_a : exchange.debate_b;
  const theirDebateId = iAmA ? exchange.debate_b : exchange.debate_a;
  const theirUserId = iAmA ? exchange.user_b : exchange.user_a;

  // Lapse is closed on view rather than by a job: an exchange nobody opens
  // does no harm sitting open, and the only person who needs to see it
  // closed is whoever opens it.
  let status = exchange.status as string;
  if (status === "open" && isLapsed(exchange.last_turn_at as string)) {
    await admin.from("exchanges").update({ status: "lapsed", next_turn: null }).eq("id", id);
    status = "lapsed";
  }

  const [{ data: topic }, { data: debates }, { data: turnRows }] = await Promise.all([
    admin.from("debate_topics").select("motion, title").eq("slug", exchange.topic_slug).maybeSingle(),
    admin.from("debates").select("id, argument").in("id", [myDebateId, theirDebateId]),
    admin
      .from("turns")
      .select("id, author_id, seq, quoted_claim, body, screen_result")
      .eq("exchange_id", id)
      .order("seq", { ascending: true }),
  ]);
  if (!topic) notFound();

  const argumentById = new Map((debates ?? []).map((d) => [d.id as string, d.argument as string]));
  const turns = (turnRows as TurnRow[] | null) ?? [];

  // What each party may read. The admin client bypasses RLS, so the same
  // rule the policy encodes is applied here explicitly: a screened turn is
  // visible to both, an unscreened one only to its author.
  const visible = turns.filter((t) => t.screen_result === "ok" || t.author_id === user.id);
  const myHeld = turns.find((t) => t.author_id === user.id && t.screen_result === "flagged");
  const anyRemoved = turns.some((t) => t.screen_result === "removed");

  const nextSeq = turns.length + 1;
  const myTurn = status === "open" && exchange.next_turn === user.id && nextSeq <= MAX_SEQ;

  // The text the next reply must quote from.
  let sourceText = "";
  let sourceLabel = "";
  if (myTurn) {
    if (quoteSourceForSeq(nextSeq) === "argument") {
      sourceText = argumentById.get(theirDebateId as string) ?? "";
      sourceLabel = "their argument";
    } else {
      const theirLast = [...visible]
        .reverse()
        .find((t) => t.author_id !== user.id && t.screen_result === "ok");
      sourceText = theirLast?.body ?? "";
      sourceLabel = "their last reply";
    }
  }

  // The container is written out rather than taken from <Page>, because
  // the daily-path wrapper has to sit on <main>; see the note on /me.
  return (
    <main className="flex-1">
      <ExchangeView
        exchangeId={id}
        userId={user.id}
        topicSlug={exchange.topic_slug as string}
        myDebateId={myDebateId as string}
        motion={topic.motion as string}
        mySchool={mySchool}
        theirSchool={theirSchool}
        myArgument={argumentById.get(myDebateId as string) ?? ""}
        theirArgument={argumentById.get(theirDebateId as string) ?? ""}
        turns={visible.map((turn) => ({
          id: turn.id,
          seq: turn.seq,
          mine: turn.author_id === user.id,
          quotedClaim: turn.quoted_claim,
          body: turn.body,
          held: turn.screen_result !== "ok",
        }))}
        counterpartLeft={!theirUserId}
        anyRemoved={anyRemoved}
        myHeld={Boolean(myHeld)}
        status={status as ExchangeStatus}
        myTurn={myTurn}
        nextSeq={nextSeq}
        sourceLabel={sourceLabel}
        sourceText={sourceText}
        publishMine={Boolean(iAmA ? exchange.publish_a : exchange.publish_b)}
        publishTheirs={Boolean(iAmA ? exchange.publish_b : exchange.publish_a)}
      />
    </main>
  );
}
