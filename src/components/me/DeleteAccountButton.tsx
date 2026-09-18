"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/app/me/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

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
        className="font-mono text-xs text-error hover:underline"
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
        <Button
          onClick={handleDelete}
          loading={pending}
          loadingLabel="Deleting…"
          className="border-error bg-error hover:border-error hover:bg-error"
        >
          Confirm delete
        </Button>
        <Button variant="quiet" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
      {error && <p className="mt-2 font-mono text-xs text-error">{error}</p>}
    </div>
  );
}
