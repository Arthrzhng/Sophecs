"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthSlot } from "./AuthSlot";

const LINKS = [
  { href: "/quiz", label: "Quiz" },
  { href: "/debate", label: "Debate" },
  { href: "/lessons", label: "Lessons" },
];

function useActive(pathname: string) {
  // `/debate` lights up for every child of /debate, since every child of
  // /debate is a debate. Exact match alone would leave the bar unlit on the
  // screens where knowing where you are matters most.
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

// One navigation model on every route. A client component, which costs
// nothing in rendering mode — only a *server* component reading cookies
// would force the static routes dynamic — and buys the active-route
// underline and the auth slot.
//
// Not sticky. A 56px bar following you down a reading page is 56px of a
// phone screen spent on navigation you are not using.
export function SiteHeader() {
  const pathname = usePathname();
  const isActive = useActive(pathname);

  return (
    <header className="border-b border-rule" data-print="hide">
      <div className="mx-auto flex h-14 max-w-ui items-center gap-6 px-6">
        <Link href="/" className="font-serif text-base font-medium text-ink">
          Sophecs
        </Link>

        {/*
          Three links plus a wordmark plus the auth slot is 343px of content
          in 312px of usable width at 360. So below `sm` the links collapse
          into one disclosure.

          Native <details>, not a JS menu: it is keyboard accessible and
          screen-reader correct with no code, and it needs no scroll lock or
          overlay. What it lacks — Escape and outside-click to close — is
          worth less than the dependency and the focus-trap bugs that come
          with the alternative, for a menu of three links.
        */}
        <details className="relative sm:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center text-sm text-ink-mid marker:hidden hover:text-ink [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <nav
            aria-label="Main"
            className="absolute left-0 top-full z-20 mt-1 min-w-36 border border-rule bg-paper py-1 shadow-raised"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`flex min-h-11 items-center px-4 text-sm ${
                  isActive(link.href) ? "font-medium text-ink" : "text-ink-mid hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </details>

        <nav aria-label="Main" className="hidden items-center gap-5 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={
                isActive(link.href)
                  ? "border-b-2 border-ink pb-0.5 text-sm font-medium text-ink"
                  : "border-b-2 border-transparent pb-0.5 text-sm text-ink-mid hover:text-ink"
              }
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
