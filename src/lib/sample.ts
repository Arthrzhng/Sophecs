// Sample accounts: the words the site uses for them, in one place.
//
// A sample account is one the sample activity workflow created, marked
// `is_sample` in the database (migration 0023). Its activity renders
// through the ordinary pages, and wherever its work is shown it carries the
// tag below. docs/sample-activity.md has the design.

// Arthur, 2026-11-08: readers see "sample" as little as possible. What
// stays is the minimum below; nothing else on the site names a sample.

// The one tag beside a sample's work wherever it is shown: a verdict, a
// result, a challenge, an exchange. Small and quiet (SampleLabel).
export const SAMPLE_TAG = "AI";

// The explanation on /how-it-works#samples, Arthur's words, which the tag
// also opens to.
export const SAMPLE_EXPLANATION = "Sample accounts are run by AI. They show what arguing here looks like.";

// On a sample's verdict, inside the tag: its scores come from a template,
// and the page must not let them pass for the judge's.
export const SAMPLE_JUDGE_NOTE = "The judge did not read this argument.";

// The one line on /schools, under the table, in a week sample accounts
// count in.
export const SCHOOLS_SAMPLE_LINE = "Includes sample accounts, run by AI.";

// The small mark on a sample page's share and preview images, which travel
// without the tag beside them.
export const SAMPLE_IMAGE_MARK = "AI sample";

/**
 * A page showing a sample passes no referrer to the next page (Arthur,
 * 2026-11-05: "no-referrer policy on sample pages"; docs/decisions.md,
 * "Arthur's rulings of 2026-11-05 on Checkpoint A", 18). Without it, a page
 * opened from one would report the sample page's address: as its
 * document.referrer, which reaches PostHog's page_viewed and is stored on
 * a reader's own quiz result (QuizShell, submitQuizResult), and as the
 * Referer header, which /r/[id] reads into card_viewed and
 * share_page_viewed. The root layout states the browsers' default for
 * every other page, which puts it back after a client-side navigation
 * away from a sample page.
 */
export const SAMPLE_PAGE_REFERRER = "no-referrer" as const;

/**
 * Metadata for a page that shows a sample: the title a genuine page of the
 * kind has (Arthur, 2026-11-08: no "Sample" in page titles), with no
 * referrer passed on. The page's preview image, its own opengraph-image or
 * the one named here, carries the sample mark.
 */
export function sampleMetadata(title: string, image?: { url: string; alt: string }) {
  // A page whose own segment has no opengraph-image names one here; it
  // must be a 1200 by 630 image that carries the sample mark itself.
  const images = image ? [{ url: image.url, width: 1200, height: 630, alt: image.alt }] : undefined;
  return {
    title,
    referrer: SAMPLE_PAGE_REFERRER,
    openGraph: { title, siteName: "Sophecs", type: "website" as const, ...(images && { images }) },
    twitter: { card: "summary_large_image" as const, title, ...(images && { images }) },
  };
}
