"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import {
  FIXTURE_POSTS,
  FIXTURE_SUBMISSIONS,
  FIXTURE_THREADS,
} from "@/lib/data/fixtures";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { SUBMISSION_MAX_CHARS, type ForumChannel } from "@/lib/types";

// Mutations write to Supabase when configured. Without credentials they write
// to the in-memory fixture arrays instead, which keeps the forum and debate
// flows demonstrable end-to-end in local development (state resets with the
// dev server; that's the point of a fixture).

export async function createThread(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth");

  const channel = String(formData.get("channel") ?? "") as ForumChannel;
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return;

  let threadId: string;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("threads")
      .insert({ channel, profile_id: profile.id, title })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "thread insert failed");
    threadId = data.id;
    await supabase
      .from("posts")
      .insert({ thread_id: threadId, profile_id: profile.id, body });
  } else {
    threadId = `t-${Date.now()}`;
    const created_at = new Date().toISOString();
    FIXTURE_THREADS.push({
      id: threadId,
      channel,
      profile_id: profile.id,
      title,
      created_at,
    });
    FIXTURE_POSTS.push({
      id: `post-${Date.now()}`,
      thread_id: threadId,
      profile_id: profile.id,
      body,
      created_at,
    });
  }

  revalidatePath("/forum");
  redirect(`/forum/${threadId}`);
}

export async function createPost(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth");

  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) return;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase
      .from("posts")
      .insert({ thread_id: threadId, profile_id: profile.id, body });
  } else {
    FIXTURE_POSTS.push({
      id: `post-${Date.now()}`,
      thread_id: threadId,
      profile_id: profile.id,
      body,
      created_at: new Date().toISOString(),
    });
  }

  revalidatePath(`/forum/${threadId}`);
}

export async function submitArgument(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth");

  const motionId = String(formData.get("motion_id") ?? "");
  const side = formData.get("side") === "against" ? "against" : "for";
  const body = String(formData.get("body") ?? "")
    .trim()
    .slice(0, SUBMISSION_MAX_CHARS);
  if (!motionId || !body) return;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase
      .from("submissions")
      .insert({ motion_id: motionId, profile_id: profile.id, side, body });
  } else {
    FIXTURE_SUBMISSIONS.push({
      id: `s-${Date.now()}`,
      motion_id: motionId,
      profile_id: profile.id,
      side,
      body,
      created_at: new Date().toISOString(),
    });
  }

  revalidatePath("/debate");
}
