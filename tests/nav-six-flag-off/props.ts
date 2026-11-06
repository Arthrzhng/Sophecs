// Fixed inputs for the flag-off markup fixtures beside this file, which
// were rendered from main's components (at cd49c49) before the navigation
// change. tests/nav-six.test.tsx renders today's components with the same
// inputs, without the flag, and requires the same bytes: production's
// pages may not change.
import { rankSchools } from "../../src/lib/school-table";

export const FIXTURE_PROPS = {
  topics: {
    topics: [
      { slug: "opaque-benefit", title: "The opaque benefit", motion: "A motion.", stances: { stoicism: "A stance." }, parElo: 1200, bestScore: 70, status: "judged", locksFor: null, isWeekly: true },
      { slug: "no-decision", title: "No decision", motion: "Another.", stances: {}, parElo: 1250, bestScore: null, status: "locked", locksFor: 2, isWeekly: false },
    ],
    school: "stoicism",
  },
  table: {
    week: 45,
    rows: rankSchools(
      [
        { school: "stoicism", fidelity: 7 },
        { school: "utilitarianism", fidelity: 8 },
      ],
      {}
    ),
    yourSchool: "stoicism",
    yourLine: "You argued once for Stoicism this week.",
    emptyWeek: false,
    paused: false,
    sampleNote: "This week's table includes sample accounts.",
  },
};
