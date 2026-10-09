"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics/client";
import { ChunkyButton } from "@/components/daily-path/ChunkyButton";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * The two ways in.
 *
 * Both buttons are paper. Every other primary in the product is the
 * reader's own school colour, and a reader signing in does not have one:
 * this is the screen where they go to get one. Colouring it with a school
 * they have not been given would be the interface guessing. The hierarchy
 * is the layout instead, which is what the landing page does for the same
 * reason.
 */
export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) {
      setStatus("Sign-in isn't connected in this environment yet.");
      return;
    }
    track({ name: "signup_started", props: { method: "magic", next: next ?? "" } });
    // A magic link is a network round trip with nothing on screen to show
    // for it, so the button says what it is doing rather than sitting
    // there looking unpressed.
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setSending(false);
    setStatus(error ? error.message : `Check ${email} for a link.`);
  }

  async function signInWithGoogle() {
    if (!configured) {
      setStatus("Sign-in isn't connected in this environment yet.");
      return;
    }
    track({ name: "signup_started", props: { method: "google", next: next ?? "" } });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  }

  return (
    <div>
      <form onSubmit={sendMagicLink}>
        <label htmlFor="email" className="block text-sm font-bold text-ink">
          Email
        </label>
        {/* Stacked below sm: a 56px field and a 56px button side by side
            leave the field about 150px wide on a phone, which is not
            enough to read back an address you have just typed. */}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.org"
            className="min-h-14 flex-1 rounded-chunky border-2 border-rule-strong bg-surface px-4 text-base text-ink placeholder:text-ink-soft"
          />
          <ChunkyButton
            type="submit"
            tone="paper"
            loading={sending}
            loadingLabel="Sending…"
            className="border-2 border-rule-strong"
          >
            Send link
          </ChunkyButton>
        </div>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-0.5 flex-1 bg-rule" />
        <span className="text-sm text-ink-soft">or</span>
        <span className="h-0.5 flex-1 bg-rule" />
      </div>

      <ChunkyButton
        tone="paper"
        onClick={signInWithGoogle}
        className="w-full border-2 border-rule-strong"
      >
        Continue with Google
      </ChunkyButton>

      {/* Announced, and kept where the eye already is rather than at the
          foot of the page: the one thing this screen has to tell you is
          whether the link went. */}
      {status && (
        <p
          role="status"
          className="mt-6 rounded-card border-2 border-rule bg-surface p-4 text-sm leading-relaxed text-ink"
        >
          {status}
        </p>
      )}
    </div>
  );
}
