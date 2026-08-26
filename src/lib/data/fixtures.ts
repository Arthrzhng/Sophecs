import type {
  Defection,
  Match,
  MicroLesson,
  Motion,
  Post,
  Profile,
  QuizOption,
  QuizQuestion,
  Submission,
  Thread,
  Verdict,
} from "../types";

// In-memory mirror of supabase/seed.sql. The data layer serves these rows
// whenever Supabase credentials are absent, so every screen renders populated
// in local development. Keep the two in sync by hand; both are small.

export const FIXTURE_PROFILES: Profile[] = [
  {
    id: "p-halcyon",
    username: "halcyon",
    school_id: "stoicism",
    rating: 1048,
    streak_days: 6,
    wins: 9,
    losses: 4,
    created_at: "2026-07-02T09:00:00Z",
  },
  {
    id: "p-benthamite",
    username: "benthamite_88",
    school_id: "utilitarianism",
    rating: 1012,
    streak_days: 2,
    wins: 5,
    losses: 5,
    created_at: "2026-07-11T14:30:00Z",
  },
  {
    id: "p-mesotes",
    username: "mesotes",
    school_id: "virtue-ethics",
    rating: 991,
    streak_days: 0,
    wins: 3,
    losses: 6,
    created_at: "2026-07-19T18:12:00Z",
  },
  {
    id: "p-turncoat",
    username: "late_convert",
    school_id: "stoicism",
    rating: 1003,
    streak_days: 1,
    wins: 4,
    losses: 3,
    created_at: "2026-06-28T08:45:00Z",
  },
];

// PLACEHOLDER: 3 questions wired end-to-end. The real quiz has 10; adding the
// other 7 is seed data, not code.
export const FIXTURE_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    prompt:
      "A model refuses a harmful request because it was trained to. Is the refusal creditable to the model?",
    position: 1,
  },
  {
    id: "q2",
    prompt:
      "You can deploy a system that helps millions slightly and harms a few people badly. What settles whether you should?",
    position: 2,
  },
  {
    id: "q3",
    prompt:
      "What would it take for you to say an AI acted well, rather than merely correctly?",
    position: 3,
  },
];

export const FIXTURE_QUIZ_OPTIONS: QuizOption[] = [
  {
    id: "q1a",
    question_id: "q1",
    label:
      "Credit is beside the point. What matters is whether the refusal flowed from the system's own settled constitution.",
    school_id: "stoicism",
  },
  {
    id: "q1b",
    question_id: "q1",
    label:
      "Yes, if the refusal prevented harm. Outcomes earn credit; the training story is just causal bookkeeping.",
    school_id: "utilitarianism",
  },
  {
    id: "q1c",
    question_id: "q1",
    label:
      "No. Credit belongs to agents with character, and one refusal tells you nothing about a stable disposition.",
    school_id: "virtue-ethics",
  },
  {
    id: "q2a",
    question_id: "q2",
    label:
      "Whether the harms fall within what was ever in your control to prevent, and whether you accepted them with open eyes.",
    school_id: "stoicism",
  },
  {
    id: "q2b",
    question_id: "q2",
    label: "The arithmetic. Sum the benefits, sum the harms, and let the totals decide.",
    school_id: "utilitarianism",
  },
  {
    id: "q2c",
    question_id: "q2",
    label:
      "What a person of good judgment would do here, in this case, knowing these people. No formula survives contact with the particulars.",
    school_id: "virtue-ethics",
  },
  {
    id: "q3a",
    question_id: "q3",
    label:
      "Nothing more than acting in accord with its nature and role. Acting well just is correct function, rightly understood.",
    school_id: "stoicism",
  },
  {
    id: "q3b",
    question_id: "q3",
    label: "Show me it reliably makes lives better. That is the whole content of 'well'.",
    school_id: "utilitarianism",
  },
  {
    id: "q3c",
    question_id: "q3",
    label:
      "It would need to act from the right state of character, for the right reasons, the way a practically wise person would.",
    school_id: "virtue-ethics",
  },
];

export const FIXTURE_MOTIONS: Motion[] = [
  {
    id: "m-determinism-1",
    module_id: "stoicism-determinism",
    text: "This house believes a deterministic system can still be responsible for its outputs.",
    opens_at: "2026-08-25T09:00:00Z",
    closes_at: "2026-08-27T09:00:00Z",
  },
  {
    id: "m-alignment-1",
    module_id: "utilitarianism-alignment",
    text: "This house believes an AI trained to maximise stated preferences is a utilitarian.",
    opens_at: "2026-08-23T09:00:00Z",
    closes_at: "2026-08-24T09:00:00Z",
  },
];

// Standalone condensed teaching per motion, shown on the verdict screen.
// Not a teaser and not linked to /lessons.
export const FIXTURE_MICRO_LESSONS: MicroLesson[] = [
  {
    id: "ml-determinism-1",
    motion_id: "m-determinism-1",
    body: "The Stoics never thought determinism excused anyone. Chrysippus split causes in two: the push that sets a cylinder moving comes from outside, but its rolling comes from its shape. On that view a system's outputs can be fully caused and still genuinely its own, because they flow through its constitution. The cost of the move is that it works for machines exactly as well as it works for us.",
  },
  {
    id: "ml-alignment-1",
    motion_id: "m-alignment-1",
    body: "Bentham wanted an arithmetic of welfare; a reward function is one, minus the arguments. Sidgwick saw the trap a century early: maximising what people say they want is not the same as maximising their good, and the gap between the two is where both utilitarian ethics and preference-learning systems do their hardest work.",
  },
];

export const FIXTURE_SUBMISSIONS: Submission[] = [
  {
    id: "s-halcyon-det",
    motion_id: "m-determinism-1",
    profile_id: "p-halcyon",
    side: "for",
    body: "Chrysippus answers this directly: the cylinder is pushed, yet rolls by its own shape. A model's outputs are caused by training, but they pass through a constitution that is the model's own. Responsibility never required an uncaused cause. It requires that the action flow from the agent's character, and that condition is met. Cicero, De Fato 43.",
    created_at: "2026-08-25T12:04:00Z",
  },
  {
    id: "s-benthamite-det",
    motion_id: "m-determinism-1",
    profile_id: "p-benthamite",
    side: "against",
    body: "Responsibility is a practice we keep because it changes behaviour. Praise and blame are levers, and levers need a hand that can feel them. A deterministic pipeline with no capacity for expectation or regret gives punishment nothing to grip. Call its outputs its own if you like; the word does no work the loss function was not already doing.",
    created_at: "2026-08-25T13:41:00Z",
  },
  {
    id: "s-system-align",
    motion_id: "m-alignment-1",
    profile_id: "system",
    side: "against",
    body: "A utilitarian counts welfare wherever it occurs. A preference-maximiser counts responses to prompts. Mill's whole second chapter is a warning that these come apart: people state preferences against their own good constantly. Optimising the statement is not optimising the person. The resemblance to utilitarianism is clerical, not moral.",
    created_at: "2026-08-23T10:00:00Z",
  },
  {
    id: "s-turncoat-align",
    motion_id: "m-alignment-1",
    profile_id: "p-turncoat",
    side: "for",
    body: "Strip the caricature and the motion stands. Bentham asked for a common measure of welfare and took expressed pleasure and pain as evidence for it. Preference learning does the same with better instruments. Yes, stated preference misfires; Bentham's calculus misfired too, and nobody said he was therefore no utilitarian. Imperfect counting is still counting.",
    created_at: "2026-08-23T16:22:00Z",
  },
];

export const FIXTURE_MATCHES: Match[] = [
  {
    id: "match-align-1",
    motion_id: "m-alignment-1",
    submission_a: "s-turncoat-align",
    submission_b: "s-system-align",
    status: "judged",
  },
];

export const FIXTURE_VERDICTS: Verdict[] = [
  {
    id: "v-align-1",
    match_id: "match-align-1",
    winner_submission_id: "s-turncoat-align",
    scores: {
      a: { logic: 8, sources: 7, answers_opponent: 8, clarity: 7 },
      b: { logic: 7, sources: 8, answers_opponent: 5, clarity: 8 },
    },
    rationale:
      "The affirmative meets the strongest objection head-on: it concedes that stated preference misfires and turns the concession into its own argument from Bentham's practice. The negative reads Mill well but argues past the motion, which asked about the maximiser's classification, not its success.",
  },
];

export const FIXTURE_DEFECTIONS: Defection[] = [
  {
    id: "d-turncoat-1",
    profile_id: "p-turncoat",
    from_school_id: "utilitarianism",
    to_school_id: "stoicism",
    reason:
      "Lost three debates defending aggregate welfare against the control objection and realised I believed my opponents.",
    created_at: "2026-08-14T20:10:00Z",
  },
];

export const FIXTURE_THREADS: Thread[] = [
  {
    id: "t-cylinder",
    channel: "stoicism",
    profile_id: "p-halcyon",
    title: "Is the cylinder argument actually about shape, or about ownership?",
    created_at: "2026-08-20T11:15:00Z",
  },
  {
    id: "t-repugnant",
    channel: "utilitarianism",
    profile_id: "p-benthamite",
    title: "Does the repugnant conclusion apply to training data mixtures?",
    created_at: "2026-08-21T09:40:00Z",
  },
  {
    id: "t-phronesis",
    channel: "virtue-ethics",
    profile_id: "p-mesotes",
    title: "Phronesis can't be codified. Isn't that just an empirical claim now?",
    created_at: "2026-08-22T17:05:00Z",
  },
  {
    id: "t-defection",
    channel: "defections",
    profile_id: "p-turncoat",
    title: "Why I left utilitarianism after the control debates",
    created_at: "2026-08-14T20:12:00Z",
  },
];

export const FIXTURE_POSTS: Post[] = [
  {
    id: "post-1",
    thread_id: "t-cylinder",
    profile_id: "p-halcyon",
    body: "Everyone reads De Fato 43 as a physics claim about shape. I think it's a claim about ownership: the rolling is the cylinder's because nothing else's shape explains it. On that reading, weights are shape.",
    created_at: "2026-08-20T11:15:00Z",
  },
  {
    id: "post-2",
    thread_id: "t-cylinder",
    profile_id: "p-mesotes",
    body: "Ownership without a life to own it in. The cylinder doesn't stand back from its shape; neither does the model. That standing-back is where character lives, and it's what your reading quietly deletes.",
    created_at: "2026-08-20T14:02:00Z",
  },
  {
    id: "post-3",
    thread_id: "t-cylinder",
    profile_id: "p-benthamite",
    body: "You are both doing metaphysics where an empirical question sits. Does treating models as responsible produce better outcomes than treating them as pipes? That's answerable, and neither of you has touched it.",
    created_at: "2026-08-20T19:47:00Z",
  },
  {
    id: "post-4",
    thread_id: "t-defection",
    profile_id: "p-turncoat",
    body: "Three debates in a row I wrote the utilitarian case for holding systems responsible, and three times the Stoic reply was better than mine. At some point defending a position you keep losing with, against arguments you find convincing, has a name: it's called changing your mind.",
    created_at: "2026-08-14T20:12:00Z",
  },
  {
    id: "post-5",
    thread_id: "t-defection",
    profile_id: "p-halcyon",
    body: "Welcome. For what it's worth, the calculus was never wrong about what to count, only about who does the counting.",
    created_at: "2026-08-15T07:58:00Z",
  },
];
