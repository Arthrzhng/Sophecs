import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { ClassesSection } from "@/components/me/ClassesSection";
import {
  getJoinedClasses,
  getOwnedClasses,
  normaliseClassCode,
  type ClassSummary,
  type JoinedClass,
} from "@/lib/classes";
import { DisplayNameForm } from "@/components/me/DisplayNameForm";
import { ArgumentVisibilityToggle } from "@/components/me/ArgumentVisibilityToggle";
import { SignOutButton } from "@/components/me/SignOutButton";
import { DeleteAccountButton } from "@/components/me/DeleteAccountButton";

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

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-24">
        <p className="eyebrow text-ink-soft mb-4">Settings</p>

        <div>
          <p className="font-mono text-xs text-ink-soft mb-2">Display name</p>
          <DisplayNameForm initial={profile?.display_name ?? null} />
        </div>

        <div className="mt-10 border-t border-rule pt-8">
          <ArgumentVisibilityToggle initial={profile?.argument_default_public ?? false} />
        </div>

        <div className="mt-10 border-t border-rule pt-8">
          <p className="eyebrow text-ink-soft mb-4">Classes</p>
          <ClassesSection
            owned={owned}
            joined={joined}
            prefillCode={join ? normaliseClassCode(join) : undefined}
          />
        </div>

        <div className="mt-10 border-t border-rule pt-8">
          <SignOutButton />
        </div>

        <div className="mt-10 border-t border-rule pt-8">
          <p className="text-sm text-ink-mid max-w-[50ch] mb-3">
            Deleting your account removes your profile. It does not delete
            your quiz results — a share link should never go dead — it just
            unattaches them from you.
          </p>
          <DeleteAccountButton />
        </div>
      </div>
    </main>
  );
}
