import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Sophecs",
  description:
    "Take the diagnostic, get sorted into a school of philosophy, and defend it in debates about AI.",
};

const NAV_LINKS = [
  { href: "/quiz", label: "Quiz" },
  { href: "/debate", label: "Debate" },
  { href: "/forum", label: "Forum" },
  { href: "/lessons", label: "Lessons" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-serif text-xl font-semibold tracking-tight hover:opacity-70"
            >
              Sophecs
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-ink-mid hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/me"
                className="text-ink border border-rule rounded-btn px-3 py-1.5 hover:bg-surface"
              >
                Profile
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-rule mt-24">
          <div className="mx-auto max-w-5xl px-5 py-8 flex items-baseline justify-between">
            <span className="font-serif font-semibold">Sophecs</span>
            <span className="eyebrow-sm text-ink-soft">
              Primary sources only
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
