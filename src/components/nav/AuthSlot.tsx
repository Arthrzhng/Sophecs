"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Auth state in the header without making every page dynamic, and without
// shipping the Supabase SDK to the landing page.
//
// Two constraints pull against each other here:
//
//   1. Reading the session in a *server* component would opt /, /quiz,
//      /lessons and /s/[school] out of static rendering — four route
//      groups including the whole acquisition path.
//   2. Calling supabase.auth.getUser() in a client component fixes that but
//      pulls ~90 KB of supabase-js into the initial chunk of every route
//      and adds a network round trip before the label resolves. Measured:
//      it cost the landing page 7 Lighthouse points and 600ms of LCP.
//
// So this reads the auth cookie directly. @supabase/ssr stores the session
// in `sb-<project-ref>-auth-token`; its presence is enough to choose a
// label. It is not an authoritative check and does not need to be — the
// label is cosmetic, and both destinations are correct either way, because
// /me already redirects a visitor without a valid session to
// /login?next=/me. A stale cookie shows "Me" and lands on the login page,
// which is the same place "Sign in" would have gone.
function hasSessionCookie(): boolean {
  try {
    return /(?:^|;\s*)sb-[^=]*-auth-token[^=]*=/.test(document.cookie);
  } catch {
    return false;
  }
}

export function AuthSlot() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setSignedIn(hasSessionCookie());
  }, []);

  // Before hydration the slot renders "Me" pointing at /me — correct for a
  // signed-in visitor, and a working redirect for everyone else. The width
  // is reserved so the swap moves nothing around it.
  const label = signedIn === false ? "Sign in" : "Me";
  const href = signedIn === false ? "/login" : "/me";

  return (
    <span className="inline-flex min-w-[4.5rem] justify-end">
      <Link href={href} className="text-sm text-ink-mid hover:text-ink">
        {label}
      </Link>
    </span>
  );
}
