# Working on Sophecs

## Branching and deploys

**`main` is production. A merge into it is a deploy.**

- Start every piece of work on a new branch cut from `main`:
  `git fetch origin main && git checkout -b <short-name> origin/main`
- Push that branch. Vercel builds it as a **preview** deployment, with its
  own URL, and production is untouched.
- Open a pull request into `main`. Review it as **The review loop** below
  says, then merge it yourself and confirm the merge commit against
  `git ls-remote origin main` and the production deploy as Ready.
- Never push to `main` directly, and never change the Vercel production
  branch setting.

Until 2026-10-24 Arthur merged every pull request himself. He now merges
only what the review loop sends him, which is the list below and nothing
else. Everything that is not on that list, you review, fix, merge and
confirm.

## The review loop

Replaced the old loop on 2026-10-24, to cut round trips. Per step of work:

1. Do the work and get the five gates green.
2. Push the branch and open the pull request.
3. **Spawn a fresh reviewer that has not seen the work.** Give it the diff
   and `docs/review-charter.md`, and ask for findings against the charter.
   A reviewer that inherits the context of whoever wrote the code is not a
   reviewer; it agrees.
4. Fix what it finds. Re-review. Repeat until the findings are either fixed
   or answered.
5. Put the findings and the fixes in the pull request body, including the
   ones you disagreed with and why.
6. Merge, confirm the SHA, confirm the deploy is Ready.

`docs/review-charter.md` is the standard the review runs against. It grows
whenever Arthur or a reviewer catches something the charter would have
missed; adding the rule is part of fixing the finding.

### What still stops for Arthur

Five things. Everything else you finish and merge.

- **(a) Production database writes.** Any migration, DDL or write to a
  production table. Reading is fine.
- **(b) Changes to what the judge receives.** The system prompt, the
  fidelity criteria, the motion, the stance, the argument. Judging is live
  and no production verdict may change, so any of these needs his yes and
  the six request fixtures proved byte-identical either side of it.
- **(c) Publishing a draft.** A school, a lesson or a motion becoming
  visible.
- **(d) Spending money.** Any run that bills an API, and any change to a
  cost cap, model or budget.
- **(e) Philosophy and content judgements.** School criteria, fixture
  bands, school text, which tradition says what.

(e) items are **batched into one decision list per phase**, with the file
each one lives in, rather than raised one at a time. A step whose only
blocker is an (e) item is finished up to that point, pushed, and left open
with the list.

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
npm run check:bundle
```

All five must pass. `npm run build` catches things `tsc` does not —
notably Satori rendering in the image routes, and the `server-only`
boundary.

`npm run check:bundle` runs last because it reads the build. It greps
`.next/static` for any draft school's id or name and fails if one is
there, which is the Phase 1B guarantee that no draft reaches a page or a
bundle. It was added after a registry that enumerated every school put
three unreleased school names into thirteen production client chunks; the
other four gates were all green at the time.

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
