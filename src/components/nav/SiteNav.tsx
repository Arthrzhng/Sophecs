import Link from "next/link";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

// Server-rendered from the session, per the Phase 2 brief — but deliberately
// not in the root layout. Reading cookies()/session there would force /,
// /quiz, /r/[id] and /c/[id] into dynamic rendering, which the brief's own
// "nothing may add a request or unchanged-Lighthouse" rule for those routes
// forbids. So this renders only inside the new Phase 2 route layouts
// (/me, /debate) that are already dynamic. See docs/decisions.md.
export async function SiteNav() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="border-b border-rule">
      <div className="mx-auto max-w-2xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-serif text-sm font-medium">
          Sophecs
        </Link>
        <div className="flex items-center gap-5 font-mono text-xs">
          <Link href="/debate" className="text-ink-mid hover:text-ink">
            Debate
          </Link>
          <Link href={user ? "/me" : "/login"} className="text-ink-mid hover:text-ink">
            {user ? "Me" : "Sign in"}
          </Link>
        </div>
      </div>
    </nav>
  );
}
