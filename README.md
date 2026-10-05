# Sophecs

Philosophy and AI, taught through allegiance. A ten-question diagnostic
places you in one of three schools of ethics (Stoicism, Utilitarianism,
Virtue Ethics). You then argue an AI-related motion from that school, and a
judge scores how faithfully you argued from it rather than whether it agrees
with you. A lessons library holds the primary-source passages behind each
motion.

Live at [sophecs.com](https://sophecs.com). Built for 15 to 18 year olds.

## Running it

```
npm install
npm run dev
```

The site builds and renders without any environment variables, but the
parts backed by a service degrade rather than work:

- **No Supabase credentials:** quiz submission fails gracefully and
  `/r/[id]` returns 404. Sign-in, the arena, and `/me` need a real project.
- **No `ANTHROPIC_API_KEY`:** `/api/judge` returns its paused state instead
  of a verdict.
- **No `NEXT_PUBLIC_POSTHOG_KEY`:** analytics calls no-op.

`.env.example` documents every variable. `supabase/migrations/` holds the
schema, applied in order. `npm run seed:topics` upserts `content/topics/`
into the `debate_topics` table; the other content directories are read off
disk at build or request time and need no seed step.

Checks, all of which must pass before a push:

```
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

## Judging is deliberately paused

`KILL_SWITCH_JUDGE=true` is the default in `.env.example`, and it is on in
production. Arguments are not sent to the judge while it is on, and the
debate screens say so. The switch stays on until a batch of real verdicts
has been reviewed for quality.

The judge itself is a real model call, not a stub: `src/lib/anthropic.ts`
sends the prompt in `content/prompts/judge.v2.md` (the active version) to
`claude-sonnet-5`. It scores three criteria, in this order of weight:
Fidelity, Rigor and Engagement. It returns a combined score out of 100
alongside them. The criteria are published at `/debate/rubric`, and what the
score does and does not mean is at `/method`.

## Where things live

- `content/topics/`: six motions, frontmatter only, one file each. Each
  carries a one-sentence stance for all three schools; motions are not
  owned by a single school.
- `content/micro/`: twelve micro-lessons, a before and an after for every
  motion, each with one primary source. Read by `src/lib/micro-lessons.ts`.
- `content/schools/`: the three school pages behind `/s/[school]`.
- `content/quiz/questions.ts`: the ten diagnostic questions.
- `content/prompts/`: the judge prompts (`judge.v1.md`, `judge.v2.md`) and
  the counterpart screening prompt.
- `content/modules/`: **empty.** Longer teaching units slot in here and
  `/lessons` grows a Modules section the moment a file lands. The schema is
  documented in that directory's README. The lessons index is complete
  without them.
- `src/lib/supabase/`: the Supabase clients. There is no fixtures fallback;
  without credentials the backed features degrade as listed above.
- `src/lib/elo.ts`: Elo, K=32.
- `supabase/`: schema and row-level security policies.

## Design system

Paper and ink; colour is allegiance. The three school colours appear only to
mark a school, and the quiz result card is the single fully saturated surface
in the product. Spectral carries anything that is an argument, IBM Plex Sans
carries the interface, IBM Plex Mono carries anything measured. Tokens are
defined once in `src/app/globals.css` under Tailwind v4's `@theme static`.
No dark mode. The written plan is in `design/tokens.md` and
`design/layout.md`.

## Not built

No real-time features, notifications, payments, or moderation queue beyond
the counterpart reply screening. There is no evidence yet that any of this
improves anyone's reasoning, and the site makes no such claim. A fourth
school is a content change rather than a code change: everything is keyed by
school id.

Contributor rules, including the frozen paths, are in `CONTRIBUTING.md`.
