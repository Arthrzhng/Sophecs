// The six steps and their captions, verbatim from docs/daily-path-copy.md §3.
export const STEPS = [
  { title: "Read the case", caption: "The passage, and two notes in your own words" },
  { title: "Check your reading", caption: "Two questions on what you just read" },
  { title: "Argue the motion", caption: "Argue from your school. A judge scores it." },
  { title: "Face an objection", caption: "The judge names the objection you left standing" },
  { title: "Revise once", caption: "Answer it. One revision, no effect on your rating." },
  { title: "Case closed", caption: "Your before and after, side by side" },
] as const;

// The horizontal offsets that make the column snake, from mockup 00.
export const SHIFTS = [0, -70, -40, 50, 80, 20] as const;
