import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SettingsPage } from "@/components/me/SettingsPage";
import {
  getJoinedClasses,
  getOwnedClasses,
  normaliseClassCode,
  type ClassSummary,
  type JoinedClass,
} from "@/lib/classes";

export const metadata = { title: "Settings · Sophecs" };

interface SettingsProfileRow {
  display_name: string | null;
  argument_default_public: boolean;
}

export default async function MeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>;
}) {
  const { join } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/me/settings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, argument_default_public")
    .eq("id", user.id)
    .maybeSingle<SettingsProfileRow>();

  // A shared class link lands here with ?join=CODE, which pre-fills the
  // field rather than joining on a GET — a link that changes state when
  // someone merely opens it is a link a browser prefetcher can fire.
  let owned: ClassSummary[] = [];
  let joined: JoinedClass[] = [];
  if (isAdminConfigured()) {
    const admin = createAdminClient();
    [owned, joined] = await Promise.all([
      getOwnedClasses(admin, user.id),
      getJoinedClasses(admin, user.id),
    ]);
  }

  // The container is written out rather than taken from <Page>, because
  // the daily-path wrapper has to sit on <main>; see the note on /me.
  return (
    <main className="flex-1" data-daily-path>
      <SettingsPage
        displayName={profile?.display_name ?? null}
        argumentDefaultPublic={profile?.argument_default_public ?? false}
        owned={owned}
        joined={joined}
        prefillCode={join ? normaliseClassCode(join) : undefined}
      />
    </main>
  );
}
