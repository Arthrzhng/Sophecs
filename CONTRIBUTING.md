# Working on Sophecs

## Branching and deploys

**`main` is production. Nothing reaches it except by Arthur's merge.**

- Start every piece of work on a new branch cut from `main`:
  `git fetch origin main && git checkout -b <short-name> origin/main`
- Push that branch. Vercel builds it as a **preview** deployment, with its
  own URL, and production is untouched.
- Open a pull request into `main`. Arthur merges it. The merge is what
  deploys.
- Never push to `main` directly, and never change the Vercel production
  branch setting.

### Why this file exists

Until 2026-09-19 the Vercel project's production branch was set to
`claude/sophecs-skeleton-0zvs5m`, the working branch. Every push to that
branch deployed straight to production — eight phases of a presentation
rebuild went live one commit at a time, with no preview step and no point
at which anyone chose to ship. Nobody decided that; it was a setting
nobody had looked at. `main` exists now so that the branch you are working
on and the branch the public sees are different branches.

If you are an agent session picking this up: check `git remote show origin`
for the default branch before you push anything, and assume a push is a
deploy until you have confirmed otherwise.

## Before you push

```
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

All four must pass. `npm run build` catches things `tsc` does not —
notably Satori rendering in the image routes, and the `server-only`
boundary.

## Things that are frozen

Do not change these without Arthur saying so explicitly. They are product
and safety decisions, not implementation details:

- `content/**` — the motions, the micro-lessons, the school pages. Report
  a typo rather than fixing it.
- `content/prompts/judge.v1.md` and `judge.v2.md`
- `src/app/api/**`, `src/app/actions.ts`
- `src/lib/supabase/**`, `supabase/**` (schema and RLS)
- `src/lib/anthropic.ts`, `src/lib/elo.ts`, `src/lib/streak.ts`,
  `src/lib/judge-allowlist.ts`
- The `KILL_SWITCH_JUDGE` and `JUDGE_ALLOWLIST_USER_IDS` env handling

## Local-only environment

`SOPHECS_PREVIEW=1` in `.env.local` enables `/styleguide/arena`, a preview
of the debate screens against fixtures. It is deliberately **not** set in
Vercel, so that route builds as a static 404 on every deployment. Keep it
that way: the fixtures are not real data and the page has no business
being reachable.

## The design rules

`design/tokens.md` and `design/layout.md` are the approved plan, and the
phase reports in the git log record where the built thing deviates from
them and why. Two rules that a linter cannot enforce and that have already
been broken once each:

- **One type scale, one radius scale.** Tailwind's own `text-2xl` and
  `rounded-md` are cleared in `globals.css` with `--text-*: initial` and
  `--radius-*: initial`, so a stray one fails to apply rather than quietly
  disagreeing with the six steps next to it.
- **No colour literal outside `src/lib/card-tokens.ts`.** Satori cannot
  read CSS custom properties, so the image routes need literals; they all
  read them from that one file. Four separate copies had drifted before it
  existed.
