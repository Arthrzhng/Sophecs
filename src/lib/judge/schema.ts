import { z } from "zod";
import { PUBLISHED_SCHOOL_IDS, type SchoolId } from "@/lib/school-registry";

export const PROMPT_VERSION = "v2" as const;

// Every version that has ever been stored. `debates.verdict` rows written
// before a bump keep their own stamp, so a stored verdict is not typed to
// whatever the current version happens to be — v1 rows exist in production
// and have no `unanswered_objection`.
export type PromptVersion = "v1" | "v2";

function maxWords(max: number) {
  return (val: string) => val.trim().split(/\s+/).filter(Boolean).length <= max;
}

// A length cap in UTF-16 code units, as zod 3's .max() counted. zod 4.5 and
// later count .max() in code points, which lets an emoji-heavy string run
// to twice the cap; Arthur's ruling of 2026-11-05 moved to zod 4 on the
// condition that v2 behaves as before (docs/decisions.md, "zod 4").
function maxUnits(max: number) {
  return (val: string) => val.length <= max;
}

// The schools a verdict may name. Published only: a verdict naming a
// school still in draft would be a verdict about something no reader can
// see. The cast is zod's tuple requirement, not a widening; the enum's
// members are checked against the registry in tests/school-registry.test.ts.
const JUDGEABLE_SCHOOLS = PUBLISHED_SCHOOL_IDS as unknown as [SchoolId, ...SchoolId[]];

// What the model must return. `rejected` discriminates the two valid
// shapes — a judged verdict has every score field, a rejection has none.
// Anything else (missing fields, wrong types, a word-count breach) fails
// validation and the debates row stays verdict: null with the argument
// intact — see /api/judge.
export const VerdictSchema = z.discriminatedUnion("rejected", [
  z.object({
    rejected: z.literal(true),
    rejection_reason: z.string().min(1).refine(maxUnits(200), "rejection_reason exceeds 200 characters"),
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
      school: z.enum(JUDGEABLE_SCHOOLS),
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
    //
    // null is accepted on an original and treated as absent (Arthur's
    // ruling of 2026-11-05, under (b)): in the v3 run of 22:08 UTC, 31
    // replies to originals carried both fields as null and were refused,
    // losing two samples. The schema cannot tell an original from a
    // revision, so callJudgeModel (src/lib/anthropic.ts) refuses a
    // revision's null after this runs, with whatever else this refused, as
    // it was refused before the ruling. The transform leaves the key in the parsed verdict with the
    // value undefined, which JSON.stringify drops, so what is stored is the
    // same as for a reply that omitted it.
    objection_answered: z
      .boolean()
      .nullable()
      .transform((v) => v ?? undefined)
      .optional(),
    improvement_note: z
      .string()
      .refine(maxWords(40), "improvement_note exceeds 40 words")
      .nullable()
      .transform((v) => v ?? undefined)
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
