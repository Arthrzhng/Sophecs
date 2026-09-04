import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { DisplayNameForm } from "@/components/me/DisplayNameForm";
import { ArgumentVisibilityToggle } from "@/components/me/ArgumentVisibilityToggle";
import { SignOutButton } from "@/components/me/SignOutButton";
import { DeleteAccountButton } from "@/components/me/DeleteAccountButton";

export const metadata = { title: "Settings · Sophecs" };

interface SettingsProfileRow {
  display_name: string | null;
  argument_default_public: boolean;
}

export default async function MeSettingsPage() {
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
