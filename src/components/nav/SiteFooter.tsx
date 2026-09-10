import Link from "next/link";
import { SCHOOL_COLORS } from "@/lib/school-colors";
import type { SchoolId } from "@/lib/types";

const SCHOOLS: SchoolId[] = ["stoicism", "utilitarianism", "virtue-ethics"];

// Session-free for the same reason as SiteHeader — it renders in the root
// layout, above the static acquisition routes.
export function SiteFooter() {
  return (
    <footer className="border-t border-rule mt-auto">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap gap-x-16 gap-y-8">
          <div>
            <p className="eyebrow text-ink-soft mb-3">The schools</p>
            <ul className="space-y-2 text-sm">
              {SCHOOLS.map((id) => (
                <li key={id}>
                  <Link href={`/s/${id}`} className="text-ink-mid hover:text-ink">
                    {SCHOOL_COLORS[id].name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow text-ink-soft mb-3">The site</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/quiz" className="text-ink-mid hover:text-ink">
                  Take the quiz
                </Link>
              </li>
              <li>
                <Link href="/debate" className="text-ink-mid hover:text-ink">
                  Debate a motion
                </Link>
              </li>
              <li>
                <Link href="/lessons" className="text-ink-mid hover:text-ink">
                  Lessons
                </Link>
              </li>
              <li>
                <Link href="/me" className="text-ink-mid hover:text-ink">
                  Your profile
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 font-mono text-xs text-ink-soft">
          Sophecs — nine questions, three schools, one argument at a time.
        </p>
      </div>
    </footer>
  );
}
