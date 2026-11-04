// Sample accounts: the words the site uses for them, in one place.
//
// A sample account is one scripts/seed-production.ts created, marked
// `is_sample` in the database (migration 0021). Its activity renders
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

// Under the school table, in a week whose rows count a sample argument.
export const TABLE_SAMPLE_NOTE = "This week's rankings include sample accounts.";
