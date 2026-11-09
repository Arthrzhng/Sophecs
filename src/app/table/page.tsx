import { Page } from "@/components/layout/Page";
import { SchoolTable } from "@/components/table/SchoolTable";
import { loadSchoolTable } from "@/lib/school-table-page";

export const metadata = {
  title: "School table · Sophecs",
  description:
    "How each school argued over the last seven days, by the judge's fidelity mark. No names.",
};

/*
 * Declared dynamic rather than left to be inferred.
 *
 * The session read in loadSchoolTable is behind isSupabaseConfigured(), so
 * a build run without those variables never calls cookies() and Next
 * prerenders the route — baking an empty table and a signed-out view into
 * the deployment. It happens to be right on Vercel, where the variables
 * are set at build time too, and that is exactly the kind of correctness
 * nobody notices breaking.
 *
 * A SIX_SCHOOLS build redirects this address to /schools (next.config.ts),
 * which shows the same table under the schools' cards.
 */
export const dynamic = "force-dynamic";

export default async function SchoolTablePage() {
  const table = await loadSchoolTable();
  // Back on <Page> now the daily-path wrapper is gone: the wrapper had to
  // sit on <main>, which <Page> owns. `rhythm="path"` keeps the 40/40 this
  // route has had since it was redrawn.
  return (
    <Page width="ui" rhythm="path">
      <SchoolTable {...table} />
    </Page>
  );
}
