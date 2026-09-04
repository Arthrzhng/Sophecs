"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/app/me/actions";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const result = await deleteAccount();
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-mono text-xs text-oxblood hover:underline"
      >
        Delete account
      </button>
    );
  }

  return (
    <div>
      <p className="text-sm text-ink-mid max-w-[50ch]">
        This deletes your account and profile. Your quiz results and any
        share links stay up, just no longer attached to you.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="min-h-11 px-4 bg-oxblood text-surface rounded-md text-sm font-medium hover:opacity-85 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-11 px-4 text-sm text-ink-mid hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 font-mono text-xs text-oxblood">{error}</p>}
    </div>
  );
}
