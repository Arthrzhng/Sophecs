import type { Metadata } from "next";
import { Suspense } from "react";
import { spectral, plexSans, plexMono, bricolage } from "@/lib/fonts";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { SiteFooter } from "@/components/nav/SiteFooter";
import { AUTH_HINT_SCRIPT } from "@/components/nav/auth-hint";
import "./globals.css";
// The three unpublished schools' colour tokens on a SIX_SCHOOLS build, and
// an empty stylesheet on any other (next.config.ts resolves the name).
import "@six-schools/tokens.css";

const DESCRIPTION =
  "Ten questions about how you decide what's right. Find out which school of ethics you argue from.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sophecs.com"),
  title: "Sophecs",
  description: DESCRIPTION,
  // Browsers' own default, stated so that every page carries it. A sample's
  // page sets "no-referrer" (src/lib/sample.ts), and a policy set by a meta
  // tag stays with the tab after a client-side navigation removes the tag;
  // the next page's own tag is what puts the default back.
  referrer: "strict-origin-when-cross-origin",
  // opengraph-image.tsx supplies the image itself; these carry the rest of
  // the card so sophecs.com previews properly when the bare domain is shared.
  openGraph: {
    title: "Sophecs",
    description: DESCRIPTION,
    url: "https://sophecs.com",
    siteName: "Sophecs",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Sophecs", description: DESCRIPTION },
};

// No cookies() call here on purpose — reading request cookies in the root
// layout would force every page, including the static landing page, into
// dynamic rendering. AnalyticsProvider reads anon_id/anon_since from
// document.cookie client-side instead (bootstrapped by middleware on every
// request regardless of whether the page itself is static). SiteHeader and
// SiteFooter are session-free for exactly the same reason — see SiteHeader.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // On a SIX_SCHOOLS build, the header's signed-in links are chosen before
  // the page is drawn: a one-line script marks <html data-auth="in"> from
  // the session cookie (src/components/nav/auth-hint.ts), without reading
  // cookies here. The mark is set before React hydrates, hence the
  // suppressed warning on <html> alone. A build without the flag has
  // neither.
  const six = process.env.SIX_SCHOOLS === "1";
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${plexSans.variable} ${plexMono.variable} ${bricolage.variable}`}
      suppressHydrationWarning={six || undefined}
    >
      {six && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: AUTH_HINT_SCRIPT }} />
        </head>
      )}
      <body className="min-h-screen flex flex-col bg-paper text-ink">
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
