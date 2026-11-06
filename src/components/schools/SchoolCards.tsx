import Link from "next/link";
import { getSchool } from "@/lib/schools";
import { SHOWN_SCHOOL_IDS } from "@/lib/types";

/**
 * A card per school this build shows, linking to its page: its name, its
 * one line and whose words those are. The landing page's "The {n} schools"
 * and, on a SIX_SCHOOLS build, `/schools` (Arthur, 2026-11-06) draw the
 * same list.
 *
 * Real quotation with real citation, which on the landing page is the only
 * thing that shows what the schools actually say.
 */
export function SchoolCards({ headingAs = "h3" }: { headingAs?: "h2" | "h3" } = {}) {
  // h3 under the landing page's "The {n} schools"; h2 on `/schools`, where
  // the cards sit straight under the page's heading.
  const Name = headingAs;
  return (
    <ul className="mt-6 grid gap-6 sm:grid-cols-3">
      {SHOWN_SCHOOL_IDS.map((id) => {
        const school = getSchool(id);
        return (
          <li key={id} className="rounded-card border-2 border-rule bg-surface p-5">
            <Name className="text-base font-extrabold text-ink">
              <Link
                href={`/s/${id}`}
                className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                {school.name}
              </Link>
            </Name>
            <p className="mt-3 font-serif text-base leading-relaxed text-ink-mid">
              &ldquo;{school.one_line}&rdquo;
            </p>
            <p className="mt-2 text-sm text-ink-soft">{school.one_line_attribution}</p>
          </li>
        );
      })}
    </ul>
  );
}
