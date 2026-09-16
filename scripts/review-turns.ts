// Reviews counterpart turns that the screen held, and turns that a
// participant reported. Each screen shows the quoted claim, the reply, and
// why it was held or reported; you approve it, remove it, or skip.
//
//   npm run review:turns
//
// Approving sets screen_result = 'ok', which delivers it and unblocks the
// author — a held turn stops them posting again in that exchange, so an
// unreviewed queue is a stalled exchange, not just a moderation backlog.
// Removing sets 'removed', and the exchange page then shows both parties
// one line saying a reply was removed.
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (loaded
// from .env.local by the npm script).
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

interface TurnRow {
  id: string;
  exchange_id: string;
  seq: number;
  quoted_claim: string;
  body: string;
  screen_result: string;
  screen_reason: string | null;
  created_at: string;
}

interface ReportRow {
  id: string;
  turn_id: string;
  reason: string;
  note: string | null;
  created_at: string;
}

function rule(): void {
  console.log("\n" + "─".repeat(72));
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const [{ data: flagged }, { data: reports }] = await Promise.all([
    admin
      .from("turns")
      .select("id, exchange_id, seq, quoted_claim, body, screen_result, screen_reason, created_at")
      .eq("screen_result", "flagged")
      .order("created_at", { ascending: true }),
    admin
      .from("reports")
      .select("id, turn_id, reason, note, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const queue: { turn: TurnRow; reports: ReportRow[] }[] = [];
  const byId = new Map<string, TurnRow>();
  for (const turn of (flagged as TurnRow[] | null) ?? []) {
    byId.set(turn.id, turn);
    queue.push({ turn, reports: [] });
  }

  // A reported turn is reviewed too, even though it was screened `ok` and
  // is visible — a report is a human saying the screen got it wrong.
  const reportsByTurn = new Map<string, ReportRow[]>();
  for (const report of (reports as ReportRow[] | null) ?? []) {
    const list = reportsByTurn.get(report.turn_id) ?? [];
    list.push(report);
    reportsByTurn.set(report.turn_id, list);
  }
  const extraIds = [...reportsByTurn.keys()].filter((id) => !byId.has(id));
  if (extraIds.length > 0) {
    const { data: reported } = await admin
      .from("turns")
      .select("id, exchange_id, seq, quoted_claim, body, screen_result, screen_reason, created_at")
      .in("id", extraIds);
    for (const turn of (reported as TurnRow[] | null) ?? []) {
      queue.push({ turn, reports: [] });
      byId.set(turn.id, turn);
    }
  }
  for (const item of queue) {
    item.reports = reportsByTurn.get(item.turn.id) ?? [];
  }

  if (queue.length === 0) {
    console.log("Nothing to review: no held turns, no open reports.");
    rl.close();
    return;
  }

  console.log(`${queue.length} to review.`);

  for (const [index, { turn, reports: turnReports }] of queue.entries()) {
    rule();
    console.log(`${index + 1}/${queue.length}  turn ${turn.id}  exchange ${turn.exchange_id}  reply ${turn.seq}`);
    console.log(`state: ${turn.screen_result}${turn.screen_reason ? `  (${turn.screen_reason})` : ""}`);
    for (const report of turnReports) {
      console.log(`report: ${report.reason}${report.note ? ` — ${report.note}` : ""}`);
    }
    console.log(`\nanswering:\n  "${turn.quoted_claim}"`);
    console.log(`\nreply:\n${turn.body}\n`);

    const answer = (await rl.question("[a]pprove  [r]emove  [s]kip  [q]uit > ")).trim().toLowerCase();
    if (answer === "q") break;
    if (answer === "s" || answer === "") continue;

    if (answer === "a") {
      await admin.from("turns").update({ screen_result: "ok" }).eq("id", turn.id);
      // Approving a held turn delivers it, so the exchange has to move on:
      // the other party is now owed a reply.
      await advanceExchange(turn);
      console.log("approved.");
    } else if (answer === "r") {
      await admin.from("turns").update({ screen_result: "removed" }).eq("id", turn.id);
      console.log("removed.");
    } else {
      console.log("skipped.");
      continue;
    }

    if (turnReports.length > 0) {
      await admin
        .from("reports")
        .update({ resolved_at: new Date().toISOString() })
        .in("id", turnReports.map((r) => r.id));
    }
  }

  rl.close();
}

// Mirrors what /api/counterpart/turn does on a clean screen: flip the turn,
// or complete the exchange if this was the fourth reply.
async function advanceExchange(turn: TurnRow): Promise<void> {
  const { data: exchange } = await admin
    .from("exchanges")
    .select("id, user_a, user_b, status")
    .eq("id", turn.exchange_id)
    .maybeSingle();
  if (!exchange || exchange.status !== "open") return;

  const { data: authorRow } = await admin
    .from("turns")
    .select("author_id")
    .eq("id", turn.id)
    .maybeSingle();
  const author = authorRow?.author_id as string | null;
  const complete = turn.seq >= 4;

  await admin
    .from("exchanges")
    .update({
      next_turn: complete ? null : author === exchange.user_a ? exchange.user_b : exchange.user_a,
      last_turn_at: new Date().toISOString(),
      ...(complete ? { status: "complete" } : {}),
    })
    .eq("id", exchange.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
