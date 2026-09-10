import Link from "next/link";

// Deliberately session-free. This renders in the root layout, so reading
// cookies()/the session here would force /, /quiz, /r/[id], /s/[school] and
// /c/[id] out of static rendering — the constraint that kept the old
// session-aware SiteNav confined to /debate and /me, which in turn left most
// of the site with no navigation at all. "Me" points at /me, which already
// redirects signed-out visitors to /login?next=/me, so the correct
// destination is reached either way without reading a session here.
export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-serif text-sm font-medium hover:opacity-70">
          Sophecs
        </Link>
        <nav className="flex items-center gap-5 font-mono text-xs">
          <Link href="/debate" className="text-ink-mid hover:text-ink">
            Debate
          </Link>
          <Link href="/lessons" className="text-ink-mid hover:text-ink">
            Lessons
          </Link>
          <Link href="/me" className="text-ink-mid hover:text-ink">
            Me
          </Link>
        </nav>
      </div>
    </header>
  );
}
