"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { shade } from "@/components/daily-path/chunky";
import { syncAuthHint } from "./auth-hint";

// The header on a SIX_SCHOOLS build: Arthur's navigation of 2026-11-06,
// launching with the six schools (docs/daily-path-copy.md, section 13).
// A build without the flag keeps SiteHeader's own markup, unchanged.
//
// Signed out and signed in differ in their links, the wordmark's
// destination and the control at the right. Both sets are in the page and
// CSS shows one, by <html data-auth="in">, which the root layout sets from
// the session cookie before the page is drawn (auth-hint.ts). So neither
// flashes into the other, and the page stays static.
//
// The menus are native <details>, as the Menu below sm already was: keyboard
// accessible and screen-reader correct with no code, no focus trap. They
// close when the page changes.

const SIGNED_OUT = [
  { href: "/lessons", label: "Lessons" },
  { href: "/debate", label: "Motions" },
  { href: "/schools", label: "Schools" },
  { href: "/how-it-works", label: "How it works" },
] as const;

const SIGNED_IN = [
  { href: "/today", label: "Today" },
  { href: "/debate", label: "Motions" },
  { href: "/lessons", label: "Lessons" },
  { href: "/schools", label: "Schools" },
] as const;

// Arthur, 2026-11-06: returning readers need it; a quiet text link.
export const SIGN_IN = { href: "/login", label: "Sign in" } as const;

export const ME_MENU = [
  { href: "/me", label: "Profile" },
  { href: "/me#challenges", label: "My debates and challenges" },
  { href: "/me/settings#classes", label: "Classes" },
  { href: "/me/settings", label: "Settings" },
  { href: "/quiz", label: "Retake the quiz" },
] as const;

export const NAV_SIGNED_OUT = SIGNED_OUT;
export const NAV_SIGNED_IN = SIGNED_IN;

// Shown only to a reader who is, or is not, signed in. Written out in full
// so Tailwind finds each class.
const OUT_INLINE = "[html[data-auth=in]_&]:hidden";
const IN_INLINE = "hidden [html[data-auth=in]_&]:inline-flex";
const OUT_FLEX = "flex [html[data-auth=in]_&]:hidden";
const IN_FLEX = "hidden [html[data-auth=in]_&]:flex";
const IN_BLOCK = "hidden [html[data-auth=in]_&]:block";
const OUT_BLOCK = "block [html[data-auth=in]_&]:hidden";
// Beside the button from md up; in the Menu below it.
const SIGN_IN_BAR = "hidden md:inline-flex [html[data-auth=in]_&]:hidden";

const WORDMARK = "min-h-11 items-center text-lg font-extrabold tracking-tight text-ink";

function useActive(pathname: string) {
  // `/debate` lights up for every child of /debate, since every child of
  // /debate is a motion or an argument on one.
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function MenuLink({
  href,
  label,
  active,
  visibility,
}: {
  href: string;
  label: string;
  active: boolean;
  visibility: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${visibility} min-h-11 items-center rounded-chunky px-3 text-sm ${
        active ? "bg-paper font-bold text-ink" : "font-semibold text-ink-mid hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function BarLink({
  href,
  label,
  active,
  visibility,
}: {
  href: string;
  label: string;
  active: boolean;
  visibility: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${visibility} min-h-11 items-center whitespace-nowrap rounded-chunky border-2 px-3 text-sm font-semibold ${
        active ? "border-rule-strong bg-surface text-ink" : "border-transparent text-ink-mid hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export function SiteHeaderSix() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = useActive(pathname);
  const menu = useRef<HTMLDetailsElement>(null);
  const me = useRef<HTMLDetailsElement>(null);

  // A new page: close both menus, and read the session cookie again, so a
  // sign-in or sign-out that ended in a client-side move is reflected.
  useEffect(() => {
    menu.current?.removeAttribute("open");
    me.current?.removeAttribute("open");
    syncAuthHint();
  }, [pathname]);

  // A link in an open menu closes it, even one to the page already open
  // (where the page change above never comes): Me, then "Settings" from
  // /me/settings, would otherwise leave the menu over the section asked
  // for.
  function closeOnLink(e: React.MouseEvent, menuRef: React.RefObject<HTMLDetailsElement | null>) {
    if ((e.target as HTMLElement).closest("a")) menuRef.current?.removeAttribute("open");
  }

  // One menu open at a time: below sm, signed in, Me would open over Menu.
  function closeOther(
    opened: React.RefObject<HTMLDetailsElement | null>,
    other: React.RefObject<HTMLDetailsElement | null>
  ) {
    if (opened.current?.open) other.current?.removeAttribute("open");
  }

  async function signOut() {
    // Loaded on the click, not with the header: the Supabase client is
    // ~90 KB that no page should carry for a button most visits never
    // press (AuthSlot says why that was measured).
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    document.documentElement.removeAttribute("data-auth");
    me.current?.removeAttribute("open");
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b-2 border-rule" data-print="hide">
      {/* The bar from md (768 pixels) up; below it the Menu, with "Sign
          in" in it, since beside the button it would push a phone's page
          sideways. Narrower gaps below lg: below md so "Take the quiz"
          stays on one line from the design's 360-pixel phone width up
          (below it, it wraps rather than push the page sideways), and from
          md so the signed-out bar fits at 768 with room to spare. */}
      <div className="mx-auto flex min-h-16 max-w-ui items-center gap-3 px-6 py-2 lg:gap-5">
        <Link href="/" className={`inline-flex ${WORDMARK} ${OUT_INLINE}`}>
          Sophecs
        </Link>
        <Link href="/today" className={`${WORDMARK} ${IN_INLINE}`}>
          Sophecs
        </Link>

        {/* Below md the four links collapse into one disclosure, as they
            did below sm before; the button at the right stays beside it. */}
        <details ref={menu} onToggle={() => closeOther(menu, me)} className="relative md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-chunky px-2 text-sm font-semibold text-ink-mid marker:hidden hover:text-ink [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <nav
            aria-label="Main"
            onClick={(e) => closeOnLink(e, menu)}
            className="absolute left-0 top-full z-20 mt-2 min-w-44 rounded-card border-2 border-rule-strong bg-surface p-1"
          >
            {SIGNED_OUT.map((link) => (
              <MenuLink key={`out-${link.href}`} {...link} active={isActive(link.href)} visibility={OUT_FLEX} />
            ))}
            {SIGNED_IN.map((link) => (
              <MenuLink key={`in-${link.href}`} {...link} active={isActive(link.href)} visibility={IN_FLEX} />
            ))}
            <div className={`${OUT_BLOCK} mt-1 border-t-2 border-rule pt-1`}>
              <MenuLink {...SIGN_IN} active={isActive(SIGN_IN.href)} visibility="flex" />
            </div>
          </nav>
        </details>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {SIGNED_OUT.map((link) => (
            <BarLink
              key={`out-${link.href}`}
              {...link}
              active={isActive(link.href)}
              visibility={`inline-flex ${OUT_INLINE}`}
            />
          ))}
          {SIGNED_IN.map((link) => (
            <BarLink key={`in-${link.href}`} {...link} active={isActive(link.href)} visibility={IN_INLINE} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href={SIGN_IN.href}
            aria-current={isActive(SIGN_IN.href) ? "page" : undefined}
            className={`${SIGN_IN_BAR} min-h-11 items-center whitespace-nowrap rounded-chunky px-2 text-sm font-semibold text-ink-mid hover:text-ink`}
          >
            {SIGN_IN.label}
          </Link>
          <Link
            href="/quiz"
            className={`chunky inline-flex min-h-11 items-center rounded-chunky bg-ink px-3 min-[360px]:whitespace-nowrap text-sm font-extrabold tracking-wide uppercase text-paper md:px-4 ${OUT_INLINE}`}
            style={shade("var(--color-rule-strong)")}
          >
            Take the quiz
          </Link>

          <details ref={me} onToggle={() => closeOther(me, menu)} className={`relative ${IN_BLOCK}`}>
            <summary
              className="chunky flex min-h-11 cursor-pointer list-none items-center rounded-chunky border-2 border-rule-strong bg-surface px-4 text-sm font-extrabold tracking-wide uppercase text-ink marker:hidden [&::-webkit-details-marker]:hidden"
              style={shade("var(--color-rule-strong)")}
            >
              Me
            </summary>
            <div
              onClick={(e) => closeOnLink(e, me)}
              className="absolute right-0 top-full z-20 mt-2 flex min-w-60 flex-col rounded-card border-2 border-rule-strong bg-surface p-1"
            >
              {ME_MENU.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-11 items-center rounded-chunky px-3 text-sm font-semibold text-ink-mid hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={signOut}
                className="flex min-h-11 items-center rounded-chunky px-3 text-left text-sm font-semibold text-ink-mid hover:text-ink"
              >
                Sign out
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
