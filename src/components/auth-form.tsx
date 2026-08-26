"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) {
      setStatus("Sign-in isn't connected yet.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    setStatus(error ? error.message : `Magic link sent to ${email}.`);
  }

  async function signInWithOAuth(provider: "google" | "github") {
    if (!configured) {
      setStatus("Sign-in isn't connected yet.");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider });
  }

  return (
    <div>
      <form onSubmit={sendMagicLink}>
        <label htmlFor="email" className="text-xs font-medium text-ink-mid block mb-1.5">
          Email
        </label>
        <div className="flex gap-3">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.org"
            className="flex-1 bg-surface border border-rule rounded-btn px-3 py-2.5 text-sm placeholder:text-ink-soft"
          />
          <button
            type="submit"
            className="bg-ink text-surface rounded-btn px-4 py-2.5 text-sm font-medium hover:opacity-85"
          >
            Send link
          </button>
        </div>
      </form>

      <div className="my-8 flex items-center gap-4">
        <span className="h-px bg-rule flex-1" />
        <span className="font-mono text-xs text-ink-soft">or</span>
        <span className="h-px bg-rule flex-1" />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => signInWithOAuth("google")}
          className="w-full border border-rule bg-surface rounded-btn px-4 py-2.5 text-sm font-medium hover:border-ink-soft"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => signInWithOAuth("github")}
          className="w-full border border-rule bg-surface rounded-btn px-4 py-2.5 text-sm font-medium hover:border-ink-soft"
        >
          Continue with GitHub
        </button>
      </div>

      {status && (
        <p role="status" className="mt-6 font-mono text-xs text-ink-mid">
          {status}
        </p>
      )}
    </div>
  );
}
