"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/app/me/actions";
import { createClient } from "@/lib/supabase/client";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";

/**
 * Deleting an account, in two steps.
 *
 * Every word here, and every step, is exactly what it was. What changed is
 * the drawing: the error tone, which exists for this and nothing else, and
 * a real tap target on the control that opens the confirmation.
 *
 * The first step is outlined rather than filled. A solid red button sitting
 * permanently on the settings page is an invitation to press it, and the
 * one press that must be deliberate is this one; the fill arrives only once
 * the question has been asked.
 */
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
      <ChunkyButton
        tone="paper"
        onClick={() => setConfirming(true)}
        className="border-2 border-[color:var(--color-error)] text-[color:var(--color-error)]"
      >
        Delete account
      </ChunkyButton>
    );
  }

  return (
    <div className="rounded-card border-2 border-[color:var(--color-error)] bg-surface p-5">
      <p className="max-w-[50ch] text-sm leading-relaxed text-ink">
        This deletes your account and profile. Your quiz results and any
        share links stay up, just no longer attached to you.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <ChunkyButton
          tone="error"
          onClick={handleDelete}
          loading={pending}
          loadingLabel="Deleting…"
        >
          Confirm delete
        </ChunkyButton>
        <ChunkyButton
          tone="paper"
          onClick={() => setConfirming(false)}
          className="border-2 border-rule-strong"
        >
          Cancel
        </ChunkyButton>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
