import type { Metadata } from "next";
import { Suspense } from "react";
import { spectral, plexSans, plexMono } from "@/lib/fonts";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sophecs.com"),
  title: "Sophecs",
  description:
    "Nine questions on how AI should decide things. Find out which school of ethics you actually argue from.",
};

// No cookies() call here on purpose — reading request cookies in the root
// layout would force every page, including the static landing page, into
// dynamic rendering. AnalyticsProvider reads anon_id/anon_since from
// document.cookie client-side instead (bootstrapped by middleware on every
// request regardless of whether the page itself is static).
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
      <body className="min-h-screen flex flex-col bg-paper text-ink">
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
