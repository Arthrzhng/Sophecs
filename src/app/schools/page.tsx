import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/components/layout/Page";
import { SchoolCards } from "@/components/schools/SchoolCards";
import { SchoolTable } from "@/components/table/SchoolTable";
import { loadSchoolTable } from "@/lib/school-table-page";

// A build without the flag never reaches this page: next.config.ts
// rewrites its address to one no route answers, so the reader gets the
// site's own not-found page, as before the page existed. The metadata is
// generated, and refuses as the page does, so that even reached some
// other way it says nothing of the page.
export async function generateMetadata(): Promise<Metadata> {
  if (process.env.SIX_SCHOOLS !== "1") notFound();
  return {
    title: "Schools · Sophecs",
    description:
      "Each school's page, and how each argued over the last seven days.",
  };
}

// The schools, a card each linking to its page, with the school table
// under them, on a SIX_SCHOOLS build (Arthur, 2026-11-06;
// docs/daily-path-copy.md, section 13). The cards are the schools the
// build shows, the list every public surface moved to in Stage 5's step 2,
// which at launch is the six published. A SIX_SCHOOLS build redirects
// /table here (next.config.ts).
//
// A build without the flag, production included, has no such page.
//
// Dynamic for the reason /table is: the table reads the session.
export const dynamic = "force-dynamic";

export default async function SchoolsPage() {
  if (process.env.SIX_SCHOOLS !== "1") notFound();
  const table = await loadSchoolTable();
  return (
    <Page width="ui" rhythm="path">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Schools</h1>
      <SchoolCards headingAs="h2" />
      <section className="mt-12 border-t-2 border-rule pt-10">
        <SchoolTable {...table} headingAs="h2" />
      </section>
    </Page>
  );
}
