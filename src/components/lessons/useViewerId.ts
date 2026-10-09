"use client";

import { useEffect, useState } from "react";

const CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Who the browser's module progress belongs to: the signed-in user's id, or
 * "anon".
 *
 * Resolved in the browser rather than passed down from the server, because
 * /lessons and the module pages are static and reading the session on the
 * server would make them dynamic for the sake of one localStorage key
 * prefix. `getSession` rather than `getUser`: this only namespaces local
 * data, so it is not an authorisation decision and does not need the round
 * trip to verify the token.
 *
 * The Supabase client is imported inside the effect, not at the top of the
 * file. Statically imported it put 67 kB of auth client into the first load
 * of a reading list; split out, it is fetched after paint and the pages are
 * back to the weight they were.
 *
 * `null` while it is being worked out, so a caller can hold back progress
 * rather than draw one reader's place in a module for another.
 */
export function useViewerId(): string | null {
  const [viewerId, setViewerId] = useState<string | null>(CONFIGURED ? null : "anon");

  useEffect(() => {
    if (!CONFIGURED) return;
    let live = true;
    import("@/lib/supabase/client")
      .then(({ createClient }) => createClient().auth.getSession())
      .then(({ data }) => {
        if (live) setViewerId(data.session?.user?.id ?? "anon");
      })
      .catch(() => {
        if (live) setViewerId("anon");
      });
    return () => {
      live = false;
    };
  }, []);

  return viewerId;
}
