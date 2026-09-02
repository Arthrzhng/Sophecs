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

// The full ten-question diagnostic. Every question forks on the same three
// axes: Stoicism checks what's within your control, Utilitarianism checks
// aggregate outcome, Virtue Ethics checks what the choice makes of your
// character. The repetition across scenarios is what turns the result into
// a signal instead of noise from any one question.
export const FIXTURE_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    prompt:
      "A colleague takes credit for your work in a meeting. Before you say anything, what do you check first?",
    position: 1,
  },
  {
    id: "q2",
    prompt:
      "An algorithm denies you something — a loan, a job screen — and you suspect it's wrong. What matters most?",
    position: 2,
  },
  {
    id: "q3",
    prompt: "A friend asks for harsh, honest feedback on work they're proud of.",
    position: 3,
  },
  {
    id: "q4",
    prompt: "You find a wallet with cash on the street.",
    position: 4,
  },
  {
    id: "q5",
    prompt: "An AI tool could finish your assignment for you, undetected.",
    position: 5,
  },
  {
    id: "q6",
    prompt: "A family member is seriously ill.",
    position: 6,
  },
  {
    id: "q7",
    prompt: "You're asked to review a friend's business plan you think will fail.",
    position: 7,
  },
  {
    id: "q8",
    prompt:
      "You're a passenger in a self-driving car; its software will decide in an unavoidable crash.",
    position: 8,
  },
  {
    id: "q9",
    prompt: "You receive an award you don't think you fully earned.",
    position: 9,
  },
  {
    id: "q10",
    prompt: "A small ethical compromise at work has become a habit.",
    position: 10,
  },
];

export const FIXTURE_QUIZ_OPTIONS: QuizOption[] = [
  { id: "q1a", question_id: "q1", school_id: "stoicism", label: "Whether the outcome is even within my control." },
  { id: "q1b", question_id: "q1", school_id: "utilitarianism", label: "Which response leaves the whole team best off." },
  { id: "q1c", question_id: "q1", school_id: "virtue-ethics", label: "What kind of person I want to be in this room." },

  { id: "q2a", question_id: "q2", school_id: "stoicism", label: "How I respond, since whether the system was fair isn't up to me." },
  { id: "q2b", question_id: "q2", school_id: "utilitarianism", label: "Pushing for an appeals process that minimizes wrongful denials overall." },
  { id: "q2c", question_id: "q2", school_id: "virtue-ethics", label: "What a person of good character does when facing an unjust system." },

  { id: "q3a", question_id: "q3", school_id: "stoicism", label: "Give it calmly regardless of their reaction — that reaction isn't mine to control." },
  { id: "q3b", question_id: "q3", school_id: "utilitarianism", label: "Weigh how the feedback affects them against the value of them improving." },
  { id: "q3c", question_id: "q3", school_id: "virtue-ethics", label: "Ask what an honest friend would actually say, and say that." },

  { id: "q4a", question_id: "q4", school_id: "stoicism", label: "Recognize that what I do says something about my judgment, not my luck." },
  { id: "q4b", question_id: "q4", school_id: "utilitarianism", label: "Consider who needs it most and act for the best overall outcome." },
  { id: "q4c", question_id: "q4", school_id: "virtue-ethics", label: "Return it, because that's simply what an honest person does." },

  { id: "q5a", question_id: "q5", school_id: "stoicism", label: "My obligation is about what I assent to, not whether I'd get caught." },
  { id: "q5b", question_id: "q5", school_id: "utilitarianism", label: "Consider whether using it produces better learning outcomes than not." },
  { id: "q5c", question_id: "q5", school_id: "virtue-ethics", label: "Ask what kind of person I'm training myself to become by using it." },

  { id: "q6a", question_id: "q6", school_id: "stoicism", label: "Separate what I can actually change from what I can't, and act only on the former." },
  { id: "q6b", question_id: "q6", school_id: "utilitarianism", label: "Focus resources and attention where they'll do the most good." },
  { id: "q6c", question_id: "q6", school_id: "virtue-ethics", label: "Show up the way a loving, present person would, regardless of outcome." },

  { id: "q7a", question_id: "q7", school_id: "stoicism", label: "Give my honest judgment — their reaction to it isn't something I control." },
  { id: "q7b", question_id: "q7", school_id: "utilitarianism", label: "Consider whether honesty here does more good than a kind lie would." },
  { id: "q7c", question_id: "q7", school_id: "virtue-ethics", label: "Trust that a good friend tells the truth, and let that guide me." },

  { id: "q8a", question_id: "q8", school_id: "stoicism", label: "What matters is whether I assented to the risk, not what the algorithm computes." },
  { id: "q8b", question_id: "q8", school_id: "utilitarianism", label: "The car should minimize total harm across everyone involved." },
  { id: "q8c", question_id: "q8", school_id: "virtue-ethics", label: "The real test is whether the people who built it acted with integrity, not just correct math." },

  { id: "q9a", question_id: "q9", school_id: "stoicism", label: "My standing rests on my own judgment of the work, not on external recognition." },
  { id: "q9b", question_id: "q9", school_id: "utilitarianism", label: "Consider whether accepting it does more good (funding, visibility) than declining." },
  { id: "q9c", question_id: "q9", school_id: "virtue-ethics", label: "Ask whether accepting it honestly reflects who I am." },

  { id: "q10a", question_id: "q10", school_id: "stoicism", label: "Whether I'd get caught is irrelevant; only my own judgment about the act matters." },
  { id: "q10b", question_id: "q10", school_id: "utilitarianism", label: "Weigh the actual harm caused against what it would cost me to stop." },
  { id: "q10c", question_id: "q10", school_id: "virtue-ethics", label: "Ask whether this is shaping who I'm becoming, and whether I want that." },
];

// Motions carry only an id (matching a debate_topics[].id in the owning
// module), the module, and a scheduling window. The motion's text is never
// duplicated here — src/lib/content.ts#getDebateTopic resolves it from the
// module's frontmatter. Windows rotate roughly weekly; category-error is the
// one currently open.
export const FIXTURE_MOTIONS: Motion[] = [
  {
    id: "gradient-descent",
    module_id: "virtue-ethics-rlhf-habituation",
    opens_at: "2026-08-10T09:00:00Z",
    closes_at: "2026-08-11T09:00:00Z",
  },
  {
    id: "harman-attack",
    module_id: "virtue-ethics-rlhf-habituation",
    opens_at: "2026-08-13T09:00:00Z",
    closes_at: "2026-08-14T09:00:00Z",
  },
  {
    id: "williams-blame",
    module_id: "stoicism-determinism",
    opens_at: "2026-08-17T09:00:00Z",
    closes_at: "2026-08-18T09:00:00Z",
  },
  {
    id: "german-ban",
    module_id: "utilitarianism-self-driving-cars",
    opens_at: "2026-08-20T09:00:00Z",
    closes_at: "2026-08-21T09:00:00Z",
  },
  {
    id: "passenger-sacrifice",
    module_id: "utilitarianism-self-driving-cars",
    opens_at: "2026-08-25T09:00:00Z",
    closes_at: "2026-08-26T09:00:00Z",
  },
  {
    id: "category-error",
    module_id: "stoicism-determinism",
    opens_at: "2026-08-31T09:00:00Z",
    closes_at: "2026-09-04T09:00:00Z",
  },
];

// Standalone condensed teaching shown after a verdict, keyed by motion id.
// Not a teaser and not linked to /lessons.
export const FIXTURE_MICRO_LESSONS: MicroLesson[] = [
  {
    id: "ml-category-error",
    motion_id: "category-error",
    body: `Bernard Williams gave the strongest version of "harmless shorthand" in 1976, though he wasn't writing about machines. A lorry driver kills a child who steps into the road, blamelessly — but he feels something a driver who braked in time never will. Williams calls it agent-regret, and his point is that outcomes carry moral weight the antecedent judgment can't fully absorb. Applied here: if a deployed system causes harm, people assign responsibility by what happened, not by whether anything inside the system resembled an act of assent. Whoever argues "category error" has to answer that before the assent framework holds.`,
  },
  {
    id: "ml-williams-blame",
    motion_id: "williams-blame",
    body: `Chrysippus's cylinder-and-top image, preserved by Cicero in De Fato 42-43, is the Stoic answer available here: a push starts an object moving, but its own nature determines how it moves after. Applied to blame, this says a builder's responsibility tracks their judgment at the point of assent, not the accident of what happened downstream. Williams would reply that this proves too much — it would excuse the blameless lorry driver from agent-regret he plainly still feels. The strongest version of "it matters" has to explain why felt responsibility should track anything other than outcome.`,
  },
  {
    id: "ml-passenger-sacrifice",
    motion_id: "passenger-sacrifice",
    body: `Rawls's objection in A Theory of Justice is the sharpest tool here: utilitarianism, he argues, treats society's welfare the way one person nets gains against losses across their own life — but a passenger sacrificed for five pedestrians isn't compensated by their survival the way a person delaying pleasure for later gain is compensated by their own future self. Whoever argues for minimizing total casualties has to answer why the passenger's death is properly netted against strangers' survival at all, not just show the arithmetic favors five over one.`,
  },
  {
    id: "ml-german-ban",
    motion_id: "german-ban",
    body: `Germany's 2017 Ethics Commission report doesn't just discourage weighing victims against each other — Rule 9 prohibits it outright, and forbids any distinction based on age, gender, or physical condition. The strongest challenge to calling this an advance: refusing to calculate doesn't remove the tradeoff, it just moves it upstream, into whatever default behavior engineers build in before any crash occurs. The strongest challenge to calling it avoidance: a rule against comparing named individuals' worth might be exactly what a just framework has to refuse to do, calculation or not.`,
  },
  {
    id: "ml-gradient-descent",
    motion_id: "gradient-descent",
    body: `Groff and Symons's 2024 answer is the one to know here: a model shaped by rounds of human feedback might reach what they call "nice teenager level morality" — reliably acceptable behavior in familiar situations — without phronesis, the capacity to judge correctly in a genuinely novel case no training example covers. Their claim is that phronesis isn't reducible to a probability distribution over past examples, however large, because it isn't a regularity at all. Whoever argues "it doesn't matter how it got there" needs an answer for novel cases specifically, not just cases the training data already resembles.`,
  },
  {
    id: "ml-harman-attack",
    motion_id: "harman-attack",
    body: `Gilbert Harman's 1999 argument is blunter than people expect: drawing on the Milgram experiments, he claims there's no real empirical basis for stable character traits in humans at all — behavior tracks situational pressure far more than anything like Aristotelian hexis. If Harman is right, the debate about whether AI training can replicate habituation is aimed at something that was never real even for humans. Either the AI question is premature, or Aristotle's whole framework needs its own defense against Harman first, independent of any machine.`,
  },
];

export const FIXTURE_SUBMISSIONS: Submission[] = [
  // category-error is the currently open motion: one submission in, awaiting
  // an opponent.
  {
    id: "s-halcyon-category-error",
    motion_id: "category-error",
    profile_id: "p-halcyon",
    side: "for",
    body: `Epictetus's whole doctrine rests on one act: assent, giving or withholding judgment about an impression. A model has no impression to assent to and no self to withhold agreement with — it computes a distribution and samples from it. Calling that output a "decision" borrows the one word Epictetus reserved for what's actually ours and hands it to a process with no candidate for that act anywhere in the pipeline. That isn't shorthand. It's the confusion the Enchiridion opens by correcting, now aimed at a machine.`,
    created_at: "2026-09-01T15:20:00Z",
  },
  // passenger-sacrifice is judged: a human submission against the stubbed
  // system opponent, demonstrating the fallback-matching path.
  {
    id: "s-benthamite-passenger",
    motion_id: "passenger-sacrifice",
    profile_id: "p-benthamite",
    side: "for",
    body: `Bentham's calculus doesn't stop counting at the windshield. Extent, his word for how many people a choice touches, makes no exception for whoever's inside the car. Awad et al.'s Moral Machine data — forty million decisions, 233 countries — found broad, if not universal, preference for minimizing deaths regardless of who they are. A car that refuses to minimize harm doesn't dodge the tradeoff, it just lets whoever's in its path absorb it by accident instead of design. Refusing to choose is still a choice, and a worse one.`,
    created_at: "2026-08-25T11:10:00Z",
  },
  {
    id: "s-system-passenger",
    motion_id: "passenger-sacrifice",
    profile_id: "system",
    side: "against",
    body: `Rawls's charge against utilitarianism is exact here: it treats the passenger's death as compensated by five strangers' survival, the way a person nets a cost today against their own gain tomorrow. But the passenger isn't the five pedestrians' future self. Summing welfare across different people erases a distinction utilitarianism has no principled way to notice. A rule that minimizes the count still can't say why that particular passenger was the one available to be spent.`,
    created_at: "2026-08-25T11:45:00Z",
  },
];

export const FIXTURE_MATCHES: Match[] = [
  {
    id: "match-passenger-sacrifice",
    motion_id: "passenger-sacrifice",
    submission_a: "s-benthamite-passenger",
    submission_b: "s-system-passenger",
    status: "judged",
  },
];

export const FIXTURE_VERDICTS: Verdict[] = [
  {
    id: "v-passenger-sacrifice",
    match_id: "match-passenger-sacrifice",
    winner_submission_id: "s-benthamite-passenger",
    scores: {
      a: { logic: 8, sources: 8, answers_opponent: 7, clarity: 8 },
      b: { logic: 7, sources: 7, answers_opponent: 5, clarity: 7 },
    },
    rationale:
      "The affirmative anticipates the Rawlsian reply before it arrives, reframing inaction itself as a choice with a body count, which blunts the force of 'the calculus shouldn't net people together.' The negative states Rawls's objection precisely but never engages the affirmative's actual claim that refusing to calculate doesn't remove the tradeoff, only relocates it.",
  },
];

export const FIXTURE_DEFECTIONS: Defection[] = [
  {
    id: "d-turncoat-1",
    profile_id: "p-turncoat",
    from_school_id: "utilitarianism",
    to_school_id: "stoicism",
    reason:
      "Lost three debates arguing the utilitarian case on the self-driving car passenger question, and every time the reply built on Rawls landed harder than my arithmetic did.",
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
    id: "t-rawls-mm",
    channel: "utilitarianism",
    profile_id: "p-benthamite",
    title:
      "Rawls says the passenger isn't compensated by the five who survive. Does the Moral Machine data undercut that, or just describe preference?",
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
    title: "Why I left utilitarianism arguing the passenger question",
    created_at: "2026-08-14T20:12:00Z",
  },
];

export const FIXTURE_POSTS: Post[] = [
  {
    id: "post-1",
    thread_id: "t-cylinder",
    profile_id: "p-halcyon",
    body: "Everyone reads De Fato 42-43 as a physics claim about shape. I think it's a claim about ownership: the rolling is the cylinder's because nothing else's shape explains it. On that reading, weights are shape.",
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
    body: "You're both doing metaphysics where an empirical question sits. Does treating models as responsible produce better outcomes than treating them as pipes? That's answerable, and neither of you has touched it.",
    created_at: "2026-08-20T19:47:00Z",
  },
  {
    id: "post-4",
    thread_id: "t-rawls-mm",
    profile_id: "p-benthamite",
    body: "40 million Moral Machine decisions and the preference for minimizing deaths shows up almost everywhere it was tested. If that many people converge on the same tradeoff independently, at what point does Rawls's objection stop being a knockdown argument and start being a minority taste?",
    created_at: "2026-08-21T09:40:00Z",
  },
  {
    id: "post-5",
    thread_id: "t-rawls-mm",
    profile_id: "p-turncoat",
    body: "Convergence tells you what people prefer, not whether the preference survives being asked to justify itself to the one person it costs. Rawls's point was never that the arithmetic is unpopular. It's that the passenger has no stake in the five strangers' survival the way your own future self has a stake in your own future pleasure.",
    created_at: "2026-08-21T13:12:00Z",
  },
  {
    id: "post-6",
    thread_id: "t-rawls-mm",
    profile_id: "p-mesotes",
    body: "You're both arguing about the math and skipping the part that actually gets built: some engineer picks the default before any crash happens. I'd rather ask what kind of judgment went into that choice than whether the outcome column adds up correctly after the fact.",
    created_at: "2026-08-21T18:03:00Z",
  },
  {
    id: "post-7",
    thread_id: "t-phronesis",
    profile_id: "p-mesotes",
    body: "Groff and Symons's line that keeps bothering me: phronesis isn't reducible to a distribution over past examples because it isn't a regularity at all. If that's right, no amount of RLHF closes the gap, not because the model isn't good enough yet, but because the target was never the kind of thing more data gets you closer to.",
    created_at: "2026-08-22T17:05:00Z",
  },
  {
    id: "post-8",
    thread_id: "t-phronesis",
    profile_id: "p-benthamite",
    body: "\"Isn't a regularity at all\" is doing a lot of work for a claim with no test attached. Show me a novel case a fine-tuned model handles badly that a person with practical wisdom would handle well, reliably, and I'll take the distinction seriously. Until then it reads like a definition built to be unfalsifiable.",
    created_at: "2026-08-23T08:30:00Z",
  },
  {
    id: "post-9",
    thread_id: "t-defection",
    profile_id: "p-turncoat",
    body: "Three debates running the utilitarian side of the passenger question, and three times the reply built on Rawls landed harder than my own arithmetic. At some point defending a calculus you keep losing with, against an objection you find convincing, has a name. It's called changing your mind.",
    created_at: "2026-08-14T20:12:00Z",
  },
  {
    id: "post-10",
    thread_id: "t-defection",
    profile_id: "p-halcyon",
    body: "Welcome. For what it's worth, the calculus was never wrong about the arithmetic, only about who's allowed to be summed with whom.",
    created_at: "2026-08-15T07:58:00Z",
  },
];
