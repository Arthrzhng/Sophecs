"use server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { replyAsSample, sampleReplyMessage } from "@/lib/sample-reply";

/**
 * A sample account's reply, asked for by the reader whose exchange it is,
 * when the exchange page finds the sample's turn due (SampleReplyRequest).
 * Everything that decides whether it is written, and what it may cost, is
 * in replyAsSample; this only says who is asking.
 */
export async function requestSampleReply(
  exchangeId: string
): Promise<{ ok: true; delivered: boolean } | { ok: false; message: string; retry: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in.", retry: false };

  const result = await replyAsSample(createAdminClient(), exchangeId, user.id);
  if (result.ok) return { ok: true, delivered: true };
  const message = sampleReplyMessage(result.reason);
  // Not due: nothing to say, and the page reads the exchange again.
  // Trying again helps only a reply that failed to be written or passed;
  // a limit or the flag stays as it is until it lifts.
  const retry = result.reason === "failed" || result.reason === "held";
  return message ? { ok: false, message, retry } : { ok: true, delivered: false };
}
