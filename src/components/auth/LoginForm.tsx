"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics/client";
import { Button } from "@/components/ui/Button";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
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
        <label htmlFor="email" className="text-xs font-medium text-ink-mid block mb-1.5">
          Email
        </label>
        <div className="flex gap-2">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.org"
            className="flex-1 min-h-11 bg-surface border border-rule rounded-control px-3 text-sm placeholder:text-ink-soft"
          />
          <Button
            type="submit"
          >
            Send link
          </Button>
        </div>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px bg-rule flex-1" />
        <span className="font-mono text-xs text-ink-soft">or</span>
        <span className="h-px bg-rule flex-1" />
      </div>

      <Button variant="secondary"
        onClick={signInWithGoogle}
      >
        Continue with Google
      </Button>

      {status && (
        <p role="status" className="mt-5 font-mono text-xs text-ink-mid">
          {status}
        </p>
      )}
    </div>
  );
}
