"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthSlot } from "./AuthSlot";

const LINKS = [
  { href: "/quiz", label: "Quiz" },
  { href: "/debate", label: "Debate" },
  { href: "/lessons", label: "Lessons" },
  { href: "/table", label: "School table" },
];

function useActive(pathname: string) {
  // `/debate` lights up for every child of /debate, since every child of
  // /debate is a debate. Exact match alone would leave the bar unlit on the
  // screens where knowing where you are matters most.
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

// One navigation model on every route. A client component, which costs
// nothing in rendering mode — only a *server* component reading cookies
// would force the static routes dynamic — and buys the active-route marker
// and the auth slot.
//
// Not sticky. A bar following you down a reading page is screen spent on
// navigation you are not using.
//
// Stage 8 put it on the Daily path palette and Bricolage: the active route
// is the mockups' white pill rather than an underline, and every link is a
// 44px target, which the underlined text links were not.
export function SiteHeader() {
  const pathname = usePathname();
  const isActive = useActive(pathname);

  return (
    <header className="border-b-2 border-rule" data-print="hide">
      <div className="mx-auto flex min-h-16 max-w-ui items-center gap-5 px-6 py-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-lg font-extrabold tracking-tight text-ink"
        >
          Sophecs
        </Link>

        {/*
          Four links plus a wordmark plus the auth slot does not fit the
          usable width at 360, so below `sm` the links collapse into one
          disclosure.

          Native <details>, not a JS menu: it is keyboard accessible and
          screen-reader correct with no code, and it needs no scroll lock or
          overlay. What it lacks — Escape and outside-click to close — is
          worth less than the dependency and the focus-trap bugs that come
          with the alternative, for a menu of four links.
        */}
        <details className="relative sm:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-chunky px-2 text-sm font-semibold text-ink-mid marker:hidden hover:text-ink [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <nav
            aria-label="Main"
            className="absolute left-0 top-full z-20 mt-2 min-w-44 rounded-card border-2 border-rule-strong bg-surface p-1"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-chunky px-3 text-sm ${
                  isActive(link.href)
                    ? "bg-paper font-bold text-ink"
                    : "font-semibold text-ink-mid hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </details>

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-chunky border-2 px-3 text-sm font-semibold ${
                isActive(link.href)
                  ? "border-rule-strong bg-surface text-ink"
                  : "border-transparent text-ink-mid hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto">
          <AuthSlot />
        </div>
      </div>
    </header>
  );
}
