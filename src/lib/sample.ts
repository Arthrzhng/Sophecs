// Sample accounts: the words the site uses for them, in one place.
//
// A sample account is one scripts/seed-production.ts created, marked
// `is_sample` in the database (migration 0023). Its activity renders
// through the ordinary pages, and wherever one is identified it carries
// the label below. docs/sample-activity.md has the design.

export const SAMPLE_LABEL = "Sample";

// The brief's wording, verbatim. Shown when the label is opened.
export const SAMPLE_EXPLANATION =
  "An illustrative account with generated activity, not an active member. It does not respond to messages or challenges.";

// On a verdict written from a template rather than by the judge.
export const SAMPLE_ASSESSMENT = "Sample assessment";
export const SAMPLE_ASSESSMENT_NOTE =
  "Written from a template for a sample account. The judge did not read this argument.";

// Under the school table, in a week whose arguments or school changes count
// a sample account.
export const TABLE_SAMPLE_NOTE = "This week's table includes sample accounts.";

// Under Today's school rank, in a week whose ranked arguments include one.
export const RANK_SAMPLE_NOTE = "This week's ranks include sample accounts.";

/**
 * Metadata for a page that shows a sample, so the link preview says so
 * too: a page that sets only `title` inherits the root layout's Open Graph
 * and Twitter titles ("Sophecs"), which is what most previews show. The
 * page's own opengraph-image, where it has one, still supplies the image.
 */
export function sampleMetadata(title: string, image?: string) {
  // A page whose own segment has no opengraph-image names one here; it
  // must be an image that carries the Sample mark itself.
  const images = image ? [{ url: image, width: 1200, height: 630, alt: "A sample account's result card, marked Sample" }] : undefined;
  return {
    title,
    openGraph: { title, siteName: "Sophecs", type: "website" as const, ...(images && { images }) },
    twitter: { card: "summary_large_image" as const, title, ...(images && { images }) },
  };
}
