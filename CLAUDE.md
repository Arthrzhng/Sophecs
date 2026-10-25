# Sophecs

Philosophy × AI, taught through allegiance: a diagnostic quiz sorts you into
one of three schools, an async arena makes you defend that school on
AI-related motions, and a lessons library teaches each school from its
primary sources.

- Repository: https://github.com/Arthrzhng/Sophecs (public)
- Production: https://sophecs.com

**Read `CONTRIBUTING.md` first.** It is the authority on branching, frozen
paths, and the pre-push gate. `README.md` covers what lives where. This file
is the short version, plus the few rules that live nowhere else.

## Stack

Next.js 15 (App Router), React 19, TypeScript `strict`, Tailwind v4,
Supabase, Vercel, PostHog (EU region).

Tailwind v4 is CSS-first: the theme is declared in `src/app/globals.css`
under `@theme static`, not in a `tailwind.config` file. The `static` is load
bearing — bare `@theme` tree-shakes theme variables that are only referenced
through other custom properties.

## Branching and deploys

`main` is production. Never push to it directly, and never change the Vercel
production branch setting.

Cut every branch from `main` and push it. Then review it the way
`CONTRIBUTING.md` says: a fresh reviewer that has not seen the work, given
the diff and `docs/review-charter.md`. Fix what it finds, put the findings
and the fixes in the pull request body, then **merge it yourself and
confirm the SHA and that the production deploy is Ready**. The merge is the
deploy.

Arthur merges nothing now. Five things stop for him and the rest is yours
to finish: **(a)** production database writes, **(b)** changes to what the
judge receives, **(c)** publishing a draft, **(d)** spending money (a billed run, or a change to a cost cap, rate
limit, model or budget), and **(e)** philosophy or content judgements. (e) items are batched into one
decision list per phase, with the file each lives in, not raised one at a
time. `CONTRIBUTING.md` has the long version of all of this.

    git fetch origin main && git checkout -b <short-name> origin/main

As of 2026-10-25 `main` is at efa2173. Confirm with `git ls-remote origin main`
rather than trusting that number — it goes stale on the next merge.

## Before pushing

All five must pass:

    npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run check:bundle

`npm run build` catches what `tsc` does not: Satori rendering in the image
routes, and the `server-only` boundary. `npm run check:bundle` reads that
build and fails if a draft school's id or name is in any client chunk.
`CONTRIBUTING.md` says why.

## Frozen

Product and safety decisions, not implementation details. Do not edit these
without Arthur saying so explicitly:

- `content/**` — the motions, micro-lessons, school pages, and the judge
  prompts. Report a content typo rather than fixing it.
- `src/app/api/**`, `src/app/actions.ts`
- `src/lib/supabase/**`, `supabase/**`
- `src/lib/anthropic.ts`, `src/lib/elo.ts`, `src/lib/streak.ts`,
  `src/lib/judge-allowlist.ts`
- `src/lib/judge/rubric.ts` and `src/lib/judge/schema.ts` — the fidelity
  criteria and `PROMPT_VERSION`. Frozen under (b): a change to either
  changes what the judge receives without moving a request fixture.
- The `KILL_SWITCH_JUDGE` and `JUDGE_ALLOWLIST_USER_IDS` env handling

## Design

`design/tokens.md` and `design/layout.md` are the approved plan. Two rules a
linter cannot enforce, each already broken once:

- **One type scale, one radius scale.** Tailwind's own `text-2xl` and
  `rounded-md` are cleared with `--text-*: initial` and `--radius-*: initial`,
  so a stray one fails to apply rather than quietly disagreeing with the six
  steps next to it.
- **No colour literal outside `src/lib/card-tokens.ts`.** Satori cannot read
  CSS custom properties, so the image routes need literals; they all read them
  from that one file.

## Content and dependencies

- Real content only: no lorem ipsum, no invented copy, no emoji.
- No new runtime dependency without telling Arthur why first.
