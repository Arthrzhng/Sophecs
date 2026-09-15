import { z } from "zod";

export const PROMPT_VERSION = "v2" as const;

// Every version that has ever been stored. `debates.verdict` rows written
// before a bump keep their own stamp, so a stored verdict is not typed to
// whatever the current version happens to be — v1 rows exist in production
// and have no `unanswered_objection`.
export type PromptVersion = "v1" | "v2";

function maxWords(max: number) {
  return (val: string) => val.trim().split(/\s+/).filter(Boolean).length <= max;
}

export const SCHOOL_IDS = ["stoicism", "utilitarianism", "virtue-ethics"] as const;

// What the model must return. `rejected` discriminates the two valid
// shapes — a judged verdict has every score field, a rejection has none.
// Anything else (missing fields, wrong types, a word-count breach) fails
// validation and the debates row stays verdict: null with the argument
// intact — see /api/judge.
export const VerdictSchema = z.discriminatedUnion("rejected", [
  z.object({
    rejected: z.literal(true),
    rejection_reason: z.string().min(1).max(200),
  }),
  z.object({
    rejected: z.literal(false),
    score: z.number().min(0).max(100),
    fidelity: z.number().min(0).max(10),
    rigor: z.number().min(0).max(10),
    engagement: z.number().min(0).max(10),
    strongest_move: z.string().min(1).refine(maxWords(40), "strongest_move exceeds 40 words"),
    weakest_move: z.string().min(1),
    a_stronger_version_would: z
      .string()
      .min(1)
      .refine(maxWords(60), "a_stronger_version_would exceeds 60 words"),
    verdict_line: z.string().min(1).refine(maxWords(20), "verdict_line exceeds 20 words"),
    // v2: the one objection a rival school would raise that this argument
    // never answered. The route additionally checks `school` differs from
    // the argued school — zod can't see the argued school from here.
    unanswered_objection: z.object({
      school: z.enum(SCHOOL_IDS),
      claim: z
        .string()
        .min(1)
        .refine(maxWords(45), "unanswered_objection.claim exceeds 45 words"),
      why_it_stands: z
        .string()
        .min(1)
        .refine(maxWords(35), "unanswered_objection.why_it_stands exceeds 35 words"),
    }),
    // Present only on a revision (Task 2). Optional so an original's
    // verdict validates without them.
    objection_answered: z.boolean().optional(),
    improvement_note: z
      .string()
      .refine(maxWords(40), "improvement_note exceeds 40 words")
      .optional(),
  }),
]);

export type ModelVerdict = z.infer<typeof VerdictSchema>;

// What's stored in debates.verdict — the model's response plus the version
// stamp the server adds, never the model itself (see docs/decisions.md:
// scores across prompt versions are never compared as equivalent).
// Typed to the union, not the current version: reading a v1 row back must
// not claim it has v2's fields. Render sites branch on presence.
export type StoredVerdict = ModelVerdict & { prompt_version: PromptVersion };
