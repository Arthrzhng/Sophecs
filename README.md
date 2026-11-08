# Sophecs

Philosophy and AI, taught through allegiance. A ten-question diagnostic
places you in one of six schools of ethics (Stoicism, Utilitarianism,
Virtue Ethics, Confucianism, Ubuntu and Buddhist Ethics), as a point on a
map of the six. You then argue an AI-related motion from that school, and a
judge scores how faithfully you argued from it rather than whether it agrees
with you. A lessons library holds the primary-source passages behind each
motion.

Live at [sophecs.com](https://sophecs.com). Built for 15- to 18-year-olds.

The six are shown by the `SIX_SCHOOLS=1` flag, which production has had
since the launch on 2026-11-08. A build without it is the site as it was
before: three schools and the first quiz. `docs/stage5-plan.md` has the
history.

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

Checks, all five of which must pass before a push:

```
npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run check:bundle
```

`npm run check:bundle` reads a build without the flag and fails if one of
the three new schools' id, name, adherent noun or colour is in any client
chunk, and `npm run check:bundle:six` checks that a flag-on build carries
them. `CONTRIBUTING.md` says why, and `docs/review-charter.md` is the
standard a step is reviewed against.

## Judging is live, deliberately

`KILL_SWITCH_JUDGE=true` is still the default in `.env.example`, and while
it is on no argument is sent to the judge and the debate screens say so.
Arthur has turned it off in production, having reviewed a batch of real
verdicts for quality himself. He said so directly, and that instruction is
the only record: the production value is not in this repository and no
commit here changed it. `docs/decisions.md` carries the entry.

**Do not change the switch or `JUDGE_ALLOWLIST_USER_IDS`.** Real
submissions are being scored, so the standing rule is that no production
verdict may change: any change to what the judge receives needs Arthur's
yes, and proof that the request is byte-identical where a fixture covers
it: `tests/judge-request/six-schools/` for the six on a flag-on build, and
`tests/judge-request/` for the three on a build without it. Unchanged
fixtures do not by themselves clear this. `docs/review-charter.md` rule 2
says what else counts.

The judge itself is a real model call, not a stub: `src/lib/anthropic.ts`
sends the prompt in `content/prompts/judge.v3.md` on a flag-on build, as
production is (`judge.v2.md` on a build without the flag), to
`claude-sonnet-5`. Each school's fidelity criteria are in
`src/lib/judge/rubric.ts`. It scores three criteria, in this order of weight:
Fidelity, Rigor and Engagement. It returns a combined score out of 100
alongside them. The criteria, and what the score does and does not mean,
are published at `/how-it-works` (on a build without the flag,
`/debate/rubric` and `/method`).

## Where things live

- `content/topics/`: six motions, frontmatter only, one file each. Each
  carries a one-sentence stance for all six schools; motions are not
  owned by a single school.
- `content/micro/`: twelve micro-lessons, a before and an after for every
  motion, each with one primary source, and six "view from elsewhere"
  passages, one per motion. Read by `src/lib/micro-lessons.ts`.
- `content/schools/`: the six school pages behind `/s/[school]`.
- `docs/quiz-v2.json`: the ten diagnostic questions and the map, as
  Arthur accepted them; `content/quiz/questions.ts` is the first quiz,
  which a build without the flag still asks.
- `content/prompts/`: the judge prompts (`judge.v1.md`, `judge.v2.md` and
  `judge.v3.md`, the one production sends) and the counterpart screening
  prompt.
- `content/modules/`: six longer teaching units, one per school, plus a
  README documenting the schema. `/lessons` grows a Modules section from
  them. It was empty when this section was written.
- `src/lib/supabase/`: the Supabase clients. There is no fixtures fallback;
  without credentials the backed features degrade as listed above.
- `src/lib/elo.ts`: Elo, K=32.
- `supabase/`: schema and row-level security policies.

## Design system

Paper and ink; colour is allegiance. The six school colours appear only to
mark a school, and the quiz result card is the single fully saturated surface
in the product. Spectral carries anything that is an argument, IBM Plex Sans
carries the interface, IBM Plex Mono carries anything measured. Tokens are
defined once in `src/app/globals.css` under Tailwind v4's `@theme static`.
No dark mode. The written plan is in `design/tokens.md` and
`design/layout.md`.

## Not built

No real-time features, notifications, payments, or moderation queue beyond
the counterpart reply screening. There is no evidence yet that any of this
improves anyone's reasoning, and the site makes no such claim. A further
school is mostly a content change, since everything is keyed by school id;
the three added at the launch also needed their criteria approved and a
place on quiz v2's map.

Contributor rules, including the frozen paths and the review loop, are in
`CONTRIBUTING.md`. The standard a step of work is reviewed against is
`docs/review-charter.md`, and the decisions already taken and why are in
`docs/decisions.md`.
