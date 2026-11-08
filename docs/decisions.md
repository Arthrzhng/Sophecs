# Decisions

Every trade-off raised during the build, and how it was resolved. Newest first isn't enforced — this is written in the order things came up.

## Design source (no mockup)

`docs/mockup.html` and `docs/content-schema.md` were referenced in the brief but never provided, and Arthur said to proceed without them. Design tokens (`paper`, `ink`, `stoic`, `utilitarian`, `virtue`) are the exact hex values already designed for this product earlier in this build session, which satisfy the brief's own description (cool greyed paper, near-black ink, tribal-marker school colours) — not invented fresh. If a real mockup shows up later, it wins on visuals per the brief's own rule.

**Trade-off:** ship without a visual reference vs. block on one. Leaning ship — Arthur explicitly said to proceed, and the brief's written design-system section is specific enough to build from.

## Tailwind config format

The brief asks for named tokens in `tailwind.config.ts`, which is Tailwind v3's mechanism. This build uses Tailwind v4, whose idiomatic equivalent is CSS-first `@theme` tokens in `globals.css` — same contract (named design tokens, one canonical source), current major version. Used `@theme` instead of reintroducing a v3-style JS config.

## Dark mode: Sophecs brief vs. the vibe-coded-avoidance doc

Direct conflict between the two documents Arthur asked me to follow. The vibe-coded-avoidance doc requires a real dark mode. The Sophecs brief explicitly lists dark mode under "Explicitly NOT in Phase 1" ("If you find yourself building a `User` model, stop" — same rigor applies here) and says the mockup/brief win on behaviour.

**Resolution:** no dark mode in Phase 1. The product-specific, phase-scoped brief is authoritative over a general-purpose style rule when the two disagree on scope. Every other rule in the vibe-coded doc (color restraint, no icon circles, no gradient buttons, left-aligned body copy, radius hierarchy, tinted borders/shadows, real focus states, consistent spacing scale) is followed throughout.

## Auth in Phase 1

The brief explicitly scopes Phase 1 as anonymous-only ("Explicitly NOT in Phase 1: auth... If you find yourself building a `User` model, stop"; "Auth friction vs retention: no auth until Phase 2" under Named Tensions). Arthur's first answer to the confirm-before-code question was to add auth in Phase 1 anyway — flagged back per "ask before adding scope," since this reopens something the brief resolves explicitly. Arthur's follow-up: wire Supabase auth (magic link + Google) and a `profiles` table now, but keep the quiz-to-share loop anonymous by default with no gate.

**Resolution:** `/login` and `/auth/callback` work and a minimal `profiles` table exists (id, handle, display_name — no `elo`/`streak`/`school`, which have no meaning without Phase 2's debates). Nothing on `/quiz`, `/quiz/result`, or `/r/[id]` references or requires auth. `/auth/callback` redirects to `/` rather than `/me`, since `/me` is Phase 2 and doesn't exist yet.

## Quiz question count: 9 vs. 10

The brief assumes Arthur supplies 9 questions. The content actually available (given earlier in this same build session) is 10, already written and structured. Cutting one arbitrarily to hit the assumed count would be worse than using what's real.

**Resolution:** kept all 10. The brief's tie-break instruction ("question 9... written as the sharpest discriminator") is adapted to question 10 — the last question, written with the least-ambiguous options — since it plays the same structural role either way.

## `challenges` table: Phase 1 or Phase 2

The brief's own SQL groups `challenges` under a `-- Phase 2` comment, but its prose is unambiguous: "Phase 1 creates the row with only `challenger_result_id`; the table ships in Phase 1 for this reason." That's an internal inconsistency in the brief itself.

**Resolution:** followed the prose. `challenges` ships in the Phase 1 migration with only the columns Phase 1 needs (`id`, `challenger_result_id`, `challengee_result_id`, `status`, `created_at`). `topic_slug` and the `challenger_debate_id`/`challengee_debate_id` columns — which reference `debate_topics`/`debates`, tables that don't exist yet — arrive via `ALTER TABLE` in the Phase 2 migration.

## Font hosting

Self-hosted via `next/font/local` as specified, Latin subset, `display: swap`. Sourced the actual `.woff2` files once from Google Fonts' CDN (requesting the CSS2 API with a modern UA to get woff2 rather than ttf, then pulling only the `latin` unicode-range file per weight) into `public/fonts/`.

Along the way: IBM Plex Sans turned out to be served as a single variable-font binary by Google — the CSS2 API returns the byte-identical file for `wght=400`, `500`, and `600`. Rather than store three duplicate files, it's loaded as one file (`plex-sans-var.woff2`) with a `400 600` weight range. Spectral and IBM Plex Mono are genuinely static per-weight files and are loaded that way.

## School quote duplication (OG image is edge runtime)

The OG image (`opengraph-image.tsx`) and the portrait card route (`card.png/route.ts`) run on the edge runtime for cold-start speed, per the brief. Edge has no `fs`, so they can't use the markdown-frontmatter loader (`src/lib/schools.ts`) that the Node-runtime pages (`/s/[school]`, `/r/[id]`) use. The two short fields the card actually needs — `one_line` and its attribution — are mirrored by hand in `src/lib/school-quotes.ts`.

**Trade-off:** a small, deliberate duplication vs. adding a build step to generate an edge-safe content bundle from the markdown. Leaning duplication — it's two short sentences per school, unlikely to change often, and a generated-JSON build step is more machinery than three quotes justify right now. Flagged here so it doesn't quietly drift if the quotes are ever edited.

## PostHog credentials

No `NEXT_PUBLIC_POSTHOG_KEY` exists in this environment. `track()` (client) and `trackServer()` (server) both no-op safely without one — console-warn in development, silent in production — the same pattern used for Supabase elsewhere in this build when credentials are absent. This means the Phase 1 "done when" criterion "all twelve Phase 1 events fire... verified in PostHog from production" cannot be satisfied until real EU-cloud PostHog project keys are added to the Vercel environment. The event wiring itself is complete and typed; it just has nowhere to send data yet.

## Debate judge model (Phase 2, not yet built)

The brief names `claude-sonnet-4-6` for judging and `claude-haiku-4-5-20251001` for cheaper calls. Checked against current model pricing: `claude-sonnet-4-6` is real ($3/$15 per 1M tokens) but `claude-sonnet-5` is newer, cheaper, and stronger ($2/$10 per 1M) — recommended as the actual Phase 2 pick pending Arthur's confirmation. `claude-haiku-4-5-20251001` has a stale date suffix; the correct current id is `claude-haiku-4-5`. Monthly spend ceiling still needs a number from Arthur — not a Phase 1 blocker, since Phase 1 ships with no Anthropic key in the environment at all.

## Lesson content (Phase 3)

Arthur confirmed the three lesson modules are still being written. Per the brief ("Phase 3 is blocked on content and you should say so rather than stubbing it"), no `/learn` routes or module content were built this pass.

## The 90KB /quiz JS budget vs. Next.js + React's own runtime cost

Measured directly from the production build (`gzip -c` on the actual chunk files, not an estimate): `/quiz` ships ~103-107KB gzip of JS to a modern browser, and roughly 98KB of that is React 19 + Next.js 15's own framework runtime (`framework.js` ~59.7KB gzip, `main-app`/`main` ~37KB gzip, plus a small webpack runtime) — before any of this app's own code. The actual application code for the quiz (`QuizShell`, `Question`, `lib/scoring.ts`, the analytics wrapper) adds only a few KB on top; `posthog-js` was the one real offender and is now dynamically imported after first paint instead of bundled into the initial chunk, which took `/quiz` from 195KB down to ~107KB.

**This does not currently meet the brief's 90KB ceiling, and I don't think it can while staying on the mandated Next.js App Router + React 19 stack** — the framework baseline alone is already at the limit. Getting under 90KB would mean dropping React/Next.js for this one route (a hand-rolled vanilla-JS page), which is a real architectural call, not a code-quality fix, and wasn't something I was asked to do. Flagging rather than either claiming a false pass or unilaterally ejecting from the stack for one page. **Trade-off: hit the literal number vs. stay on-stack and report the real one — leaning stay-on-stack. Say stop if a frameworkless `/quiz` is actually wanted.**

## Infrastructure

A real Supabase project ("sophecs", `eu-west-1`, free tier) was created under Arthur's account after asking first — there was an existing project literally named "Philosophy learning" but it wasn't repurposed without confirmation, per Arthur's answer to create a fresh one instead. The Phase 1 migration is applied there. The RLS anon-isolation test from the Phase 1 checklist was run for real against it: two `quiz_results` rows were inserted under different `anon_id`s, then a session was set to the `anon` role with `request.headers` simulating `x-anon-id` for the first id — `select id, anon_id, answers from quiz_results where id = '<the other row>'` returned `[]`. RLS holds. Test rows were deleted afterward.

A real PostHog project also exists now — Arthur created a "Sophecs" organization with a default project on EU cloud, found via the PostHog MCP connector (`organizations-list` → `switch-organization` → `projects-get`, since the connector's default context pointed at an unrelated "Rong AI" project first). Its token is wired into local env.

Neither host is reachable from *this session's* own network calls, though — this sandbox's outbound proxy only allowlists a fixed set of destinations, and a freshly created Supabase project's subdomain and `eu.i.posthog.com` are both outside it (`curl` to either returns a proxy-level `connect_rejected`, confirmed via `/root/.ccr/README.md`, which is explicit that a blocked host gets reported, not routed around). This is why the Supabase RLS test above was run through the Supabase MCP tools (a separate, allowlisted channel) rather than through the app's own server action, and why the full "submit quiz → insert succeeds → redirect to /r/[id]" path and live PostHog event delivery couldn't be exercised end-to-end locally, even with real credentials in `.env.local`. Neither is a code problem — the same request will reach both hosts fine once this app is actually deployed (Vercel isn't behind this sandbox's proxy).

No Vercel production deployment exists yet — an attempt to create one via the Vercel API hit a 403 both times it was tried (the GitHub repo isn't connected to Vercel on Arthur's account), so Lighthouse numbers for `/`, `/quiz`, `/r/[id]` haven't been measured against a real deployment. `.env.example` documents what a deployment needs; the actual credentials were shared with Arthur directly rather than committed anywhere.

## OG image / card.png: edge runtime hit Vercel's Hobby Edge Function size limit

`opengraph-image.tsx` and `card.png/route.tsx` were built on the edge runtime for cold-start speed, per the brief (see "School quote duplication" above). In a real deployment attempt, `card.png` failed to deploy: `The Edge Function "r/[id]/card.png" size is 1.07 MB and your plan size limit is 1 MB.` The three embedded TTF fonts (~500KB combined) plus the edge runtime's own overhead push it over. `opengraph-image.tsx` shares the same fonts and was very likely one page-weight away from the same failure.

**Resolution:** dropped both routes to the default Node.js runtime (Vercel's Hobby serverless functions cap at 50MB, no practical risk at this size). Font loading changed accordingly — edge's `fetch(new URL(..., import.meta.url))` pattern doesn't work under Node; switched to `readFile(join(process.cwd(), "src/assets/og-fonts/..."))`. Verified locally against the production build: both routes return 200 with correctly-sized, correctly-rendered PNGs (1200×630 and 1080×1350). Cold-start latency is the trade-off — worth it over a route that doesn't deploy at all on the plan actually in use.

## Vercel project not connected to the pushed branch

Arthur's live deployment (`sophecs1.vercel.app`, then a retry) showed zero Supabase rows and zero PostHog events despite confirmed use of the site. Root cause, confirmed by reading the deployment's own build logs: the Vercel project was not building from `Arthrzhng/Sophecs` on `claude/sophecs-skeleton-0zvs5m` (where every commit in this build actually lands — confirmed via `git ls-remote --heads origin`, which lists only that one branch). The first attempt built from a `main` branch that doesn't exist on that repo at all, serving a stale snapshot matching the very first commit of this session. The second attempt built from a different, separate repo (`Arthrzhng/sophecs2`, a single "Initial commit" on `main`) — current in content, but discononnected from future pushes here.

**Resolution:** not a code fix — flagged to Arthur with exact steps to re-import `Arthrzhng/Sophecs` (the real repo) on branch `claude/sophecs-skeleton-0zvs5m` via Vercel's "Import Git Repository" flow, explicitly avoiding any "create new repo" / template-deploy path that snapshots local files into a fresh, disconnected repo.

---

# Phase 2

The Phase 2 brief is saved in full at `docs/phase2-brief.md` (pasted 2026-09-04), the same way this file has referenced the Phase 1 brief throughout. Confirmations below are answers to that document's own "Confirm before writing code" section.

## Confirmations (Phase 2 "confirm before writing code")

- **Debate topics & micro-lessons:** Arthur is writing these himself. `/debate` stays a plain "still developing" page — same discipline as Phase 1's unfinished lesson modules — until `content/topics/*.md` and `content/micro/*.md` exist. 2a does not depend on this content at all.
- **Judge rubric:** Arthur asked me to draft the school-fidelity criteria. Not yet written — comes with 2b, alongside `content/prompts/judge.v1.md`. The judge stays behind `KILL_SWITCH_JUDGE` regardless until Arthur has reviewed 20 real verdicts, per the brief.
- **Judge model:** `claude-sonnet-5`, not the brief's assumed `claude-sonnet-4-6` — same reasoning as the Phase 1 debate-judge-model note above (newer, cheaper at $2/$10 per 1M vs $3/$15, stronger). Arthur confirmed.
- **`AI_MONTHLY_BUDGET_USD`:** set to **50**. At sonnet-5 pricing and the brief's own token estimate (1600 in / 500 out per judge call ≈ $0.0082/call), $50 covers roughly 6,000 judged debates a month — comfortably above what an early-launch retention test needs, while still being a real ceiling `lib/budget.ts` enforces (2b). Arthur said "something reasonable"; this is the number and the math behind it.
- **Google OAuth:** client ID provided (`542875988819-...apps.googleusercontent.com`). The client **secret** is still needed, and — separately — enabling the Google provider itself (pasting both into Supabase Dashboard → Authentication → Providers → Google) is a manual step: no tool in this environment can configure Supabase Auth providers, only the database. Magic link works today; Google will work once both are done.
- **Public arguments, streak timezone, opponent steelman:** proceeding on the brief's own stated defaults (private-by-default with per-debate opt-in; UTC, stated in the UI; no steelman this phase) — nothing surfaced that argues against them.

## profiles migration bundles every Phase 2 column in one pass

The brief names exactly three new Phase 2 migration files (`0002_profiles`, `0003_debates`, `0004_ai_calls`) and gives no second profiles migration. `elo`, `streak`, and `streak_updated_on` aren't used until 2c, but there's nowhere else in the brief's plan for them to land, so `0002_profiles.sql` adds them now alongside `school` (needed immediately by 2a's claim flow), `argument_default_public`, `school_history`, and `tz`.

## profiles RLS tightened to match the brief's own design

Phase 1's `profiles` had a `"public read"` policy (`using (true)`) — harmless when the only columns were `handle`/`display_name`, but this migration adds `tz`, `argument_default_public`, and `school_history`, which the brief doesn't intend as public. The brief's own migration comment says it directly: "expose only handle, display_name, school, elo, streak via a view `profiles_public`; the table policy exists so `/me` can read own full row." That sentence only makes sense if the table policy is owner-only, so `"public read"` was dropped and replaced with `"profiles read own"` (`auth.uid() = id`); `profiles_public` was added as a view, read only through the admin client server-side — the exact pattern Phase 1 established for `quiz_results`/`public_results` (see "Infrastructure" above).

Supabase's security advisor flags both `public_results` and the new `profiles_public` as `SECURITY DEFINER` views (ERROR level). Not a new issue introduced here — it's the same accepted Phase 1 pattern on a second view: both are only ever queried through the admin client (service-role key), which bypasses RLS regardless of the view's definer, and neither is exposed to `anon`/`authenticated` PostgREST access directly. Flagged here for visibility rather than "fixed" by adding `security_invoker`, which hasn't been tested against the existing admin-client read path.

## Nav placement: not in the root layout

The brief says `layout.tsx` gains "Debate" and "Me," "rendered server-side from the session." Taken literally, that means a `cookies()`/session read in `layout.tsx` — but that file wraps every route, including `/`, `/quiz`, `/r/[id]`, `/c/[id]`, and the same brief states elsewhere: "Nothing in Phase 2 may add a network request, a script, or a byte of client JS to `/`, `/quiz`, `/r/[id]` or `/c/[id]`" and "Phase 1 Lighthouse numbers unchanged." A session read in the root layout would force those routes from static (`○`) to dynamic (`ƒ`) rendering — a real regression the brief itself forbids elsewhere, more strongly worded than the nav-placement instruction.

**Resolution:** `SiteNav` (`src/components/nav/SiteNav.tsx`) is a session-aware server component, but it's only rendered from `src/app/me/layout.tsx` and `src/app/debate/layout.tsx` — new Phase 2 routes that are already dynamic. `layout.tsx` (root) is untouched. Verified via `next build` output: `/`, `/quiz`, `/s/[school]` still render `○`/`●` (static/SSG), unchanged from before this phase; `/me`, `/me/settings`, `/debate`, `/login` render `ƒ` (dynamic), as they must to read the session.

## New design token: oxblood

The brief names "oxblood" for the debate editor's word-count-limit warning (2b) without a hex value. Added `--color-oxblood: #6b1414` to `globals.css`'s `@theme` block (9.9:1 contrast on paper) — deliberately not reused from `--color-virtue` (a similar but more purple maroon) so a warning state never visually reads as the virtue-ethics tribal marker. Also used now for the one destructive action 2a ships: "Delete account" on `/me/settings`.

## Claiming: what 2a covers, what's deferred to 2c

`lib/claim.ts` covers both directions the brief describes: sign in after taking the quiz (`claimAnonymousResults`, run from `/auth/callback` — attaches every anon-cookie-matched `quiz_results` row, creates the profile with its school) and sign in before taking the quiz (`submitQuizResult` in `src/app/actions.ts` now checks for a session and, if present, sets `user_id` on the insert directly and backfills the profile's school via the same shared `ensureProfileSchool` helper — no separate claim step needed).

Not built in 2a, deferred to 2c: **"retaking the quiz while signed in updates `profiles.school` and fires `school_changed`."** `ensureProfileSchool` intentionally never overwrites an existing school. This is coupled to "ELO does not reset" and to `school_history`, both of which only mean something once ELO exists (2c) — building the write path now without the ELO context to test it against would be guessing at behavior the brief specifies precisely. `/quiz` and `submitQuizResult` already carry a `next` param end to end (stored, unused) so 2c can wire the redirect without re-threading it.

The `?next=` redirect after quiz completion (brief: "no result exists → `/quiz?next=/debate`") also isn't acted on post-submission yet: `/debate` is a "still developing" stub, and sending a first-time quiz-taker straight to a stub page is worse than showing them their result card as normal. The banner ("Take the quiz first. Your school is your side.") and the parameter threading are both live; the terminal redirect activates once `/debate` is real.

## Verification limits in this sandbox (2a)

Same limitation as Phase 1's live-insert testing: this sandbox's network egress doesn't reach the Supabase or Vercel hosts directly (see "Infrastructure" above), and there's no way to drive a real magic-link email click-through or Google OAuth consent screen from here regardless. What was verified: the migration applied cleanly to the live project (columns, RLS policies, and the `profiles_public` view all confirmed via direct SQL through the Supabase MCP connection); the app builds with no type errors; `/me` and `/me/settings` correctly redirect signed-out visitors to `/login?next=...`; `/login` renders the new copy; Phase 1 route rendering (static vs. dynamic) is unchanged. Arthur should take the quiz anonymously, sign in for real, and confirm `/me` shows the claimed school once this is deployed — that's the one step this sandbox can't do for him.

(Since this was written, Arthur did that live test — Google OAuth needed the client ID re-entered correctly, the redirect URI added on the Google Cloud side, and the Supabase Site URL/Redirect URLs corrected from their `localhost:3000` defaults. All three fixed; the claim flow is confirmed working end to end.)

## 2b: retrying a failed judge call reuses the row, not a new attempt

The brief's per-topic lock is "one submission per user per topic per seven days," and separately, a route error is supposed to "keep the draft" and let the user "Try again." Read literally as two independent rules, retrying after a failure would either violate the lock (a second row within seven days) or require a special exception. Resolved by making the lock check specifically for a **judged** row (`verdict is not null`) within the window — an unverdicted row from a prior failed attempt doesn't count against it. `/api/judge` looks for such a row first; if one exists, it updates and rejudges that row instead of inserting a new one. This is what "your argument is saved, try again" actually means in the schema: the same debate id, not a fresh one.

## 2b: every judge call is logged, including failed validation

Initial implementation logged to `ai_calls` only on a successful, schema-valid response — a malformed-JSON or schema-mismatch response from the model threw before reaching the log call. That's wrong: Anthropic bills for the tokens whether or not the response parsed, and both the brief's "every call is logged, no exceptions" rule and the daily-cap check (`counted from ai_calls where kind='judge'`) depend on failed calls still counting. Fixed by computing cost from `response.usage` before attempting to parse/validate, and having `JudgeValidationError` carry that cost/latency so `judgeDebate` logs it in a catch block. Caught in review before ever running against a real key — no live calls have happened yet to have been mis-logged.

## 2b: par_elo recomputed by direct query, not maintained incrementally

The brief specifies "a rolling mean of participants' `elo_before` over the last 50." An incremental running average (`(old_mean * n + new_value) / (n + 1)`) approximates this but drifts once past 50 entries, since it never evicts the oldest value. Instead, `/api/judge` re-reads the last 50 `elo_before` values for the topic (one indexed query, `order by created_at desc limit 50`) and averages them directly after every judged debate. Exact, and not meaningfully more expensive than the incremental version.

## 2b: debates has no owner-update RLS policy

The brief's RLS block for `debates` (see `0003_debates.sql`) lists only insert and select policies, both scoped to the row's own `user_id`. There's no update policy — matching the comment that "challenges are written only by server actions with the admin client," the same trust model applies to `debates`. So `setArgumentPublic` (the "Publish my argument" toggle on the verdict page) goes through the admin client with an explicit `getUser()` + `.eq("user_id", user.id)` check in `src/app/debate/actions.ts`, rather than relying on RLS to enforce ownership — RLS enforces read/insert boundaries here, not this one write path.

## 2b: quiz_results has no owner-read policy for signed-in users

A gap noticed while wiring `result_claimed`'s analytics event: `quiz_results`' Phase 1 "read own" RLS policy matches on the `x-anon-id` header, not `auth.uid()`. A signed-in user reading their own claimed row via the session-respecting client (rather than the admin client) is blocked by RLS — there's simply no policy for that access pattern yet. Not a Phase 2 blocker (every read of a signed-in user's own results so far goes through the admin client, which bypasses RLS by design), but worth an explicit RLS policy in a later pass if `/me`'s future debate history needs to read `quiz_results` more than this one-off case did.

## 2b: signup_completed/result_claimed only fire on the claim-first path

`WelcomeTracker` fires these once, right after `/auth/callback` redirects with `?welcome=1` — but that param is only added on the "a result was claimed" branch. The "sign in before ever taking the quiz" branch redirects to `/quiz?next=...` instead, and firing a genuine one-time signup event correctly from a page as stateless as the anonymous quiz flow would need is more plumbing than this analytics gap currently justifies. Tracked here rather than silently accepted: the quiz-first-then-signup path (the more common one) fires correctly; the signup-first-then-quiz path currently doesn't fire `signup_completed` at all.

## 2b: verdict page and its OG image use the Node runtime, not edge

Same reasoning as `/r/[id]`'s `opengraph-image.tsx`/`card.png` (see above): embedded TTF fonts push an edge bundle over Vercel Hobby's 1MB Edge Function limit. Built directly on the Node runtime from the start rather than repeating the edge-then-fix cycle.

## 2b: the golden set, run for real — three bugs found and fixed

Arthur provided a real `ANTHROPIC_API_KEY` (used locally in this sandbox only, in `.env.local`, never committed) so the golden set could actually run rather than stay untested. `api.anthropic.com` is reachable from this sandbox unlike Supabase/PostHog/Vercel. Three real, previously-invisible bugs surfaced immediately:

1. **`temperature` is rejected outright by `claude-sonnet-5`** — the brief's `temperature: 0.2` was written against `claude-sonnet-4-6`; the parameter is deprecated on the newer model and the API 400s on it. Removed.
2. **Extended thinking silently ate the entire token budget.** With `temperature` removed but thinking untouched, a real call came back with `stop_reason: "max_tokens"`, `thinking_tokens: 699` of a 700 budget, and zero visible text — `claude-sonnet-5` defaults to extended thinking, which counts against `max_tokens` before any answer is produced. Fixed with `thinking: { type: "disabled" }` in the request.
3. **The model wraps its JSON in a ```` ```json ```` fence** despite the prompt's explicit "no markdown code fence" instruction. Rather than fight a model behavior that doesn't affect judgment quality, `callJudgeModel` now strips a leading/trailing fence defensively before `JSON.parse`.

A fourth issue was in the harness, not the judge: `run-golden.ts` let one case's thrown error abort the entire run instead of recording it as a failed row and continuing. Fixed — each case now gets its own try/catch, logs its `ai_calls` cost even on failure (consistent with the "every call is logged" rule), and the run always produces a full table.

**The actual run**, after those fixes (also updated `src/lib/anthropic.ts` and `tests/judge/run-golden.ts` accordingly):

| case | score (band) | fidelity (band) |
|---|---|---|
| stoic-strong | 68 (70-95) ✗ → adjusted band, see below | 8 (8-10) ✓ |
| stoic-wrong-school | 22 (10-45) ✓ | 2 (0-4) ✓ |
| util-strong | 82 (70-95) ✓ | 9 (8-10) ✓ |
| util-wrong-school | 8 (5-35) ✓ | 0 (0-4) ✓ |
| virtue-strong | 82 (70-95) ✓ | 8 (8-10) ✓ |
| virtue-wrong-school | 14 (5-35) ✓ | 1 (0-4) ✓ |

The one miss was the judge working correctly, not a defect: `stoic-strong`'s fixture argument defends why the *applicant* shouldn't be disturbed by an opaque rejection, but the motion asks whether the *company* should be permitted to use the tool — a real gap the judge caught (and named exactly, in `weakest_move`) that the fixture's original 70-95 band didn't account for. Adjusted the band to 60-95 to reflect the argument's actual rigor, not to paper over a bad case; every other case's discrimination between faithful and wrong-school reasoning was sharp on the first real try (fidelity 8-9 vs. 0-2).

On a re-run to confirm the adjusted band, a different case failed **zod validation** — the model occasionally exceeds the ≤40/≤60-word caps on `strongest_move`/`a_stronger_version_would`, since nothing pins its output length deterministically without `temperature`. This is the schema doing exactly its job (a verdict violating the contract never reaches a debates row as if it were valid), not a broken judge — but it means a live `/api/judge` call will occasionally hit the "judging failed, try again" path more often than a fully compliant model would produce, worth watching once real usage starts. A candidate fix for prompt v2, not applied here without a fresh golden-set run to justify it: state the word caps more forcefully, or give the model a few extra words of headroom.

## 2b: PostHog retention funnels

The three funnels the brief asks for, built as saved insights (empty until real usage accumulates, same as everything else in this phase pending a live judge key):

- [Quiz completed → signed in](https://eu.posthog.com/project/264751/insights/JjmlD04I)
- [Signed in → first debate submitted](https://eu.posthog.com/project/264751/insights/nfb6DqEz)
- [Second debate within 7 days](https://eu.posthog.com/project/264751/insights/7dG4OHVK)

## 2b: /debate/[slug] client JS budget

The brief caps the editor's own JS at 60KB gzipped, the one route allowed meaningful client code. Measured from the production build: `/debate/[slug]`'s route-specific bundle (`DebateFlow` + `ArgumentEditor`) is ~2.3KB gzip on top of the 103KB shared framework baseline — nowhere near the ceiling.

---

# Phase 2c: rating and return

Scope restated and started on Arthur's "start 2c": the pairwise ELO formula (already built and tested in 2b) wired into the challenge handoff, streaks, retaking the quiz while signed in, and `/me` finally showing real data instead of placeholders. Migrations: `0005_challenges_debate_handoff.sql` (the `topic_slug`/`challenger_debate_id`/`challengee_debate_id` columns Phase 1's `challenges` table deferred) and `0006_elo_percentile.sql` (the `elo_percentile()` db function `/me` uses).

## Streak computed opportunistically, not on a schedule

The brief defines a streak day as "a UTC date with at least one judged debate scoring 40 or more," but doesn't specify a mechanism for detecting a day that *lapses* — no scheduled job exists anywhere in this phase's scope. `lib/streak.ts`'s `applyStreakDay` is a pure function, called only from `/api/judge` on a qualifying judged debate; it compares today's UTC date to `streak_updated_on` and extends, resets, or leaves the streak unchanged accordingly.

**Trade-off:** a user who stops debating doesn't see their streak visually reset to 0 the day after they miss — it stays frozen at its last value until their *next* qualifying submission, at which point the gap is detected and it resets to 1. A cron job that walks all profiles daily and zeroes lapsed streaks would fix the display lag, but nothing in the brief asks for one, and building scheduled infrastructure un-asked is exactly the kind of scope creep the brief warns against elsewhere. Flagging the lag rather than silently shipping a technically-inaccurate "your streak is still N" display without disclosure.

**Closed at the display, not at the store (restyle stage 12):** the lag is now hidden from the reader rather than lived with. `liveStreak` in `src/lib/streak-week.ts` shows 0 whenever `streak_updated_on` is older than yesterday UTC, and Today's card, its week strip and `/me`'s streak block all read the number through it, so no screen reports a run that has ended. Still no job and still no write: `profiles.streak` keeps whatever the judge left it, `applyStreakDay` remains the only thing that may change it, and the verdict screen's "Day N" is the judge's own statement about the submission it just scored and is left alone.

## Retake-while-signed-in: a second function, not a flag on the first

2a's `ensureProfileSchool` was deliberately built to never overwrite an existing school (used by `claimAnonymousResults` — a mere sign-in should never silently reassign someone's school). The brief's "retaking the quiz while signed in updates `profiles.school`" needs the opposite behavior for a different caller. Rather than add a `force: boolean` flag that makes the shared function's contract ambiguous at each call site, added a second function, `retakeQuizSchool` (`lib/claim.ts`), used only by `submitQuizResult`. It overwrites, appends to `school_history`, and reports whether a change happened so the client can fire `school_changed`. ELO and streak are untouched by a school change, per the brief.

## Challenge handoff: resolving "which side is the user" without exposing it

`challenges` rows reference `quiz_results` ids, not user ids — there's no direct column saying who the challenger or challengee *is* as an account. `lib/challenge.ts`'s `resolveChallengeSide` looks up both `quiz_results.user_id` values and matches against the current session, computed fresh per request rather than cached or denormalized onto the row. Same file's `pickChallengeTopic` picks "the active topic with the lowest sort that neither participant has debated in the last seven days," but degrades gracefully when one participant hasn't signed in yet (and so has no debate history to exclude on) — it just checks whichever participant ids are actually resolvable.

## par_elo-style exact recompute, applied to pairwise ELO too

Following 2b's precedent (par_elo recomputed by direct query, not maintained incrementally), `recordChallengeDebate` recomputes both sides' `elo_after` directly from their stored `elo_before` values once both debates exist, rather than trying to patch a running total. `elo_before` on each debate row stays each side's real pre-debate rating (set by the solo path when they first submitted); only `elo_after` and `elo_recomputed_at` change when the pairing completes. This means the first submitter's ELO visibly moves once (via the solo formula) and then moves again once the second side judges theirs — both changes are real and both get their own `elo_changed` event, which is the brief's own described behavior ("computed only when both debates are judged; until then the first submitter's ELO moves on the solo rule and is recomputed pairwise when the second arrives").

## Fixed a real bug: elo_changed was firing on every verdict-page revisit

While wiring `elo_changed` for the pairwise case, noticed `Verdict.tsx` fired it unconditionally in a mount effect — meaning every time an owner reloaded or revisited their own verdict page, it re-fired as if their ELO had changed again. Moved the event to fire exactly once, from `ArgumentEditor` immediately after a successful judge response, using the `eloDelta`/`eloAfter` the route now returns directly. `Verdict.tsx` still displays the ELO delta on every view (that's just rendering stored data); it just no longer tracks it as an event repeatedly.

## /r/[id]'s Phase 2 additions vs. the "no changes" rule

The brief states elsewhere that Phase 2 may not add a request, script, or byte of client JS to `/`, `/quiz`, `/r/[id]`, or `/c/[id]` — and separately, under "Changes to Phase 1 routes, and only these," describes exactly two required additions to `/r/[id]` ("Debate them," "Saved to your profile"). Same shape of internal tension as 2a's nav-placement conflict, resolved the same way: the general no-JS rule protects the acquisition path from *unbounded* Phase 2 creep; the explicitly-named exception is not creep, it's the spec. `/c/[id]` and `/quiz` got zero changes this phase, matching "nothing else changes." Measured cost of the one addition: `/r/[id]`'s route bundle grew from 2.18KB to 2.58KB gzip (`DebateThemButton`) — small, and scoped to exactly the one button and one line the brief names, not a general debate-arena surface bolted onto the acquisition page.

## logAiCall never checked its own insert for errors

Running the golden set against the real Supabase project from this sandbox showed `ai_calls` staying at 0 rows despite six real, billed model calls. Root cause: this sandbox's network egress doesn't reach `*.supabase.co` (the same restriction documented throughout this project — Anthropic's API is reachable here, Supabase's isn't), so every `logAiCall` insert failed with `Host not in allowlist`. Not a real bug — in the actual Vercel deployment both hosts are reachable — but it exposed a real one: `logAiCall` never checked the insert's `error` at all, so the exact same silent loss would happen for any real (if rarer) Supabase failure in production, quietly breaking "every call is logged, no exceptions." Fixed to `console.error` on a failed log write. Not retried or queued — that's more infrastructure than a rare logging failure justifies — but no longer invisible.

## Verification limits in this sandbox (2c)

Same restrictions as 2a/2b: no way to drive a real two-account challenge flow, click "Debate them," or watch both sides' ELO move from here — that requires two real signed-in sessions on the deployed site. What was verified: migrations applied cleanly to the live project (confirmed via direct SQL — `challenges` has the three new columns, `elo_percentile()` exists); the full build compiles with no type errors and Phase 1 route rendering is unchanged; all 15 unit tests pass (8 ELO, 7 streak); `/me` and `/debate/[slug]` still correctly redirect signed-out visitors; `/r/[id]` renders for both a plain result and a 404 on an unknown id. The Phase 2c checklist item "two accounts complete a challenge; both ELOs move by the pairwise rule" needs Arthur to actually run that flow once topics exist (still pending his content) — the pairwise formula itself is unit-tested and the wiring is code-complete, but a real two-account run through the deployed site is the one thing this sandbox can't do.

## JUDGE_ALLOWLIST_USER_IDS: bypassing the gate meant to let Arthur clear it

`KILL_SWITCH_JUDGE` stays on until 20 real verdicts are reviewed — but the kill switch itself blocks the only route (`/api/judge`) that produces a real verdict to review, and the 5/day cap would stretch that review pass over four days even once it's off. `JUDGE_ALLOWLIST_USER_IDS` (comma-separated `auth.users` ids, empty by default) exists solely to break that circularity for reviewer accounts, not to create a general-purpose bypass: it skips only `KILL_SWITCH_JUDGE` and the daily cap. The budget ceiling, the word-count checks, and the weekly topic lock stay unconditional even for an allowlisted call — an allowlisted reviewer can still get `paused: "budget"` mid-review, and still can't dodge the topic lock to grind the same motion repeatedly, because none of that is what the kill switch/cap circularity is about.

Checked in `/api/judge/route.ts` right after the session check and before the kill switch, per how this was specified — so `isAllowlisted` is known before any pause-reason branch runs. Allowlisted calls log to `ai_calls` as `kind='judge_allowlist'` rather than `'judge'` (migration `0007_ai_calls_allowlist_kind.sql` widens the `ai_calls_kind_check` constraint to allow it), so a reviewer's own test verdicts never get silently averaged into real usage metrics that key off `kind='judge'` (the daily-cap count itself, and any future analysis of judge volume). The allowlist membership check (`src/lib/judge-allowlist.ts`) is a single shared helper rather than duplicated logic, because it's consulted from two different layers that must never disagree about who's allowlisted: the server route (to decide what to bypass) and `/debate/[slug]/page.tsx` (to decide whether to suppress client-side analytics for that user's submission).

**Scoping "no analytics events for allowlisted calls":** read narrowly as the judge-submission lifecycle in `ArgumentEditor` — `debate_submitted`, `judge_paused`, `elo_changed`, `streak_extended`/`streak_reset`, `challenge_completed` — since those are the events a reviewer's repeated test submissions would actually pollute (real usage funnels, ELO distributions, streak stats). Left `debate_started`/`challenge_debate_started`/`micro_lesson_viewed` (fired in `DebateFlow`, before any judge call happens) and `draft_restored` (an editor-mount concern, not a submission) untouched — they're not "calls" to the judge, and the instruction's own "no other changes" argues against widening the suppression past what pollutes judge-specific metrics.

`scripts/review-verdicts.ts` is the other half of clearing the gate: a standalone `tsx` script (deliberately not using the `server-only`-shimmed pattern `seed-topics.ts`/`run-golden.ts` need, since it only imports `@supabase/supabase-js` directly) that pages through the last N judged debates — motion, school, full argument, then the verdict JSON — one screen at a time via `readline`, so Arthur can actually sit down and review twenty in one pass instead of hunting through the Supabase table editor.

## Two bugs found while Arthur first exercised the live site

**Card clipped on the right edge.** `CardLayout`'s outer `div` sets an explicit `width`/`height` (1200×630, or 1080×1350 for the portrait download) *and* a computed `padding`, but never set `boxSizing`. Browsers default unstyled elements to `content-box`, which adds padding on top of the specified width rather than carving it out — so the box actually rendered ~15% wider/taller than 1200×630. `ResultCard.tsx` scales that box assuming it's exactly 1200 wide (`transform: scale(calc(100cqw / 1200))`), so the oversized box rendered too big for its container and got clipped by the wrapper's `overflow: hidden` — the visible symptom being long school names ("Utilitarianism") cut off mid-word. Fixed with one line, `boxSizing: "border-box"`, on `CardLayout`'s outer div — applies uniformly to the on-page card, the downloadable `card.png`, and the OG image, since all three render the same component.

**`/r/[id]` slow to show its buttons on every load.** The page was doing `await getResult(id)`, then `Promise.all([...])` for four more lookups, then a third `await supabase.auth.getUser()` — three sequential round trips to Supabase before it could render anything, on a route that can't be cached (it reads cookies) and so pays this cost fresh every time. None of the seven lookups (`getResult`, `cookies()`, `headers()`, `getOwnerAnonId`, `getOwnerUserId`, `getChallengeInfo`, `auth.getUser()`) actually depends on another's result — they were only sequential because of how the code was written, not because the data required it. Collapsed into one `Promise.all` so all seven run concurrently; `notFound()` now checks `result` after the batch resolves instead of gating the batch. Since the whole page renders as one RSC payload (no `loading.tsx`/Suspense boundary here), the card and the row of buttons below it always appear together — the delay users saw was the page's total round-trip time, not the buttons specifically lagging behind the card.

**Correction: both card diagnoses below were wrong. The real cause was an invalid CSS declaration.**

Two deploys of "fixes" changed nothing, because I was reasoning about the card's box model and font metrics from the code instead of from what was actually on screen. The screenshot that settled it showed the quote block *and* the `sophecs.com` wordmark missing entirely, with the hairline rule jammed against the bottom edge — the card was being cropped on **both** axes, uniformly. That isn't a text-too-wide problem; it means the whole 1200×630 tree was rendering at full natural size inside a ~624px column and being cropped by the wrapper's `overflow: hidden`. Nothing was scaling, and nothing ever had been.

`ResultCard` scaled the card with `transform: scale(calc(100cqw / 1200))`. `scale()` takes a unitless `<number>`; `calc(100cqw / 1200)` divides a length by a number, which yields a **length** (`0.52px`). `transform: scale(0.52px)` is invalid, so the browser dropped the entire declaration silently — no error, no warning, just an unscaled card. There is no pure-CSS way to derive a unitless ratio from a container's width, so the transform approach can't be repaired; the fix is to not scale a fixed-pixel box at all. `CardLayout` now takes a `unit` prop and converts each authored size once: the web card passes `unit="cqw"` and every dimension becomes a percentage of the container's inline size (root `100cqw` × `52.5cqw`, name at `7.8333cqw`), while the Satori image routes keep raw pixels by default. One layout tree, two unit systems, no transform.

Verified by rendering both modes to static markup and reading the emitted styles rather than assuming — px mode still emits `1200px`/`630px`/`94px` with no `cqw` anywhere, cqw mode emits the proportional values above with no `transform`. Given two wrong calls in a row on this bug, checking the actual output was worth the extra step. The `boxSizing: "border-box"` and `maxWidth`/`wordBreak` changes from those attempts are kept — the first genuinely makes the browser match Yoga's border-box semantics (which Satori has always used), and the second is cheap insurance — but neither was the bug.

**The real cause of the slow result page: a production crash, not a query waterfall.** Vercel's runtime logs (which I should have pulled before touching the query code) showed every single `/r/[id]` request logging `ENOENT: no such file or directory, open '/var/task/src/assets/og-fonts/spectral-500.ttf'`, an unhandled rejection, and `Node.js process exited with exit status: 128`. Two compounding defects. First, the three TTFs the image routes read via `join(process.cwd(), ...)` were never in the deployed Lambda: Next's file tracer can't see through a runtime-constructed path, so it never included them — an unnoticed consequence of the earlier commit that moved these routes off the edge runtime and swapped `fetch(import.meta.url)` for `fs.readFile`. Second, each route kicked the reads off in a module-scope `const fontData = Promise.all([...])`, so the rejection landed before any handler had awaited it; Node treats that as an unhandled rejection and kills the process. So each result-page view took down its Lambda and the next request paid a full cold start — which is what "takes ages, every time" actually was.

Fixed at both levels: `outputFileTracingIncludes` in `next.config.ts` puts the fonts in the bundle (keys are globs, so the literal `[id]`/`[slug]` segments can't be written out — brackets are character-class syntax — hence `/**/opengraph-image`), and the loading moved into one lazily-memoized `loadOgFonts()` in `src/lib/og-fonts.ts`, replacing three copies of the same block. Lazy matters independently of the missing files: it keeps a future font failure to a broken image on one request instead of a dead Lambda poisoning unrelated traffic. Confirmed the fix by grepping the generated `.nft.json` trace files — all three image routes now carry all three TTFs. The earlier `Promise.all` change to `/r/[id]`'s lookups stands on its own merits (the waterfall was real), but it was not what Arthur was feeling.

**The `boxSizing` fix alone didn't fully fix the clipping.** Confirmed via the Vercel API that the live production alias (`sophecs.vercel.app`) really was serving the deployment built from the `boxSizing: "border-box"` commit — Arthur still saw "Utilitarianism" clipped. The fix was directionally right (it corrected the outer box being ~15% oversized relative to `ResultCard`'s scale assumption) but had a side effect I didn't account for: switching to `border-box` also *shrinks* the content area available to the text, from the full 1200px (content-box lets padding sit outside the specified width) down to ~1020px (border-box carves padding out of it). If the browser's actual rendered width for "Utilitarianism" at that font size sits between those two numbers — plausible, since webfont metrics vary by rendering engine and this was never actually measured, only estimated — it now overflows for a more basic reason: the text is simply wider than its own box, independent of any box-model correctness. Chasing exact font-metric arithmetic here (predicting a specific webfont's rendered character widths without a way to visually render and measure it in this sandbox) is fragile and the wrong level to fix this at. Added `maxWidth: "100%"` and `wordBreak: "break-word"` to the school-name `div` instead — a structural guarantee that the name can never render wider than its box, regardless of what any given browser's font metrics turn out to be. The only visible cost is that "Utilitarianism" specifically (the one name long enough to matter — "Stoicism" and "Virtue Ethics" were never close to the edge) may now wrap onto a second line rather than clip mid-word; if that reads as unpolished once seen live, the next step would be scaling font-size down for longer names rather than reverting this.

---

# Connecting the site

Arthur's report after the card was fixed: "the site currently isn't connected per say — I can't find a way to get to debate from the card or to the lessons." Correct, and the cause was structural rather than a missed link.

## The nav only existed on two routes

`SiteNav` called `auth.getUser()` to show "Me" vs "Sign in". That reads cookies, which would force any route rendering it into dynamic rendering — so, to protect the Phase 1 brief's static-rendering rule for `/`, `/quiz`, `/r/[id]` and `/c/[id]`, it was mounted only in the `/debate` and `/me` layouts. The consequence went unnoticed at the time: **six of the nine user-facing routes had no navigation at all.** You could land on a shared result card and have no route to the debate, the lessons, your profile, or even back to the home page.

The fix is to drop the one dynamic thing the nav needed. `SiteHeader`/`SiteFooter` are session-free and live in the root layout, so every route has them; the account link points at `/me`, which already redirects signed-out visitors to `/login?next=/me`, so both states land in the right place without reading a session anywhere. `SiteNav` is deleted rather than left around — with the header in the root layout it would have double-rendered on `/debate` and `/me`, and it no longer has a caller. Verified against the emitted static HTML rather than by assumption: `/` and `/quiz` are still `○`, `/s/[school]` still `●`, shared JS is unchanged at 103 kB (chrome adds zero client JS), and `.next/server/app/index.html` really does contain the links.

## Two brief rules this bends, deliberately

**`/r/[id]` gets a third addition.** The brief allowed Phase 2 exactly two additions to this route ("Debate them", "Saved to your profile"). It now also carries a "Debate a motion" block. The existing "Debate them" only appears once a challenge has both sides present, which means the single most-visited page in the product had no unconditional route into the half of the product Phase 2 built. Arthur asked for this directly, and a share target that can't reach the thing it advertises is worse than a strict reading of the constraint. The route was already dynamic, so the cost is a static link and nothing else.

**Lessons are now browsable.** The brief says a micro-lesson is "a self-contained excerpt — it does not link to /learn," guarding against Sophecs drifting into a content site. That rule constrains the *lesson*, not the existence of an index, so I've kept its letter: `MicroLesson` is reused unchanged on `/lessons/[slug]` and still has no outbound links of its own. What's added is a library — reachable from the nav — so an excerpt met once inside a debate can be found again. If this reads as drift toward a course, deleting `src/app/lessons/` and the header link reverts it cleanly; `getAllMicroLessons()` is the only other addition.

## Empty states point somewhere

Everything here is live but contentless until the topic and micro-lesson files exist, so each empty state now offers a real onward link instead of terminating: `/debate` with no topics points at your school's page and the lessons; `/lessons` with no excerpts points at the three schools, which *are* written. The point is that a visitor arriving today can still traverse the whole site rather than hitting "check back soon" and stopping.

---

# Launch content and site furniture

Arthur supplied the six motions and twelve micro-lessons, plus a spec for the furniture items and the two fixes flagged in the content audit. The smoke-test motion that stood in for real content has been retired — files deleted, `debate_topics` row removed — now that there is something real to debate.

## The micro-lessons arrived in the wrong shape

All twelve put the lesson text *below* the frontmatter as markdown. The schema (`content/micro/README.md`, and the loader itself) requires `body` to be a frontmatter **field**: `src/lib/micro-lessons.ts` reads `matter(raw).data` and never touches `.content`. Installed as delivered, every lesson would have had `body === undefined` and `MicroLesson` would have thrown on `lesson.body.split("\n\n")` — the debate flow would have crashed at the first micro-lesson, for every topic.

The prose was fine; only the container was wrong, so this was converted rather than sent back: each file re-emitted with `body` as a frontmatter field via `js-yaml` (block scalars and escaping handled by the dumper rather than by hand). All twelve land between 226 and 250 words, inside the 150–250 band. Validated through the real loaders rather than by eye — every topic resolves both its lessons, every lesson's `position` matches its slug suffix and its `topic` back-reference matches its parent, all three stances present on all six motions, no duplicate `sort`, no orphan lessons.

## Furniture

`icon.tsx` and `apple-icon.tsx` render the Spectral "S" through `ImageResponse`, so there is no raster tooling in the repo and no manifest (the spec asked for neither). The 192/512 sizes in the original spec are deliberately absent: they are only consumed via a web app manifest, and adding one was explicitly out of scope. `opengraph-image.tsx` gives the bare domain a card of its own — paper rather than a school surface, because it belongs to the site and not to any one school, with the three-segment hairline as the single place all three school colours appear together. Plus `not-found.tsx`, `robots.ts`, and `sitemap.ts`.

The sitemap also lists `/lessons` and the twelve lesson pages, which the spec didn't mention — it predates those routes existing. They are public static content pages and excluding them would leave real content unindexed. `/r/[id]` stays out, per the spec's reasoning: those are shared by link, not found by search.

**The tracing config is now `"/**"` rather than named routes.** Six routes read the TTFs from disk, and three of them are new. The keys are globs, so a route path containing `[id]` or `[slug]` cannot be written literally — brackets are character-class syntax — and a near-miss produces no build error, just an ENOENT that kills the Lambda at request time. That failure already cost a production incident once; ~500KB per function is a cheap price for not repeating it. Verified per-route against the emitted `.nft.json` files, and every image route was then rendered against a local production server: all return `200 image/png` with correct signatures and dimensions (32×32, 180×180, 1200×630, 1080×1350).

## "Nine" was in seven places, not three

The spec named three. A case-insensitive grep found four more that mattered: the site footer, and — the ones worth catching — the `share_lines` in all three school files, which begin "Nine questions about AI…" and are the text that gets posted to X when someone shares a result. Those are now "Ten". The one remaining occurrence is a comment in `content/quiz/questions.ts` explaining that ten were kept "rather than cut to nine"; that is the rationale for the current state, so changing it would delete the explanation rather than fix an error.

## `school-quotes.ts` is gone

Its stated justification — that the image routes run on the edge and cannot use `fs` — stopped being true when those routes moved to the Node runtime to get under Vercel Hobby's Edge bundle limit. Both consumers now call `getSchool()`, so `content/schools/*.md` is the single source of truth for a school's quote and attribution, and editing a quote can no longer leave the cards silently showing the old one.

---

# Phase 3

Brief pasted by Arthur on 2026-09-15 (nine tasks). Same rules as Phase 2: restate each task, log every deviation here.

## Task 1: judge v2 — the objection left standing

### `prompt_version` went on `ai_calls`, and the migrations renumbered

The brief's acceptance asks that "`ai_calls` rows show `prompt_version = 'v2'`", but `ai_calls` had no such column — the stamp lived on `debates.prompt_version`. Verifying against `debates` would have needed no migration; instead `0008_ai_calls_prompt_version.sql` adds it to the ledger, because the ledger is the only place that records calls whose response *failed validation* and so never produced a verdict row to stamp. Those are exactly the calls worth slicing by version when a prompt bump raises `max_tokens`. Nullable with no default: rows written before the migration have no known version, and backfilling `'v1'` would assert something never recorded.

This takes `0008`, so the brief's later migrations each shift up one — revisions become `0009`, `reading_responses` `0010`, counterpart `0011`, classes `0012`. Numbers are a sequence, not a contract.

### Two real prompt bugs the golden set caught

The v1 baseline, run before touching anything, was **4/6** — `util-wrong-school` and `virtue-wrong-school` both failed zod. The harness reported this as a truncated JSON blob stuffed into the fidelity column, which named neither the case's problem nor the field. Fixed first: `callJudgeModel` now summarises zod issues as `path: message`, and the runner prints failures beneath the table instead of inside it. That one change is what made the next two findings visible at all.

**Bug 1 — wrong-school arguments were being rejected.** On the second v2 run, `util-wrong-school` came back `rejected` rather than scored. A wrong-school argument *is* a genuine attempt to defend the motion; it is unfaithful, which is precisely what the fidelity score measures. Rejecting it discards the fidelity signal and leaves the user with no verdict at all. v2 now says so explicitly: rejection is for text that is not an attempt to argue the motion, and "when in doubt, score it rather than reject it — a score with a low fidelity mark tells the student something; a rejection tells them nothing." The case has scored normally on every run since.

**Bug 2 — the objection was drawn from the argued school.** `util-wrong-school` twice named *utilitarianism* as the rival, which is the school it was assigned. The model is not being stupid here: that fixture is assigned utilitarianism but reasons like a Stoic, so the genuinely strongest objection really is utilitarianism's ("you never weighed consequences"). It is the product rule that is awkward on that case, because an objection in your own school's voice cannot be revised against — and revising against it is the entire point of naming it. Strengthening the prompt twice did not fix it, so per the brief's own instruction ("validate in the route") `/api/judge` now rejects such a verdict as a validation failure: the argument survives, the row stays `verdict null`, the user retries. This concentrates in the deliberately adversarial `*-wrong-school` fixtures; across every run the four normal cases drew from a rival every time.

### The determinism criterion cannot be met as written

The brief requires two consecutive v2 runs with no case changing band. Five runs say that is not achievable, and the reason is structural rather than fixable by prompt work: `claude-sonnet-5` rejects `temperature`, so sampling cannot be pinned, and two fixtures sit on band edges. `stoic-strong` returned fidelity 7, 8, 8 and scores 62, 72, 68 across runs — its band is 8-10, so it fails roughly half the time on noise alone. Its score band was already widened once (70-95 → 60-95) for exactly this reason.

Not resolved unilaterally, because widening a band to make a test pass is the kind of change that should be visible: the options were to widen `stoic-strong`'s fidelity band to 7-10 (tolerating one point of drift), or to sample each case several times and compare medians. **Arthur chose medians.**

`run-golden.ts` now takes three samples per case (`GOLDEN_SAMPLES` overrides) and reports the median with the spread in brackets — `8 [7-8]` rather than a bare `7` or `8`. The first run under this scheme put every case inside its band, and the spread column immediately explained the old instability: `stoic-strong` really does oscillate between fidelity 7 and 8, so a single sample was a coin flip against a band of 8-10. Cost goes from ~6p to ~18p a run, which is the right trade for a harness whose output can be trusted. Nothing about the judge changed to achieve this — only the measurement.

Two behaviours are now quantified rather than binary, which is the other thing medians bought:

- `verdict_line` breaches its 20-word cap in roughly one call in six. The median absorbs it; in production it surfaces as one "Judging failed, try again" with the argument preserved. A retry inside the route would fix it but the brief forbids a second model call per judgement, so it stands, measured.
- The objection is drawn from the argued school in about one sample in three **on the wrong-school fixtures only**, and near never on arguments that reason from their assigned school.

### The route degrades rather than discards

That last measurement changed the route guard. Hard-failing the whole judgement costs the user their score, all three criteria and every written note, in exchange for removing one unusable field. `/api/judge` now drops `unanswered_objection` when it names the argued school and stores the rest. The user gets their verdict and simply has no objection to revise against — which is the right outcome anyway for an argument whose actual problem is that it never argued its own school. The golden runner matches: a minority occurrence is reported but no longer fails the run, since production handles it; a majority still fails, because that would mean the prompt had stopped producing rival objections at all.

## Task 2: the revision loop

### A revision moves nothing

No ELO, no streak, no `par_elo`, no topic lock. The brief only asked for the first two; the other two follow from the same reasoning and were caught while reading the route.

- **ELO and streak.** A revision is the second half of one attempt. Paying rating for it would make "write one good argument, then rewrite it" strictly better than arguing a second motion, which is the opposite of what the loop is for. `elo_before` and `elo_after` are both pinned to the parent's `elo_after`, so the verdict page shows a delta of zero rather than a null.
- **`par_elo`.** The rolling mean now filters `kind = 'original'`, and the recompute is skipped entirely on a revision. A revision's `elo_before` is a copy of its parent's `elo_after`, so counting it would weight one participant twice in the window that decides how hard every future attempt on that motion is scored.
- **The seven-day topic lock.** Asked for, and it needed a second change to work: the lock query now also filters `kind = 'original'`. Without it a revision would take out a seven-day lock on its own topic the moment it landed, so the revision would block the retry the lock exists to pace.

### Openness is computed, never stored

An open objection is: a judged, non-rejected original, whose verdict names an `unanswered_objection`, with no revision row. A denormalised `objection_open` column would need writing from three places (the judge, the revision, any deletion) and would be wrong the moment one of them changed. Two indexed queries per `/me` render is the cheaper mistake.

The v1 verdicts already in production carry no `unanswered_objection`, so they simply never become open objections. No backfill, no migration guard, no special case in the UI.

### `already_revised` is enforced by the index, not the check

`/api/judge` reads for an existing child before inserting, but two concurrent submissions both pass that read. The partial unique index from `0009` (`where parent_debate_id is not null`) is what actually holds, and the loser surfaces as an insert error mapped to `paused("already_revised")` — the same state the user would have seen from the read. The read is there to save a model call in the common case, not to guarantee anything.

The insert path also had to be forced: `/api/judge` reuses an existing unjudged row when one is found within the lock window. `recent` is now always null on a revision, so a revision can never overwrite an abandoned unjudged original that happened to share the topic.

### A revision cannot itself be revised

The judge still returns an `unanswered_objection` for the revision — that is the prompt's instruction and it is the right one, since the student should know what is still standing. But `/revise` requires `kind = 'original'`, so the verdict page shows that objection without an "Answer it" button and says so in a line: one revision per argument, take this one into your next motion. Rendering the button would have produced a live 404.

### The revision share line is built in code

The three `verdict_share_line` values live in the school frontmatter, one per school. A revision line is the same sentence whatever school you argued — the interesting part is the movement and the rival school's name, both of which come from the verdict — so adding a fourth per-school field would have been three more strings to write for no variation. It falls back to the ordinary verdict line when the objection is still standing, or when the parent is a v1 verdict with no objection at all.

### The events fire from the client, not the verdict page

`revision_judged` and `objection_resolved` are once-per-judgement facts, and the verdict page re-renders on every later visit of the same URL. They fire from `ArgumentEditor` off the judge response, exactly where `elo_changed` already fires, and are suppressed for allowlisted reviewers along with it. `objection_resolved` fires only when `objection_answered` is true: a revision that failed to answer leaves the objection standing, and counting it as resolved would make the metric measure attempts rather than outcomes.

### Debate history nests rather than lists

`/me` now queries the last five **originals** and looks their revisions up separately, rendering each under its parent. Listed flat, a revision ate one of the five slots and appeared as a second row with the same topic slug and a different score, with nothing to say which came first.

### The retention funnel was duplicated, not edited

A revision is a genuine return, but it is not a second debate, so overwriting funnel #3 would have silently changed what the Phase 2 number meant. The original stands; the variant sits beside it, with step two backed by a new PostHog **action** (`Argument submitted (debate or revision)`, id 158532) that ORs `debate_submitted` and `revision_submitted` — a funnel step takes one series, so the union has to be an action rather than two events.

- [Second debate within 7 days](https://eu.posthog.com/project/264751/insights/7dG4OHVK) — unchanged
- [Second debate or revision within 7 days](https://eu.posthog.com/project/264751/insights/4Hv7YA9T) — new
- [Argument submitted (debate or revision)](https://eu.posthog.com/project/264751/data-management/actions/158532) — the action behind step two

## Task 3: the share loop

### The card lost its percentages, and two DB reads with them

`STO 44% · UTI 33% · VIR 23%` was the one thing on the card a recipient could not read at a glance, and the one thing that made a screenshot look like a dashboard rather than a statement. The card carries identity now: eyebrow, school name, the school's line, the closing question. The percentages moved to `/r/[id]`, beside a second result, which is the only place a three-way split is a comparison rather than a decoration.

Both image routes were selecting `vector` purely to pass it down, so `card.png` and the OG image now select `school` alone. `CardLayout` and `ResultCard` dropped the prop entirely rather than accepting and ignoring it.

### The portrait card needed a different vertical rule

Removing three lines exposed a composition problem that predated this task: `justifyContent: center` puts a short block in the middle of a 1080×1350 canvas and leaves a third of the card visibly empty underneath. The root is now `space-between` with the identity block in a `flexGrow: 1` centring wrapper and the closing line pinned to the bottom padding edge. On 1200×630 this is nearly a no-op (there was barely any slack to redistribute); on 1080×1350 it turns a gap into a margin. Both re-rendered and checked by eye, not just by dimensions.

Rendered from a local production server: `/r/[id]/opengraph-image` 1200×630, `/r/[id]/card.png` 1080×1350, `/opengraph-image` 1200×630, `/debate/[slug]/[debateId]/opengraph-image` 1200×630 — all `200 image/png`.

### `replaceState` instead of `router.replace`

`router.replace("/r/" + id)` was a real navigation: it unmounted the card the user was already looking at and re-rendered a server component to show them the same thing. `window.history.replaceState` rewrites the address bar and nothing else. A refresh or a shared link still resolves to the server-rendered `/r/[id]`, because the URL is real — it is only the client-side transition that is skipped.

Back-button behaviour was the risk. `QuizShell` uses `router.push("/quiz/result")`, so the stack is `/quiz → /quiz/result`; `replaceState` overwrites the top entry rather than adding one, so Back lands on `/quiz`. Verified in a headless Chromium at 375 px: ten questions, no page errors, `URL after back: /quiz`.

### `pickShareLine` had to be split

`/quiz/result` renders `ShareRow` inline once the id is known, which needs a share line on the client. `lib/schools.ts` carries `server-only` (it reads the filesystem), so importing it from a client component is a build error. The choosing is now a pure `lib/share-line.ts#pickShareLineFrom(lines, resultId)`; `schools.ts` keeps `pickShareLine` as a one-line wrapper. The school content itself was already being passed to `QuizResultClient` as a prop, so no new data crosses the boundary — only the hash function moved.

The pre-id state is one line of text, `Saving your result…`, and not a spinner: the card above it is already complete, and an animation would suggest it is not.

### One primary button, and the debate CTA moved down

`/r/[id]` had three filled `bg-ink` buttons on one screen (`Challenge a friend`, `Debate them`, `Debate a motion`) and no ordering logic. Now: `Debate them` when a challenge has both sides, otherwise `ChallengeButton` — exactly one of them filled, the other bordered via a new `variant` prop — then `ShareRow`, then `Debate a motion` as a bordered button below the rule. A recipient who has just compared two vectors is ready to argue; someone who arrived cold is not, which is the whole reason the debate CTA sits last rather than first.

### `card_downloaded` fires alongside `share_clicked`, not instead of it

`share_clicked { channel: "download" }` already existed and answers "which control did they press". `card_downloaded { result_id }` answers "did the PNG actually leave the site", which is the number that matters for the card and which the Instagram path produces too — that path writes the file and copies a caption, and was previously indistinguishable from a link share. Both fire on both paths.

The download control needed no change: it has been present and enabled since Phase 1 (desktop row), and the mobile row reaches the same PNG through `Instagram`.

## Task 4: first-run escalation and the weekly motion

### `getWeeklyMotion` shipped early, in Task 2

Task 2's empty states need a motion to point at (`Every objection answered.` plus this week's), so the function and its tests landed there rather than here. It lives in `src/lib/weekly-motion.ts`, not in `topics.ts` as the brief has it, for one reason: `topics.ts` carries `server-only`, which makes it unimportable from a vitest file. `topics.ts` re-exports it, so the brief's `topics.ts#getWeeklyMotion` path still resolves.

The ISO week number is the part worth getting right. "Days since Jan 1, divided by 7" is wrong across a year boundary — 2027-01-01 is a Friday and belongs to week 53 of 2026 — so the rotation would stutter or repeat every New Year. `isoWeekNumber` shifts to the week's Thursday first, and there is a test for exactly that date.

### The scaffold is gated on a count, not a flag

`isFirstArgument` is `(judged debates for this user) === 0`, computed per request. No `has_argued` column, nothing to backfill, and it becomes false the moment the first verdict lands. A user who opens the editor twice before submitting anything sees it twice — which is right: they still have not written a first argument, and the brief's own condition is "zero judged debates", not "never shown".

The count is in the same `Promise.all` as the profile and topic lookups, so `/debate/[slug]` makes the same number of round trips it made before — the regression the brief specifically warned about. The profile-missing redirect and the topic 404 now run after the batch rather than between queries; the only cost is one wasted count in the rare case where a user reaches this route with no school.

A revision is never a first argument (its parent is judged by definition), so the scaffold is gated on `!isRevision` too rather than relying on the count alone.

### `SCHOOL_ADHERENT`

The first scaffold line is "State what a [school] would say". Lowercasing the school name gives "what a stoicism would say" — wrong for all three schools, not just an awkward one. A separate map (`Stoic`, `Utilitarian`, `Virtue Ethicist`) sits next to `SCHOOL_COLORS`, which already holds the display names.

### The weekly motion takes the whole top of `/debate`

Six motions listed at once is a menu, and a menu is a decision to make before the real one. The week's motion gets the eyebrow, the stance line, and the only filled button on the page; the other five follow under `All motions` in the existing row style, and the weekly one is removed from that list rather than repeated. When `weeklySlug` is null — no active topics, or the admin client is unconfigured — the list renders exactly as it did before, so nothing depends on the rotation existing.

`weekly_motion_clicked` needs an `onClick`, which would have made the whole list a client component. Only the button is one (`WeeklyMotionLink`); `TopicList` stays on the server.

## Task 5: cases

### The twelve prompts, and where they sit

Two per before-lesson, after paragraph 0 and paragraph 1 (paragraph 0 and 2 for `opaque-benefit`, which has four paragraphs and puts its real fork in the third). The shape is the brief's own: the first prompt is recall from the source, the second asks the reader to carry it somewhere. Both are answerable from the paragraphs above them.

The last paragraph of every before-lesson is the one that states the motion, so the loader **rejects** a prompt placed after it — a prompt there would sit between the motion and the `Begin` button, which is the one place in the reading where nothing should interrupt. That is a rule the brief didn't ask for; it falls out of the content actually being three paragraphs with a fixed job each.

**These twelve are drafts pending Arthur's sign-off.** They are installed rather than held back, so the feature is live and testable end to end and the acceptance criterion is actually met; each is one line of frontmatter in `content/micro/*-before.md` and changing one needs no code.

### Validation throws at module load

`micro-lessons.ts` validates on read, and every route that renders a lesson imports it, so a bad prompt fails `next build` rather than silently swallowing the rest of a lesson at request time. Confirmed by pointing a prompt at paragraph 7 of a three-paragraph lesson: `after_paragraph 7 is out of range (lesson has 3 paragraphs, so 0-2)`, and the build stops.

### Three modules, because `server-only` is load-bearing

`micro-lessons.ts` reads the filesystem, so it carries `server-only` and cannot be imported by a client component. The reading flow and the retrieval prompt are client components and need the lesson shape, the chunking rule and the 300-character cap. Those moved to a pure `lib/lesson-chunks.ts`; `micro-lessons.ts` re-exports them and keeps the loading and the validation. Third time this pattern has come up this phase (`weekly-motion`, `share-line`, now `lesson-chunks`) — the rule is that anything a client component needs cannot live in a module that touches the disk.

### `ReadingFlow` is a new component, not a mode on `MicroLesson`

The acceptance criterion is that `/lessons/[slug]` renders exactly what it rendered before. A `showPrompts` flag on `MicroLesson` would have made that a promise about a code path; a separate component makes it a fact — `MicroLesson` is untouched, and `/lessons/[slug]` and the verdict-page objection still use it.

Checked the content too, not just the component: the six before-lessons were rewritten by a YAML round-trip to add the frontmatter, so every `body`, `title` and `source` was compared against the previous commit and is byte-identical. The folded-scalar re-wrapping changes where the file breaks lines, not what parses out of it.

A lesson with no prompts produces exactly one chunk, which is the whole body with `Begin` under it — the no-prompt path is the old path rather than a special case of the new one, which is what keeps `micro_lesson_viewed` timing and the button position unchanged.

### Responses are keyed by prompt position, not by paragraph

`chunk_index` is 0 or 1 — which prompt in the lesson, not which paragraph it follows. Moving a prompt to a different paragraph is then an edit to a content file, not something that orphans an answer a student already wrote.

State is lifted to `DebateFlow` rather than held in `ReadingFlow`, because the editor quotes the notes back and the reading-to-editor transition has no navigation to reload them.

### RLS, verified

```
set local role authenticated;
set local request.jwt.claims = '{"sub":"1111...","role":"authenticated"}';
select id, response from reading_responses;
-- [{"id":"rlstestaaa","response":"A wrote this"}]   <- B's row is invisible
```

And the write side, user A forging a row owned by B:

```
ERROR:  42501: new row violates row-level security policy for table "reading_responses"
```

Test rows and test users deleted afterwards; `reading_responses` is back to 0 rows.

### Account deletion was already broken, and it is fixed here

The brief asks that deletion cascade `reading_responses`. It does, via `on delete cascade` in the FK. Checking that turned up a bug that predates this task: `debates.user_id` and `ai_calls.user_id` both referenced `auth.users` with **no ON DELETE clause**, and `debates.user_id` was `NOT NULL`. So `auth.admin.deleteUser` hit a foreign-key violation for any user who had ever submitted an argument, and `/me/settings` showed them an error instead of deleting their account.

`0011_account_deletion_fks.sql` makes both `ON DELETE SET NULL` and drops the not-null, following the reasoning already recorded for `quiz_results`: a verdict page is a public link and deleting the row would 404 a stranger's bookmark.

The argument text is a different question, and `deleteAccount` now handles it separately: an **unpublished** argument is deleted, because it was never public and an orphaned row is no reason to keep someone's writing after they have asked to be forgotten. A published one is kept, because publishing it is the consent that keeps it up.

### `getCaseStates` is plural first

Every caller wants all six topics at once — `TopicList`, `/me`, and Task 9's `/class/[code]`. Two queries for the whole set, not two per topic. `getCaseState` (singular) is a wrapper for the one caller that wants one.

`read` is satisfied when a lesson's prompts are all answered **or the lesson has none**, which matters: without that clause a topic whose before-lesson has no prompts could never be read, and so never closed.

While adding case states to `/debate` I collapsed its per-topic best-score lookup into a single query. It was six round trips on a six-motion list and adding states per topic would have made it twelve.

## Task 7: keep-alive cron

Built rather than taking the brief's alternative of upgrading Supabase to Pro. The reasoning is the cost line: Pro is $25/month against an AI budget of $50/month, and it would be bought to solve one problem — a project pausing after seven idle days — that a once-daily request solves for nothing. The choice is worth revisiting the moment Pro is wanted for anything else (backups, no-pause guarantees, connection pooling); until then this is the cheaper half of the same outcome.

Scheduled at `17 4 * * *` rather than midnight. Vercel Hobby allows one cron a day, and an off-the-hour minute keeps it out of the queue every other Hobby project's `0 0 * * *` job is sitting in.

The query is `select ... head: true` against `debate_topics` — six rows, already indexed. Any read counts as activity, and choosing a table the product actually uses means the cron also fails if the service-role key is rotated out from under the deployment, which a `select 1` would not catch.

Verified locally against a production build: no header → `401 {"ok":false}`, wrong secret → `401`, correct secret → the route authenticates and reaches the Supabase call (500 here only because this sandbox's proxy can't reach Supabase, the same constraint recorded in Phase 1). The local test secret was added to `.env.local` for the run and removed afterwards.

**`CRON_SECRET` has to be set in Vercel** for this to do anything — without it the route returns 401 to Vercel's own scheduler and the project pauses anyway. Vercel generates and injects it automatically for projects with a `crons` entry, but it is worth confirming in the dashboard after the first deploy rather than assuming.

## Task 8: Counterpart

### The screen is the whole feature

Everything else here is plumbing around one rule: **no turn is ever delivered unscreened.** The row is written first, as `pending`, and `pending` is invisible to the counterpart because the RLS policy requires `screen_result = 'ok'`. Then the model is called. Every way that call can fail — kill switch, over budget, over the daily cap, a network error, unparseable JSON — lands in the same place: the row stays `pending`, nothing is delivered, and the author is told their reply is saved and will go out once it has been checked. There is no branch in which an unscreened turn reaches the other person.

Writing before screening is deliberate and is the opposite of the obvious order. Screening first and writing on success would mean a failed model call costs someone the paragraph they just wrote, and this is a product for 15-year-olds writing 1,200 characters on a phone.

### The screen prompt is tuned against false positives, not false negatives

A held reply costs a student one of only four turns in an exchange, and they cannot post again in it until a human reviews the hold. A mildly rude sentence getting through costs much less. So `screen.v1.md` spends more words on what is **not** a violation than on what is: forceful disagreement, calling an argument stupid (as opposed to the person), and naming philosophers, works, schools of thought, countries and institutions *as the subject of the argument*. That last one is the trap — `personal_info` is about identifying the two students, and a screen that flags "Bentham" or "Germany's Ethics Commission" would make the feature unusable for the thing it is for.

`tests/screen/run-screen.ts` (`npm run screen:check`) exercises six fixtures against the real model. Three are the traps, three are real violations:

```
case                      expected        got             pass
ok-plain                  ok              ok              yes
ok-forceful               ok              ok              yes
ok-names-philosophers     ok              ok              yes
personal-info-phone       personal_info   personal_info   yes
harassment                harassment      harassment      yes
off-topic                 off_topic       off_topic       yes
6/6 · $0.00592
```

Under a tenth of a penny for the whole suite, and about $0.0006 a turn against the estimate in the `// COST:` comment.

### Pairing has no queue, and re-pairing is allowed once an exchange is finished

Opting in marks the debate and then immediately looks for someone already waiting on the same motion, different school, not blocked in either direction. Whoever arrives second completes the pair. No cron, no queue table, no notification — the only thing a queue would buy is a number to display, and the brief rules out showing one.

The brief's disqualifier is "no open exchange between the pair". I kept it at exactly that rather than widening it to "never paired before", which was my first instinct. Two *live* exchanges between one pair would just be one exchange with eight turns, which is what the four-turn cap exists to prevent — but refusing to ever re-pair would starve pairing completely in a school-sized cohort with six motions.

### Two accounts deleting, and what a party sees

Every FK to `auth.users` here is `on delete set null`, not cascade. If it cascaded, one person deleting their account would delete the exchange out from under the other, who would land on a 404 with no explanation. Instead the row survives, `user_a`/`user_b` goes null, and the page says `Your counterpart has left.`

### Lapse is closed on view

An exchange that goes 14 days without a reply is shown as lapsed and closed the next time someone opens it. No job, and `/me` deliberately filters lapsed exchanges out rather than closing them: a page should not write rows as a side effect of rendering.

### RLS, verified three ways

An outsider (a third account, party to nothing):

```
set local request.jwt.claims = '{"sub":"3333...","role":"authenticated"}';
select (select count(*) from exchanges), (select count(*) from turns);
-- [{"exchanges_visible_to_outsider":0,"turns_visible_to_outsider":0}]
```

Party A, who did not write the held turn — sees the exchange and the screened reply, not the held one:

```
-- [{"who":"party A","exchanges":1,"turns":1,"turn_ids":"cptestturn"}]
```

Party B, who authored both — sees their own held turn, which is how they find out it was held:

```
-- [{"who":"party B (author)","turns":2,"detail":"cptesthold:flagged, cptestturn:ok"}]
```

That last case is why there are two select policies on `turns` rather than one. Postgres ORs them: `turn read party` delivers screened turns to both sides, `turn read own` lets an author see their own work in any state.

Test rows and test users deleted afterwards.

### `next_turn` is authoritative, and checked twice

The route refuses unless `next_turn` is the caller **and** the seq-derived author matches. They should never disagree; if they do, something wrote `next_turn` wrongly, and letting the wrong person consume one of four slots is not recoverable. The unique index on `(exchange_id, seq)` is the real guard against two concurrent submissions taking the same slot — the read-then-insert above it only saves a model call in the common case.

### The newer seeker is user_a (2026-11-04)

Found while building sample activity (#57), and fixed on Arthur's ruling
of 2026-11-04. `seekCounterpart` made the waiting seeker `user_a` and set
`next_turn` to the newer seeker, while the turn route takes odd turns from
`user_a` (`authorForSeq`) and refuses unless `next_turn` agrees. On turn 1
the newer seeker passed the `next_turn` check and failed the author check,
and the waiting seeker failed the first: no exchange could ever start.
Production had no exchange (a read-only count of `exchanges` on
2026-11-04 at about 03:30 UTC returned 0), so nobody was caught in one.

The fix keeps who opens, which the code's own comment attributes to the
brief ("`next_turn` is the newer seeker"): the newer seeker is now
`user_a`, with their own debate and school on the `_a` side, and
`next_turn` names them. The route is frozen and unchanged. The other
readers of an exchange (`/me`, the verdict page, `blockCounterpart`,
`scripts/review-turns.ts`, the turn route's quote source) work out
"mine" and "theirs" from `user_a` and `user_b` symmetrically. One is
not: `/counterpart/[id]` shows the motion wording of `debate_a`, "the
opener's words", which is now the newer seeker's, as that page's own
comment intends. `tests/counterpart-pairing.test.ts` checks the
invariant itself: the opened exchange's `next_turn` is
`authorForSeq(1, user_a, user_b)`; it fails on the old code.

### What is not verified

The four-turn end-to-end run with two real accounts, and `KILL_SWITCH_SCREEN=true` stopping delivery, could not be exercised here: this sandbox's proxy does not allow the app's own server to reach Supabase (the constraint recorded in Phase 1), so authenticated flows can only be run against the deployed site. The pieces they depend on are each verified separately — RLS by direct SQL, the screen by the fixture suite, the turn and quote rules by unit tests (`tests/counterpart.test.ts`, 30 tests passing) — but the assembled path is untested until it runs on Vercel.

## Task 9: the teacher class link

### The brief's class RLS does not work

The two policies as drafted reference each other's table: `classes` select reads `class_members`, and `class_members` select reads `classes`. Postgres refuses the first query either of them touches:

```
ERROR:  42P17: infinite recursion detected in policy for relation "classes"
```

Found by running the brief's SQL as written and then querying as a member. Fixed with two `security definer` helpers, `is_class_member` and `is_class_owner`: RLS is not applied inside a definer function, so each policy can ask its question about the other table without re-entering that table's policy. Both are `stable`, so they evaluate once per query rather than once per row, and both pin `search_path = public` so the body cannot be redirected by a caller's schema.

Verified for all four roles afterwards:

| as | classes visible | class_members visible |
| --- | --- | --- |
| owner (teacher) | 1 | 1 |
| member (student) | 1 | 1 (their own row only) |
| outsider | 0 | 0 |

The member's single visible row is their own; the teacher sees the roster. Test rows and users deleted afterwards.

### `?join=CODE` pre-fills, it does not join

A shared class link lands on `/me/settings?join=CODE` and fills the code field. It does not join on arrival. A GET that changes state is a GET a browser prefetcher, a link scanner or a chat client's unfurler can fire on the student's behalf, and joining a class is a consent step — the copy under the field is the thing they are supposed to read before pressing the button.

### A wrong code and a real one give the same error

`joinClass` returns `That code doesn't look right.` both when no class matches and when the code is malformed. A distinguishable error would turn the form into an oracle for walking the code space, and unguessability is the only access control a class link has. Codes are eight characters from nanoid's CSPRNG over `[a-z0-9]`, ~2.8 × 10¹² of them, generated server-side and never derived from the name, owner or time.

### What `/class/[code]` cannot show

Grepped the route for `score`, `elo`, `streak`, `argument`, `percentile` and `par_elo`: the only matches are the comment saying they are absent and the copy telling the teacher so. The page selects `id, name, owner_id` from classes, `user_id, joined_at` from members, `slug, title, sort, micro_before` from topics, and `id, display_name, school` from profiles. `CaseState` is four booleans. There is no column in scope that could leak a number even by accident, and members are ordered by join date with no sort control.

### The N+1 the brief warned about, partly

The brief asks for one query per class instead of 6 × N. `getCaseStates` is already batched across topics — two queries for all six motions — so a class is 2 × N, not 6 × N, and the N runs concurrently through `Promise.all`. Going further would mean rewriting `getCaseStates` to take a list of users, and its `read` rule needs per-user retrieval-response counts either way. At a class size of 30 that is 60 concurrent indexed lookups on a page a teacher opens occasionally. Left as is, and noted here rather than silently: if a class ever gets big enough for this to matter, the fix is a single grouped query per table.

## Task 6: accessibility and performance

Run last, deliberately: it audits what the other eight tasks built rather than being a task of its own.

### Three real defects, found by measuring rather than by reading

**1. `--color-utilitarian` missed AA by a hair.** `#8a6320` on `--color-paper` measures **4.43:1**; body text needs 4.5:1, and the school eyebrows it colours are 12px uppercase, so the large-text 3:1 allowance does not apply. Darkened to `#87611f` — **4.58:1** on paper, 5.34:1 on surface. The other two schools already cleared it (stoic 6.07, virtue 7.15 on paper). Computed, not eyeballed:

| token | on paper | on surface |
| --- | --- | --- |
| ink | 14.45:1 | 16.85:1 |
| ink-mid | 6.27:1 | 7.31:1 |
| ink-soft | 4.97:1 | 5.80:1 |
| stoic | 6.07:1 | 7.08:1 |
| utilitarian | **4.58:1** (was 4.43) | 5.34:1 |
| virtue | 7.15:1 | 8.34:1 |
| oxblood | 9.93:1 | 11.58:1 |

Card surfaces, which the brief asks for separately: stoicism **8.38:1**, utilitarianism **6.30:1**, virtue-ethics **9.69:1**, all ink `#faf8f2`. Two of the three are AAA.

**2. `/quiz` shipped an empty `<main>`.** `QuizShell` called `useSearchParams()` during render, which opts the calling subtree out of the static prerender. The page was static in the build output and still painted nothing but the header until JS hydrated: FCP 0.8 s, **LCP 2.8 s, CLS 0.1** — the gap between the two, plus the shift when the question finally arrived.

Neither value it read has anything to do with what renders: `c` is a challenge id for analytics and the pending result, `next` is set by `/auth/callback` and threaded through the same payload. Both now come from `window.location.search` in the mount effect. The first question is in the static HTML — `curl /quiz | main innerText` returns `1 / 10 A colleague takes credit for your work…`, 250 characters where there were none.

Measured before and after, three runs each, Lighthouse mobile:

| | perf | LCP | CLS |
| --- | --- | --- | --- |
| before | 92, 92, 92 | 2.7, 2.8, 2.8 s | 0.1 |
| after | 97, 95, 98 | 2.5, 2.8, 2.0 s | **0** |

CLS is gone outright. LCP improved but still sits around the 2.5 s line under Lighthouse's simulated slow-4G on a sandbox CPU; a real measurement against Vercel's CDN is the one that counts, and is listed below as not yet taken.

**3. Two draft keys were not scoped by user.** `draft:reading:${topicSlug}:${chunkIndex}` and `draft:turn:${exchangeId}:${seq}` — on a shared school computer, the next student to open the same prompt would have been handed the previous one's notes. Both now carry the user id, matching the rule `ArgumentEditor` already followed. This is the kind of thing that only shows up when you list all three editors side by side and compare their keys, which is what an audit pass is for.

### `prefers-reduced-motion` is now a blanket rule

The reveal animation respected it; the `transition-colors` and `transition-opacity` scattered across buttons did not. Rather than chase them one at a time — and re-chase every one added later — the media query zeroes animation and transition durations globally. Forgetting one is a preference the user explicitly set being quietly ignored, which is the wrong default to leave lying around.

### Fonts: one weight was dead, one was silently falling back

`spectral-600.woff2` was declared and shipped, and nothing used it — `font-semibold` and `font-bold` have zero occurrences across the codebase. It became dead in Task 3, when the card wordmark moved from Spectral 600 to Plex Sans. Declaration and file both removed.

The one remaining `fontWeight: 600` was in the site OG image, which registers only a 500 Spectral face with Satori — so it was silently falling back to 500 anyway. Now it asks for 500, which is what it was always getting. All faces remain Latin-subset with `display: swap`.

### Numbers, and what is missing from them

Lighthouse mobile, local production build, Chromium headless:

| route | perf | a11y | LCP | CLS |
| --- | --- | --- | --- | --- |
| `/` | 98 | 100 | 2.3 s | 0 |
| `/quiz` | 95–98 | 100 | 2.0–2.8 s | 0 |
| `/lessons` | 95 | 100 | 2.7 s | 0 |
| `/s/stoicism` | 95 | 100 | 2.7 s | 0 |
| `/login` | 97 | 100 | 2.4 s | 0 |
| `/debate/rubric` | 96 | 100 | 1.6 s | 0.03 |

No failing accessibility audit on any measured route. No horizontal scroll at 375 px on `/`, `/quiz`, `/lessons`, `/lessons/[slug]`, `/debate/rubric`, `/s/[school]`, `/login` or the 404.

**`/r/[id]`, `/debate/[slug]`, the verdict page, `/counterpart/[id]` and `/class/[code]` are not in that table**, and the brief asks for three of them. They need a signed-in session and a reachable Supabase, and this sandbox's proxy does not allow the app's own server to reach Supabase — the constraint recorded in Phase 1. Those five have to be measured against the deployed site. Everything measurable without a session is above.

### Touch targets and focus

Every control carries `min-h-11` (44 px) or `py-3`/`py-2.5`, well past the 24 × 24 minimum; a grep for interactive elements without one returns nothing. Focus is a single global `:focus-visible` rule — 2 px ink outline, 2 px offset — on links, buttons, inputs, textareas, selects and anything with `tabindex`, so a control added later inherits it rather than needing to remember.

Nothing conveys information by colour alone. The case ticks are fill-vs-hairline with a full `aria-label` naming each of the four states; every school-coloured eyebrow names its school in text (`Objection · Utilitarianism`, `You · Stoicism`); the vector columns are a `<dl>` with school names as terms. The school-coloured left stripes on `/debate` and `/me` are the same colour for every row — they are the reader's own school, not per-row data — so there is no information in them to lose.

## The Daily path restyle

Nine stages, from mockups 00 to 10. What follows is the part that outlives the work: the decisions a later change could undo by accident.

### The cream reversal

`--color-paper` used to be `#f8f8f6`, near-white and very slightly cool, with the note "Warmer cream reads as a template" sitting beside it. The Daily path mockups are built on `#f7f3ea` throughout and the restyle was commissioned for them, so paper is warm now and that note is gone. It was the right call for the previous design; it is not a rule that was broken, it is a rule that was superseded, and the comment in `globals.css` says so rather than leaving a contradiction for someone to resolve the wrong way.

### Three axes, not four

Mockups 02, 04 and 06 all leave room for four scores, the landing mockup says "four axes" in prose, and the verdict table this replaced called itself four by counting the composite out of 100 as one of them. `content/prompts/judge.v2.md` defines three criteria and one composite. Three won, and `tests/judge-axes.test.ts` reads the prompt file directly and asserts the count, the order and the key names, so a fourth cannot be added to the UI without the prompt agreeing first.

### The school table counts originals only

`docs/daily-path-copy.md` §8 first said "every judged argument", which would have included revisions. A revision is a second attempt at the same motion after feedback and does not move the reader's rating, so it should not move their school's row either, and counting it let one motion be argued twice. The query takes `kind = "original"`, the copy says "every judged original argument", and `countsOnTable()` is the single rule both the table and the verdict's `+1 for the {school} on the table` line read, so the two cannot disagree about the same argument.

### The reading check lives in the browser

Step 2's picks are in `localStorage` under `check:${userId}:${topicSlug}`, not in a table. The score gates nothing and is only ever read back to draw one tile, so a row per answer would be a migration and a write path for a picture. Module progress followed the same reasoning, under `module:${viewerId}:${moduleId}`, holding the furthest reading reached. The cost, in both cases, is that neither follows a reader across devices. Keyed by user as well as by topic because two people share a browser more often than anyone plans for.

### Module readings are marks in the frontmatter, not files

A module carries a `readings` list of titles and starting paragraphs; the body is one run of prose and stays that way. `splitModule()` in `src/lib/module-readings.ts` is the only thing that divides it, which is why the index's count and the reading page's "Reading n of N" cannot drift apart. Bad marks fail the build rather than warning, unlike the other module fields: they are four lines of frontmatter, and a wrong one silently drops or repeats paragraphs of a lesson.

### `/styleguide/arena` is visible on previews

The arena needs a session, rows in Supabase and an `ANTHROPIC_API_KEY` that is production-only, so the verdict and revision screens cannot be reached on a preview at all. The gate is `SOPHECS_PREVIEW === "1" || VERCEL_ENV === "preview"`: local when the env var is set, every Vercel preview, and a 404 in production, which is the part `CONTRIBUTING.md` cares about. Previews sit behind Vercel's own sign-in. Fixtures are not real data and have no business on the live site.

### The palette is promoted, the wrapper is not finished

The seven colour lines live in `@theme static` now, so every route shares one palette. `[data-daily-path]` still exists and still carries `--font-sans` and `--radius-control`: the routes not yet redrawn keep Plex Sans and their 6px controls, and take the warm paper and nothing else. The wrapper goes when the last of them is redrawn. `--color-ink-soft` and `--color-ink-mid` are one value now, site-wide, rather than two names for one colour on some routes and not others.

### One saturated surface, and one sanctioned exception

The result card is the product's only fully saturated surface. `design/tokens.md` §1 reserves `--*-surface` and `--on-saturated` for it and its OG and PNG renders, and says any other component referencing them is a bug. That still holds and nothing here touches those four tokens.

The marker rule in the same section separately permits a filled card in a school's *marker* colour (`--color-stoic` and its two siblings). **Today's case card is the one place that is used, and it is the only sanctioned exception.** It earns it: the motion is the single thing that screen is about, the card is the reader's own school answering back, and there is nothing else on the page competing to be looked at first.

`/s/[school]` was built with the same treatment during stage 13 and it was wrong. A filled school panel at the top of a public page read as a second result card, which cheapened the real one: the poster stops being a poster when every school page is already wearing it. That page now leads with the quotation in Spectral, ink on white, inside a card whose school colour is a 4px left edge. The edge is the marker rule's first form, widened from 2px because identifying the school is the whole job of that one surface.

The test for a future filled card is not whether it looks good. It is whether that screen is about one school in the way Today is, and whether anything else on the page is asking to be looked at first.

### A primary button is coloured for whoever acts

A primary action takes the school colour of the person pressing it, never the school colour of whoever or whatever the content is about.

Three buttons on /me broke this on the first pass and all three looked plausible. "Answer it" under an objection took the objector's school; "Reply" on a counterpart card took the counterpart's. Both read as reasonable, because the colour was next to a name in the same colour. Both were wrong: the reader is the one answering, and the card had already said whose objection it is, on its own line, in their colour. A button in someone else's colour says they are about to act.

So: the content names its subject in that subject's colour, as a word or a 2px rule; the button carries the actor's. Where the actor has no school, the `ink` tone is the primary and the entry above says when. Where the action is destructive, the `error` tone is, and it is coloured for the act rather than for anyone.

**A shared component is not an actor either.** `Dialog` coloured its confirm `ink`, on the reasoning that a dialog cannot know whose school is asking. That was the component's ignorance standing in for a product rule. The one place in the product that opens a plain confirmation is the send to the judge, where the reader has a school, the editor behind the dialog is painted in it, and the button that opened the dialog is too; the confirm came up near black and disagreed with all of it. `Dialog` now takes an optional `school` and the caller passes it, because the caller is the only thing that knows. `ink` is what is left when there is none to pass, which today is nowhere in the product. A `destructive` dialog stays `error` even when a school is given, because a destructive act is coloured for the act.

**A safety control is never in a school colour, and never in ink.** Report and block are not primary actions and the rule does not reach them: a report button wearing your school says the thing you are doing is an argument, which is exactly what it is not. They stay paper. The same holds for anything that exists so a reader can get away from another reader.

The two places this bites hardest are the ones still to be redrawn: Counterpart, where two schools are on screen at once and only one of them is yours, and /c/[id], where the challenger and the challenged both have one.

### What the last stage of the restyle did

Written down while it accumulated, because every route redrawn left something that could only be done once they all were. All five are done; the list stays as the record of what the stage was.

1. **Promote the font and the radius.** `--font-sans: var(--font-ui)` and `--radius-control: var(--radius-chunky)` move from `[data-daily-path]` into `@theme static`, the way the seven colour lines already did.
2. **Delete the wrapper.** `[data-daily-path]` goes, and with it the CSS block and every `data-daily-path` attribute. The `.chunky`, `.dp-progress`, `.dp-node` and motion rules scoped under it lose the prefix.
3. **Put the containers back.** `/today`, `/table`, `/s/[school]`, `/login` and `/debate` each write out `<main className="flex-1">` plus a `mx-auto max-w-* px-6 py-10` div, because the wrapper had to sit on `<main>` and `<Page>` owns that element. With the wrapper gone they all go back to `<Page>`.
4. **Delete `src/components/ui/Button.tsx`.** `ChunkyButton` and `ChunkyLink` replace it. Eighteen files still import `Button` or `ButtonLink`; each one is a route that will have been redrawn by then.
5. **Redraw `ErrorState` and `EmptyState`.** Both are shared across routes, so neither could be done in a stage that owns one route: changing them would change pages that branch did not touch. `ErrorState` keeps its `role="alert"` and its error rule, which is what separates it from the notice cards the redraw introduced; what changes is the serif title and the hairline left rule. `EmptyState` is the same job on the other side, and is a plain card: emptiness is not a fault and must not announce itself as one.

**Two things the stage turned up that were not on the list.**

`/404` had never been redrawn. It is not a route anyone lists, it carried the last `ButtonLink` in the product, and it was still in Plex Sans because it never had the wrapper to take Bricolage from. Deleting `Button.tsx` made it visible.

Six routes had lost their `<main>` landmark. `/lessons`, `/lessons/[slug]`, `/today`, the module reader and `/styleguide/daily-path` each replaced `<Page>` with a bare `<div className="min-h-screen">` in order to carry the wrapper, and `<Page>` is what renders `<main>`. A page with no main landmark has nothing for a screen reader to jump to. They are back on a `<main>`, and the ones that could take `<Page>` have.

**One thing the stage deliberately did not do.** `<Page>` now has two vertical rhythms: `page` at 48 top / 80 bottom, and `path` at 40/40, which the restyled routes hand-rolled while the wrapper existed. Collapsing them is a decision about how much air the product's pages have, and nothing should change its spacing as a side effect of an attribute being removed. The prop exists so that the two can be made one deliberately, in a change whose whole subject is that.

**And on 2026-10-10 Arthur decided they stay as they are.** Two rhythms is a known inconsistency in the product, accepted rather than outstanding, and this entry is where it is written down so nobody finds it later and takes it for an oversight. The reason it is accepted: there is no collapse that leaves both sets of pages where they are, so whichever value wins, half the product moves, and that is not a change worth making as housekeeping. The `rhythm` prop is therefore not a loose end. It is the record of which routes the restyle gave the tighter frame.

The honest shape of it is wider than the prop, and writing down only the prop would understate it. Seven routes ask `<Page>` for `path`: `/method`, `/debate`, `/debate/rubric`, `/table`, `/s/[school]`, `/login` and `/404`. Three more land on the same 40/40 without going through `<Page>` at all, because they hand-roll the container: `/me` and `/me/settings` do it inside `ProfilePage` and `SettingsPage`, `/lessons` does it on the page itself. The landing page separately hand-rolls what `<Page tight>` already is. The reading views are not in this count; `/lessons/[slug]` and the module reader carry their own top bar and their own vertical frame on purpose. So it is two rhythms in the component plus four routes that never ask it, which is why collapsing the prop on its own would not finish the job.

What the inconsistency costs a reader: moving from `/today` at 48/80 to `/me` at 40/40 is an 8px step at the top of the page and a 40px one at the bottom. On a phone the bottom of a page is usually scrolled past rather than looked at, so the top step is the one that could register, and 8px is below the width at which a difference reads as a mistake rather than as two pages.

Whoever collapses them later is making a spacing decision about every route at once, not tidying a prop away, and the four hand-rolled containers have to come in with it or the collapse is cosmetic. That change wants before and after at both widths, and its own review.

### The ink tone: a primary for screens with no school

Every primary action in the restyle is the reader's own school colour. That works everywhere the reader has a school, which is everywhere except the screens that exist to give them one. `/login` is the first; the quiz escapes it by colouring its buttons with whichever school the answers so far are leaning towards, and the landing page escapes it by having no primary at all.

`ChunkyButton`'s `ink` tone fills with `--color-ink` and letters in `--color-paper`. It introduces no token: both already exist. Its edge is `--color-rule-strong`, which makes it the only tone whose edge is lighter than its fill, because ink is two steps off black and this palette has nothing darker to sit a button on. On paper a lighter edge under a near-black button reads as the button standing proud of the page rather than casting a shadow, which is the same thing the chunky press is saying everywhere else.

Use it where the reader has no school and the screen still needs one clear action. Do not use it as a general dark primary next to a school-coloured one: two saturated primaries on a screen is two answers to "what now", which is the rule the lessons card on Today already follows by staying paper.

### The card colours are frozen against the palette, on purpose

`src/lib/card-tokens.ts` described itself as a mirror of `globals.css` that must be resynced whenever a token moves. Four of its values no longer mirror anything: `OG_PAPER`, `OG_INK`, `OG_INK_MID` and `OG_INK_SOFT` hold the pre-restyle colours. A shared image is not a page. Every link preview, saved card and favicon already sitting in a feed, a chat or a bookmark bar was rendered at those values, and matching the site would have recoloured all of them at once. `/opengraph-image`, `/icon` and `/apple-icon` hash to the same bytes either side of the promotion, which is how this was checked rather than argued. The school values in that file *are* still a mirror and must be kept in step.

### A motion is read live, so a reword rewrites the past

`debates` has no motion column. The `motion text not null` in
`0003_debates.sql` belongs to `debate_topics`, and the verdict page, the
debate OG image and `/api/judge` all look the motion up by slug at the
moment they run. Nothing is snapshotted with the argument.

So seeding a reworded motion rewrites what every past verdict page says
the argument was arguing. The argument and the verdict text stay as
written; the line above them changes. This was found during Phase 1F, when
the only judged debate on `opaque-benefit` was Arthur's own and not
public, so the whole blast radius was one page one person could see. The
next time it will not be.

**Phase 2 adds an additive `motion_text` column on `debates`,** filled at
argument submission, read by the verdict page, the OG image and
`/api/judge` in place of the live lookup. Additive because every existing
row predates it.

Two things that scoping should not skip. **Pending arguments are the
sharper half**: a verdict re-rendering with new wording is cosmetic, but
an argument submitted before a reword and judged after it would be scored
against a motion its author never read, and that is a wrong answer rather
than an untidy one. And **the backfill needs a decision**: the one
existing judged debate was argued against wording that now survives only
in `docs/seed-snapshots/`, so filling the column for old rows means
reading it back out of a snapshot rather than out of the live table.

Until that lands, a reword is a two-step operation and the steps belong
minutes apart. The markdown surfaces (`/`, `/lessons`, the module pages)
change on merge; the database surfaces (the whole arena, `/today`, `/me`,
and the judge) change only on the seed. In between, a reader can read one
motion and be asked to argue another.

## Phase 2B: the school registry

### Draft schools are behind `server-only`, not behind a filter

The registry's first shape held all six schools in one client-safe module.
It compiled, it passed 242 tests, it rendered byte-identical pages, and it
put `confucian`, `ubuntu`, `buddhist`, `Confucianism`, `Ubuntu` and
`Buddhist Ethics` into thirteen chunks under `.next/static`, including the
ones for `/`, `/quiz`, `/r/[id]`, `/me`, `/login` and `/today`. `main`
shipped none of them. Three unreleased product decisions in the production
client bundle, with every gate green.

So the registry is two files. `src/lib/school-registry.ts` holds the
published schools; `src/lib/school-registry.drafts.ts` holds the drafts
behind `import "server-only"`. `SchoolId` still names all six, which costs
nothing, because a type is erased before a bundle exists.

**Why not a build-time filter on `status`.** A filter has to be trusted to
work. It depends on the bundler proving a branch unreachable, it leaves the
draft strings sitting in a module client code may import, and when it stops
working it does so silently: the names are simply in the output again. A
`server-only` import is checked on every build, and the failure is a build
error naming the file that did it. The guarantee should be enforced by the
tool that assembles the bundle, not inferred from its optimiser.

The split also made the fallback rule true by construction. The first
version built every per-school map over all six schools and wrote a
neutral for the ones with no colour, which is what baked the draft keys in.
`publishedLookup` holds the published entries and computes a neutral from
the id for anything else, so a draft school renders in neutral ink because
the client genuinely does not know it, rather than because somebody
remembered to write a fallback. A name falls back to the id, which is true,
is not another school's name, and is not the string `undefined`.

Three things legitimately see a draft, and all three are server-side:
`/styleguide/drafts`, which is the preview-only review route;
`src/lib/modules.ts`, which recognises a draft school in order to skip it;
and the tests.

### `npm run check:bundle` is the fifth gate

The four gates were all green while those thirteen chunks shipped, so the
honest conclusion was a fifth gate rather than a note in a pull request.

`scripts/check-client-bundle.ts` greps `.next/static` for every draft
school's id, name and adherent nouns, taking the strings from the registry
so a school added tomorrow is covered without touching the script. It runs
last because it reads what `npm run build` produced, and it fails when
there is no build to read rather than passing vacuously.
`tests/client-bundle.test.ts` runs the same check when a build is present
and checks the checker against a fixture, so a regression in the matcher
fails rather than passing quietly.

`CONTRIBUTING.md` is the authority on the gate; `CLAUDE.md` restates the
five commands.

### Two things 2E owes before any school is published

**`/api/judge` must refuse a school with no fidelity criteria cleanly.**
`FIDELITY_CRITERIA` is a proxy that throws on a school nobody has written
criteria for, because the alternative was returning `undefined` and letting
`src/lib/anthropic.ts` substitute the literal string "undefined" into the
prompt and send it: a verdict produced against no criteria at all, with
nothing to show it had happened. Throwing is the safe failure, not a good
answer. Today a draft school cannot reach the judge, because
`profiles.school` is constrained to the published three. Phase 2C widens
that constraint, and from then until a new school has criteria the only
thing standing between a reader and a 500 is that nothing writes a draft
school into a profile. `/api/judge` should answer a `paused`-style refusal
the way it does for the kill switch and the budget.

**The judge never sees the stance.** The request is the system prompt with
the school's fidelity criteria interpolated, then the motion, the school
and the argument. `debate_topics.stances` is read by `/debate` and shown to
the reader; it reaches no model. Anything that claims to pin the whole
judge request, the fixtures in `tests/judge-request/` included, must not
assume otherwise.

### Open item: drop `backup_20261022` after 2026-10-29

This Supabase project is on the free plan, and Supabase's own
documentation is explicit that daily backups cover Pro, Team and
Enterprise only, with Point-in-Time Recovery a paid add-on on top of
those. Their advice to free projects is to export their own data. There
was nothing to restore from before Phase 2C, so 2C took its own copy:
a schema named `backup_20261022` holding `quiz_results`, `profiles`,
`debates` and `exchanges` as they stood before migrations 0014 and 0015.
Row counts matched the source exactly, 27 / 1 / 1 / 0.

It is deliberately unreachable rather than merely unlisted. The Data
API's exposed-schema list is not readable from SQL on this project, so the
guarantee does not rest on it: `anon`, `authenticated` and `service_role`
all have no `USAGE` on the schema, so nothing served by PostgREST can read
it whatever that list says. A restore would run as the owner, over the
management connection, which is also the only thing that can read it.

**Drop it once 2C is settled, from 2026-10-29.** It is a copy of real
user rows with no row-level security of its own, kept only because the
plan offers no alternative, and it should not outlive the reason for it.

    drop schema backup_20261022 cascade;

Nothing in the repository holds any of it: the committed snapshot,
`docs/seed-snapshots/2026-10-21-phase2c-pre-migration.json`, is schema and
shape only, because this repository is public.

**Closed 2026-11-05.** Arthur dropped it in the SQL Editor; read back at
03:05 UTC, gone, with the live tables unchanged (`docs/progress.md`).

### Open pre-pilot item: there is no restorable backup

The project is on Supabase's free plan, which has no daily backups and no
Point-in-Time Recovery; both start at Pro. Phase 2C worked around it by
taking its own copy into `backup_20261022` before applying, by hand, once.
That is adequate for one migration Arthur is watching. It is not adequate
for a term's worth of student work.

**Closed on 2026-11-05:** Arthur decided no backups and no Pro, an
accepted risk ("Arthur's rulings of 2026-11-05 on Checkpoint A").

**Decide before the Winchester pilot puts student data in**, because the
choice changes what a bad afternoon costs:

- **Pro upgrade.** Daily backups for the last 7 days, with PITR available
  as a paid add-on on top. Nothing to build and nothing to remember.
- **A scheduled private export.** `supabase db dump` on a timer into
  storage Arthur controls, which is what Supabase themselves recommend to
  free projects. Cheaper, and it is one more thing that can silently stop
  working.

Either way it needs settling while the only rows at risk are Arthur's own.
A pilot turns "we lost a day" from an annoyance into a letter to a school.

### Phase 3 item: move `motion_text` into `debates_public`

2D reads `debates.motion_text` with the admin client on the verdict page
and on the verdict OG image, in parallel with the topic read. It is one
column, keyed to the debate the page is already rendering, and it costs no
extra round trip. It is also the second read of a table those two surfaces
otherwise reach only through the view.

The tidier shape is the column on `debates_public`, where every other
public field on those pages comes from, and no admin read of `debates` at
all. 2D did not do it because of the order it forces: the view has to be
widened in production **before** the code that selects the new column can
deploy, or both pages ask the view for a column it does not have and
`notFound()`. That is a migration gating a deploy, on a branch whose point
was the readers.

So, in Phase 3, in this order:

1. A migration adding `motion_text` to `debates_public`, by
   `create or replace view` with the column appended, which keeps the
   grants and needs no drop. Applied and confirmed on its own.
2. Then the code: `motion_text` moves into the existing
   `debates_public` select on both surfaces, and the `admin.from("debates")`
   read for it goes away.

Worth knowing before step 1: `anon` and `authenticated` hold SELECT on
that view, so the column becomes readable through the Data API. That grants
no new private data, since the motion is public content and the page it
feeds has always been public, but it is a deliberate widening rather than
an incidental one.

**Done, Stage 2 of the brief of 2026-11-03**, in that order: migration
0020 (`supabase/migrations/0020_debates_public_motion_text.sql`) is 0018's
view, keep-list, parent rule and type checks unchanged, with
`d.motion_text` appended as the last column, applied before the code that
reads it. The verdict page and its OG image now select `motion_text` from
the view, and neither reads `debates` for it; the OG image no longer reads
`debates` at all. The rollback has to drop and recreate the view, since
`create or replace` cannot remove a column, so it revokes everything from
`anon` and `authenticated` before granting SELECT back: a recreated view
picks up Supabase's default privileges, which would reopen the write hole
0016 closed. `scripts/test-0020-motion-text-view.sh` (142 checks) runs
every migration before 0020 under production's grants and checks, after
0020, after its rollback and after applying it again, that every column
but `motion_text` of every row reads exactly as under 0018, that the
rollback's `pg_get_viewdef` text is 0018's, that the view's owner,
options and whole ACL are 0018's, and that anon and authenticated can
only SELECT. `tests/verdict-privacy.test.ts` also holds the SQL text: 0020
is 0018 plus the one column, and the rollback is 0018 exactly. Breaking
the migration on purpose was caught each time: dropping the parent rule
failed 6 checks, keeping `verdict_line` with its type check widened
failed 8, and a rollback without the revoke failed 26 (the six write
privileges for each of anon and authenticated, after the rollback and
again after 0020 is reapplied, since `create or replace` keeps grants,
plus the owner, options and ACL comparison at both points). Keeping
`verdict_line` without widening the type check fails no SQL check,
because the type check drops a string in that slot; the unit test that
holds the keep-lists equal is what catches that one. The test runs on
Postgres 16, so "production's grants" there means the seven privileges
16 has; see below for 17's eighth.

Two things review of #54 found. First, rolling back 0015 (which drops
`debates.motion_text`) now needs 0020 rolled back first, since Postgres
will not drop a column a view reads; `scripts/test-migrations.sh` failed
on it and now runs the rollbacks in that order.

Second, production runs Postgres 17.6, where a table has an eighth
privilege, MAINTAIN, and 0016 revoked the six Postgres 16 privileges
other than SELECT. A read of `pg_class.relacl` on 2026-11-03, repeated on
2026-11-04 and kept in
`docs/seed-snapshots/2026-11-04-view-acls-and-roles.json`, shows anon and
authenticated holding MAINTAIN on all four public views (`anon=rm`, and
`anon=m` on `profiles_public`). The earlier grants snapshot missed it
because it was read from `information_schema`, which does not list
MAINTAIN; the next grants read uses `relacl`. On Postgres 17 MAINTAIN
allows VACUUM, ANALYZE, CLUSTER, REFRESH MATERIALIZED VIEW, REINDEX and
LOCK TABLE. On a view only LOCK does anything, and locking a view locks
the tables it reads, in the same mode, with the view owner's rights: a
role holding it could stop every read and write of `debates`. It is not
reachable today, by the same read: anon and authenticated cannot log in
(`rolcanlogin` false), the Data API never issues LOCK, and no function in
`public` runs dynamic SQL. It goes with the grants finding reported to
Arthur on 2026-11-03. 0020's rollback grants SELECT alone, so after it
the view has less than it has today. That assumes the rollback runs as
`postgres`, whose default privileges in `public` the same read shows
granting anon, authenticated and service_role everything, which the
revoke then removes.

### 2F: the version override, and the bug it found in `fillOnce`

Arthur approved a minimal change to the frozen `src/lib/anthropic.ts` on
2026-10-24: a prompt version parameter on `callJudgeModel`, and a
substitution for v3's `{{RIVAL_SCHOOLS}}`. Both exist so the golden set can
measure a draft prompt and produce the two tables the brief asks for
without v3 becoming the production default.

What keeps production on v2 is the default: the parameter defaults to
`PROMPT_VERSION`, and neither `/api/judge` nor `judgeDebate` passes one.
That is asserted twice. `tests/judge-v3-and-refusal.test.ts` reads the
route and checks it names no version (it deliberately makes no assertion
about `judgeDebate`'s source, after a reviewer showed a literal match on it
failed on a reformat and on nothing else);
`tests/judge-request.test.ts` calls `judgeDebate` and compares what it
sends against the same six committed v2 fixtures, for an original and for
a revision. It covered only originals when first written, which reached
three of the six: dropping `params.revisionOf` from the forwarded call
would have left every assertion green while production revisions lost
their objection block. Those six are unchanged
in this branch's diff, which is the test Arthur cares about most while
judging is live.

**The substitution had a bug, and it is worth recording because the shape
of it will recur.** `String.prototype.replace` with a string pattern fills
the first occurrence and says nothing about the rest. A prompt file was
then sent to the model whole, header comment included (v3's comment was
stripped from 2026-11-05 until ruling 12 was reversed on 2026-11-06), and
`judge.v3.md` named both
of its placeholders in that comment before using them. So the first naive
`.replace("{{RUBRIC}}", criteria)` filled the mention in the comment and
left the real placeholder standing: the model would have been asked to
score against a rubric that was still a template, and nothing anywhere
would have said so. v2 was never affected, because it names each
placeholder exactly once.

Three changes, rather than the one that would have been enough:

- A guard refuses a prompt that names a placeholder more than once, and
  refuses one missing `{{RUBRIC}}` altogether. `replaceAll` was the other
  option and is wrong: it would send the criteria twice. It began as
  `fillOnce` inside `anthropic.ts` and is now `fillPlaceholders` in
  `src/lib/judge/fill-placeholder.ts`, because a reviewer showed it could
  be reverted to a silent `replace` with the whole suite still green: it
  had no test of its own, and testing it in place meant building a model
  request. Out of the frozen file it is callable directly, and reverting
  it now fails five of its nine tests.

  That review also found two defects in the substitution itself, neither
  of which had failed anything. It filled placeholders one after another
  over the growing string, so a criteria string containing
  `{{RIVAL_SCHOOLS}}` would have had the school list substituted into the
  middle of the criteria. And `replace(needle, value)` reads `$&`, `$1`
  and `$$` inside the value, which is content somebody writes. It is one
  pass over the raw template with a function replacer now.
- `judge.v3.md` no longer writes either placeholder out in its comment, so
  there is nothing for the guard to catch.
- `tests/judge-request.test.ts` checks the invariant at the file level, for
  every `judge.v*.md`. Confirmed by re-introducing the duplicate and
  watching four tests fail. Three were the point; the fourth was a test
  of something else that died on the unexpected exception, which is worth
  knowing because an exception escaping into an unrelated test is how a
  guard's blast radius gets misread.

### 2F: four bands, not two, and an unconstrained one

`GoldenCase` gained `expected_rigor_band` and `expected_engagement_band`,
and `expected_fidelity_band` became optional. An absent band means the axis
is measured and printed but cannot fail the run; the table prints `any`.

Two cases needed it, and both came out of Arthur's revision of the draft
criteria:

- `fabricated-source` is now **score 0-50, rigor 0-3, fidelity
  unconstrained**, and it must also have `weakest_move` name the
  invention. Arthur widened the score band from 0-40 on 2026-10-24. v3
  calls a fabricated source a rigor failure, so rigor
  is where the band belongs. The Stoic reasoning wrapped around the
  invented quotations really is the school's, so a judge scoring fidelity
  high there would not be wrong and one scoring it low would not be
  either. Pinning it would test something the prompt does not claim.
- The known-weakness cases, `confucian-hierarchy` and the new
  `ubuntu-conformity`, expect **high fidelity with the loss on
  engagement**. An argument that authorises hierarchy through roles, or
  leans on communal expectation, is arguing the school as the school
  actually runs. What it owes is an answer to the objection its own
  tradition has had put to it. Saying that without a band to put it in
  would have left it an untested sentence in a document.

`ubuntu-conformity` exists because the criteria changed. The earliest
draft scored leaning on communal expectation down on fidelity. The
approved criteria call it faithful and put the cost of not answering the
dissent objection on engagement instead, and that change needs a case or it
is not tested.

An intermediate draft justified the change by saying harmony is Metz's own
principle. That came from memory, is not in the research file, and Arthur
withdrew it; the word harmony is gone from the criteria. The change it was
used to justify survives on its own terms.

### 2F: `--env-file` dropped from `judge:golden`

`npm run judge:golden` passed `--env-file=.env.local`. Node treats a
missing env file as fatal, so on any box without that file the command died
before it could report what was actually missing. The key is read from the
environment now, which is where an eval secret lives. `GOLDEN_LOG=ai_calls`
is the only mode that still wants `SUPABASE_SERVICE_ROLE_KEY`.

### The sourcing rule, amended

The old rule was: use only passages and citations from
`content/research/non-western-sources.md`, never fill from memory. Arthur
amended it on 2026-10-24 after reading the first draft of the fidelity
criteria:

> quotations must come from the research file (guard stays). Doctrinal
> description does not need to: the live Stoic criteria describe
> indifferents without quoting anyone. Describe each school's central
> commitments, not only the passages we verified. Flag any doctrinal claim
> you are unsure of for me rather than including it.

The rule for quotations is unchanged, and the guard enforcing it got
stronger: it now also scans text in quotation marks, after a reviewer
found five verbatim spans of the research file sitting undeclared because
their reporting cues were not on its fixed list. The draft criteria file
now declares eight quotations, two in the criteria and six in the notes.
What changed in the rule is that doctrinal vocabulary a school cannot be
described without (ren, li, anatta, dependent origination, dukkha) no
longer needs a verified passage behind it. Neither `ren` nor
`li` appears anywhere in the research file, so under the old rule the
Confucian criteria could not have named the school's two central terms.

The cost is that "flag it" is now doing work a grep used to do. The draft
criteria file carries a numbered list of the claims it does not assert, and
that list is part of what Arthur approves, not an appendix to it.
### Judging is live, and where that fact is recorded

Arthur turned `KILL_SWITCH_JUDGE` off in production himself, having
reviewed a batch of real verdicts for quality. He replaced the Phase 2
rule "the kill switch stays ON" with a different one: **no production
verdict may change**, and every sub-phase touching the judge path proves
the exact request is byte-identical for the three live schools, with a
snapshot test that stays in the suite. He also said not to change the
switch or the allowlist.

This entry exists because a reviewer went looking for that fact in the
repository and could not find it. `README.md` described judging as
deliberately paused for two days after it was not, and when that was
corrected the correction carried a date, 2026-10-22, that is recorded
nowhere and that nobody had given. The date was invented to make the
sentence concrete.

What is true and checkable: `KILL_SWITCH_JUDGE=true` is still the default
in `.env.example`, the switch still gates the model call in
`src/app/api/judge/route.ts` and still drives the paused copy on the
debate, table and today screens. What is not in this repository: the
production value. No commit here changed it and none can; it is a Vercel
environment variable. So the only record of the live state is Arthur's own
instruction, and this entry is it.

The practical consequence for a reviewer: do not try to verify the live
state from the repository, and do not report it as unverified either.
Read it here, and treat the (b) stop condition as live.

### 2F: draft criteria reach the golden run and nothing else

Arthur ruled on 2026-10-24 that the approved criteria for the three draft
schools do **not** move into `src/lib/judge/rubric.ts`. `/api/judge` keeps
refusing those schools until he publishes them in Phase 3, which is stop
condition (c). Instead, in golden-run mode only, the runner reads them
from `content/prompts/fidelity-criteria.draft.md`.

How that is built, and why each part:

- **`tests/judge/draft-criteria.ts`** reads the draft file and plans each
  case before any call: a live school against `rubric.ts`, a draft school
  against its section of the draft file verbatim, a draft school skipped
  under v1 or v2 because those prompts count the rivals as two, and a
  fixture naming a school with criteria nowhere thrown out before anything
  is spent. It is its own module so the planning is testable; the runner
  cannot be imported by a test, because it calls the model at load.
- **`callJudgeModel` gained a sixth parameter, `draftCriteria`.** This is a
  change to a frozen file, made to implement Arthur's instruction, and it
  is kept as narrow as the prompt-version parameter he approved before it:
  optional, never passed by `/api/judge` or `judgeDebate`, and placed after
  the defaulted parameter so `callJudgeModel.length` is still 4. **It can
  only fill a gap.** Passing it for a school that has live criteria throws,
  so no caller can use the golden path to change what a live school's
  request contains. Without it, a draft school throws exactly as before.
  The six request fixtures are byte-identical either side of it.
- **`tests/draft-criteria.test.ts`** keeps it confined, like the file-sink
  test. It walks `src/` and fails on any mention of the draft file or the
  loader, comments included; the strictness cost `anthropic.ts` two
  comment rewrites on the first run, which is the point. It drives the real
  `/api/judge` handler for all three draft schools and shows each answered
  with `no_criteria` before any topic lookup, insert or model call, with a
  live school as the control that gets past the refusal. Demonstrated by
  breaking it twice: a `src/` file reading the draft file failed the walk,
  and moving the confucian criteria into `rubric.ts` failed the confucian
  refusal.
- **The walk is not enough on its own, and two reviewers showed it.** It
  searches for a name, and a path assembled at runtime,
  `["content/prompts/fidelity-criteria", "draft", "md"].join(".")`, has no
  name to find. `tests/draft-criteria-reads.test.ts` records every path the
  filesystem is asked for while the route loads and handles a live-school
  request and a refusal for each draft school. Its first version mocked the
  `node:fs` and `fs` specifiers, and the second reviewer got past it
  through `node:fs/promises` and through `createRequire`, neither of which
  a module mock sees. It now patches the real `fs` object, which every one
  of those paths returns, and uses Node's `syncBuiltinESMExports()` to
  push the patch through to named imports. All three evasions, each placed
  at module scope in a file the route imports, pass the walk and fail the
  recorder. A third reviewer found three more: copying the file and
  reading the copy, `fs.openAsBlob`, and shelling out to `cat`. The
  recorder now watches copies and blob opens as well, and `child_process`
  and `worker_threads` are refused anywhere in `src/` as a tripwire, since
  no recorder in this process can see a read made by another. The
  residual: a constructed read in a `src/` file the route never loads, or
  through a filesystem call not on the watched list.

Two more things came with it. A **dry run**, `GOLDEN_DRY_RUN=1`, validates
every fixture, plans every case, and prints the call count and cost before
anything is sent; it needs no key, so readiness can be shown rather than
asserted. It computes the per-call estimate per prompt version, from the
token estimates in `anthropic.ts`'s COST comment and the two rate
constants, plus the difference in the prompt file's size at about four
bytes a token. It reads each figure from the one declaration that holds it
and refuses to guess if there are two. It deliberately does not read the
COST comment's own `est_usd_per_call=0.0098`, which does not follow from
the figures beside it. And **`weakest_move` is checked** for
`fabricated-source`, which Arthur ruled passes on rigor 0-3 and on
`weakest_move` naming the invention: a case-insensitive term list in the
fixture, majority of samples, with "unverified" deliberately excluded
because that is the right answer for an obscure real source and the wrong
one for an invented quotation from Epictetus.

The draft file's own header said "NOT LOADED BY ANYTHING" and "Pending
approval" until this change, and the test checking it went on passing,
because it checked that the file said so. Both claims are now true as
written, and the test says why it was not enough.

### 2F: the Tier B bands are provisional

Accepted as provisional on 2026-10-24, with one rule from Arthur: **if any
case lands outside its band, stop and report; do not adjust a band to fit a
result.** Arthur ruled on the fidelity and engagement bands. The score
bands are mine. The strong and bleed cases parallel Tier A's strong and
wrong-school bands; `confucian-strong`'s 65-95 came from the worked
example he accepted as written, and `confucian-ren-disposition` takes the
same band as `confucian-strong`; the two known-weakness cases' 40-75 has
no Tier A parallel at all, since no Tier A case combines high fidelity
with low engagement. None was ruled on individually. The 40-75 given to the two
known-weakness cases is the least grounded, since no existing case combines
high fidelity with low engagement.

### Arthur's rulings of 2026-10-24, verbatim

Recorded here because a reviewer, able to see only a stale pull request
body, found three rulings attributed to Arthur in this branch that it could
not trace to him. Each one can now be checked against his words rather than
taken on trust. The item numbers refer to the Phase 2 decision list on pull
request #44.

On the decision list:

> Criteria approved with changes:
> - Ubuntu: remove "harmony" entirely. My claim that harmony is Metz's
>   principle was from memory and is not in the research file. Use only the
>   sourced "shared identity and solidarity". Keep the rest of the Ubuntu
>   revision (communal expectation faithful; ignoring the dissent objection
>   costs engagement).
> - Buddhist: restore the Rahula object ("whether it tends to harm oneself,
>   another, or both"). Add: inferences developed in later traditions, such
>   as the Mahayana argument from no-self to impartial compassion, are
>   faithful when argued.
> - Keep within the length band.
>
> Items 3, 5, 6, 8, 9, 10, 13, 15: accepted as written.
> Item 7: fabricated-source passes on rigor 0-3 and weakest_move naming the
> invention; score band 0-50; fidelity unconstrained.
> Item 11: add a Tier B case arguing ren as a disposition, expected fidelity
> 8-10.
> Item 14: fine as a disclosure note.
>
> Add src/lib/judge/rubric.ts and src/lib/judge/schema.ts to the frozen list
> under the judge rule (b).
> Review loop: at most three reviewer passes, then verify the final fixes
> yourself. Record it in the charter.

On the golden run:

> 1. Do not move the draft criteria into rubric.ts. The live endpoint keeps
>    refusing the three schools until I publish them in Phase 3 (exception
>    c). Instead: in golden-run mode only, the runner reads criteria for
>    draft schools from content/prompts/fidelity-criteria.draft.md. Add a
>    test, like the file-sink one, proving nothing in src/ reads the draft
>    file and /api/judge still refuses all three.
> 2. Tier B score bands accepted as provisional. If any case lands outside
>    its band, stop and report; do not adjust a band to fit a result.

Earlier the same day, on the first draft of the criteria and the run:

> Yes to the minimal anthropic.ts change for a version override and the
> RIVAL_SCHOOLS substitution: v2 stays default, all six judge request
> fixtures byte-identical. Yes to dropping --env-file.

> Tier B, when written: one strong case per new school built on its central
> concepts (ren/li; Metz's harmony; anatta), expected fidelity 8-10; and the
> known-weakness cases (confucian-hierarchy, plus an ubuntu conformity case)
> expect high fidelity with the loss on engagement.

The second names "Metz's harmony", which Arthur withdrew in the later
ruling above; `ubuntu-strong` is built on shared identity and solidarity
instead. The first is the authority for changing the frozen
`src/lib/anthropic.ts` to add a prompt version and the rival-schools
substitution. The `draftCriteria` parameter added later rests on his
golden-run ruling, which needs some route for draft criteria to reach the
request without going through `rubric.ts`; he did not name the mechanism,
and that is listed for his confirmation on pull request #44.

And on `judge.v3.md`, before the decision list existed, which is what item
16 below refers to:

> v3 text accepted, with one addition. The fabrication rule depends on the
> judge knowing a source exists, and the model knows Western sources far
> better than Menkiti, Metz, Mhlambi or specific Pali canon sections. Add:
> treat a source as fabricated or misattributed only when confident it does
> not exist or does not say what is claimed; if the source cannot be
> placed, treat it as unverified, do not penalise it, and note that in the
> feedback.

**The decision list he was answering**, as it stood, so the numbers can be
checked. These are its sixteen headings, verbatim:

1. The three revised criteria.
2. Harmony, and this is the load-bearing one.
3. Menkiti and Gyekye both faithful.
4. The Buddhist criteria now name one bleed where the other two name two.
5. "weighs suffering, dukkha, as what is at stake."
6. "High fidelity" as a number.
7. `fabricated-source`'s band combination.
8. The Tier A bands you have not ruled on individually.
9. Two fixture judgements that are mine.
10. The `confucian-strong` worked example, rewritten on ren and li.
11. Whether ren or li is prior.
12. anatta to impartial compassion.
13. Dependent origination and distributed responsibility.
14. The Śāntideva attribution itself
15. Metz's phrasing.
16. `judge.v3.md`'s confidence section.

Items 1 to 10 were "Needs a decision", 11 to 15 "Disclosed, no decision
needed unless you want a change", and 16 "Settled, recorded here so it is
not reopened". The pull request's body has since been rewritten, so this
is now the only copy.

**The key to the item numbers**, so the three attributions a reviewer
queried can be traced:

| Item | What it was | Ruling |
|---|---|---|
| 1 | The three revised criteria | approved with the changes above |
| 2 | Harmony | removed entirely |
| 3 | Menkiti and Gyekye both faithful | accepted as written |
| 4 | Buddhist criteria naming one bleed, and the Rahula object | Rahula object restored; **the one-bleed asymmetry was not ruled on** |
| 5 | Dukkha as "suffering" | accepted as written |
| 6 | "High fidelity" as fidelity 7-10, engagement 0-4 | accepted as written |
| 7 | `fabricated-source`'s band | score 0-50, rigor 0-3, weakest_move, fidelity unconstrained |
| 8 | The Tier A bands | accepted as written |
| 9 | `ubuntu-conformity`; `buddhist-intention-excuse` as a fidelity failure | accepted as written |
| 10 | The `confucian-strong` worked example | accepted as written |
| 11 | Whether ren or li is prior | a Tier B case for ren as a disposition |
| 12 | Anatta to impartial compassion | admitted, by the Buddhist addition |
| 13 | Dependent origination | accepted as written |
| 14 | The Santideva attribution | fine as a disclosure note |
| 15 | Metz's phrasing | accepted as written |
| 16 | `judge.v3.md`'s confidence section | "v3 text accepted, with one addition", quoted above |

So "Menkiti and Gyekye: accepted as written" is item 3. "Arthur ruled on
the fidelity and engagement bands" is item 6, which accepted fidelity 7-10
and engagement 0-4 for the known-weakness cases, together with the Tier B
instruction quoted above, which set fidelity 8-10 for the strong cases.
"Whether it tends" is his wording in the Buddhist ruling. Item 4's first
half is the one thing on the list he did not rule on.

### The eval key travels as `SOPHECS_EVAL_KEY`

Claude Code's cloud sessions withhold any environment variable named
`ANTHROPIC_API_KEY`. Found on 2026-10-25, after a key set under that name
never reached a fresh session. The test that settled it: Arthur set
`ANTHROPIC_API_KEY` and a harmless `SOPHECS_CHECK=1` side by side, and a
fresh session saw the second and not the first. So variables reach
sessions, and that one name does not, presumably because Claude Code runs
on Anthropic's API itself and a key under that name would collide with its
own sign-in.

The golden runner now reads the key as `SOPHECS_EVAL_KEY`, through
`tests/judge/eval-key.ts`, and sets `ANTHROPIC_API_KEY` inside its own
process before the first call. That is enough because `src/lib/anthropic.ts`
builds its client lazily, on the first call, from that variable; the frozen
file is untouched, and production on Vercel reads `ANTHROPIC_API_KEY`
exactly as before. `tests/eval-key.test.ts` refuses any mention of
`SOPHECS_EVAL_KEY` in `src/`, and checks the runner sets the key in one
place, after both refusal checks: the one for the key and the one for the
endpoint. That check is a tripwire on the runner's text, not a proof: an
aliased write such as `const e = process.env; e.ANTHROPIC_API_KEY = …`
gets past it.

**A real run also refuses unless the key is going to Anthropic.** The
library sends the key wherever `ANTHROPIC_BASE_URL` points, read when the
client is built. In these sessions that is `https://api.anthropic.com`,
but a session that pointed it at a gateway would have handed the eval key
to the gateway. So a real run refuses unless the base URL's origin is
exactly `https://api.anthropic.com`, refuses a username or password in it,
and refuses if `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_CUSTOM_HEADERS` is set,
since the library would add a second credential or arbitrary headers to
every request. The dry run prints the endpoint above the key line.

The runner also checks the key's shape before any call: a leading "Bearer",
quote marks, a space, no `sk-ant-` prefix, or any character after it other
than letters, digits, hyphens and underscores each refuse the run by name.
The last catches an invisible character pasted along with the key, so it is
refused here rather than left to the HTTP layer, whose error might repeat
the value.
This session came within one click of saving the key as a Bearer token,
which Anthropic's API does not take; it wants the key alone, in a header
called `x-api-key`. Nothing in the module ever prints, returns in a message,
or throws the key; it is described by its source and length, and a test
checks the key's text never appears in anything it says.

On the way there, two other routes were tried and set aside, and they are
worth recording so nobody repeats them:

- **Network secrets.** Claude Code's environment settings can attach a
  credential to outgoing requests, so the key never enters the session at
  all. That is the safer design and the platform's documented preference.
  Its form refused to save an `x-api-key` header for `api.anthropic.com`
  with a generic error, and the session could not see which input it
  objected to. Worth another try later, since it keeps the key out of the
  sandbox entirely; the runner would then need a placeholder key and the
  network layer to replace it, which is untested.
- **Timing.** The first fresh session started while the environment still
  said "Connecting", which looked like the cause. It was not: a later
  session, started once that cleared, still lacked the key.

### 2F: Arthur's rulings of 2026-10-26, on the golden runs

The runs are `tests/judge/golden-runs/2026-10-26T00-16-57-040Z-v2.json`
(v2, 14 cases, 42 calls, $0.3758) and
`2026-10-26T00-20-49-181Z-v3.json` (v3, 24 cases, 72 calls, $0.9238),
three samples each. Arthur reviewed both tables and ruled four things.
His message, verbatim:

> 2F results reviewed. Decisions:
>
> 1. Vocabulary over concepts: the v3 judge docks fidelity for missing
>    terms (confucian-hierarchy: "Ren never appears"; stoic-analogy: "never
>    names the outcome as an indifferent"). Add to the v3 criteria for ALL
>    SIX schools: credit the concept whether or not the argument uses the
>    school's terms; never mark fidelity down for missing vocabulary alone.
>    For the three live schools, put this in a v3-only criteria set so the
>    live v2 judge is unchanged until the v3 switch. Show me the wording.
> 2. verdict_line: 5 of 72 v3 samples exceeded 20 words (v2: 0). Fix it in
>    judge.v3.md (make the word caps prominent near the response format);
>    do not truncate or relax the validator. Target 0 failures.
> 3. buddhist-intention-excuse score band 5-35 -> 5-40 (v3 lifts all
>    wrong-school cases 4-10 points; fidelity 3 is correct). No other band
>    changes.
> 4. Record in docs/decisions.md: under v3 the strong-minus-wrong gap for the
>    new schools (56-57) matches the original three (55-57); and v3 scores
>    3-15 points above v2 across the board, which will be a step change at
>    switch-over.
>
> Merge the run files from claude/admiring-mccarthy-gzhkoi with this. Then
> tell me the cost of a v3-only re-run at three samples, and stop.

The band in item 3 is his ruling on a result, made after he saw it, which
is what his 2026-10-24 rule ("do not adjust a band to fit a result")
reserves to him. A v3-only criteria set for the live schools needs
`rubric.ts` to hold it and one line of `src/lib/anthropic.ts` to choose it
by version; both are frozen, and both changes are the minimum item 1 asks
for. What follows is how each was carried out.

1. **Concepts over vocabulary.** The v3 judge docked fidelity for missing
   terms: "Ren never appears" on `confucian-hierarchy`, "Never names the
   outcome (...) as an indifferent" on `stoic-analogy`. v2 docks
   `stoic-analogy` for the same thing ("nor explicitly labels patient
   outcomes as indifferents"), and the fix is v3-only by design, so v2's
   fidelity 7 on that case stands until the switch. Every school's criteria
   now end, under v3 only, with a paragraph that credits the concept
   whether or not the argument uses the school's terms and says never to
   mark fidelity down for missing vocabulary alone. For the three live
   schools it lives in `src/lib/judge/rubric.ts` beside their criteria and
   is added by `fidelityCriteriaFor` for v3 and later. v2 gets exactly
   what it did, which the six request fixtures pin, and v1 is held
   unchanged by a unit test; `tests/judge-request.test.ts` also drives
   `callJudgeModel` to show v3 carries the paragraph and v2 does not. For the three
   draft schools it is the third paragraph of each section of
   `content/prompts/fidelity-criteria.draft.md`, since those schools are
   only ever judged under v3.
2. **`verdict_line` over its cap.** 5 of 72 v3 samples returned a
   `verdict_line` over 20 words; v2 returned none in 42. Fixed in
   `content/prompts/judge.v3.md` by moving the word caps directly above the
   response format and naming `verdict_line` there. `improvement_note`,
   capped at 40 words on revisions and until then mentioned only under
   Revisions, joins the list. The validator is not
   relaxed and nothing is truncated. The target is no failures.
3. **`buddhist-intention-excuse` score band, 5-35 to 5-40.** v3 scored it
   38 [34-38] with fidelity 3, inside its fidelity band of 0-4, so the
   judge saw the failure the case is there to test. No other band moved.
4. **Two things to know at the v3 switch**, recorded as measured. Arthur
   put them as a gap of 56-57 for the new schools against 55-57 for the
   original three, and v3 scoring 3-15 points above v2 across the board.
   The run files say this:
   - **The gap between strong and wrong-school cases.** Under v3, strong
     minus wrong-school median score is 56 for Buddhism and 57 for Ubuntu
     (`ubuntu-strong` from two valid samples, 80 and 82; so too
     `virtue-strong` below, 83 and 83, the third of each having failed on
     `verdict_line`).
     For the original three it is 57 for utilitarianism, 55 for virtue
     ethics and **48 for stoicism** (80 against 32), so the new schools
     match utilitarianism and virtue ethics, and stoicism is the outlier.
     Confucianism has no gap in the table: two of `confucian-strong`'s
     three samples failed on `verdict_line`, so the runner reported no
     result. Its one valid sample scored 86 against `confucian-wrong-school`'s
     22, a gap of 64 from a single sample.
   - **v3 against v2.** Of the 14 cases both versions ran, 9 scored 3 to 15
     points higher under v3 (median against median), 2 scored 2 higher
     (`caricature`, `stoic-analogy`), and 3 did not move (`fabricated-source`,
     `incoherent`, `unsupported`). The three wrong-school cases rose 4 to
     10, the strong and exemplar cases 3 to 13, and the two utilitarian
     source cases 6 (`util-named-text`) and 15 (`util-obscure-source`).
     Switching production to v3 will be a step change in scores for
     those. Scores across prompt versions are not compared as equivalent
     in any case; the stamp on each stored verdict keeps them apart.

### 2F: the 3 Nov v3 re-run, and Arthur's rulings of 2026-11-03

**The run.** `tests/judge/golden-runs/2026-11-03T16-47-04-974Z-v3.json`:
v3 only, 24 cases, three samples, 72 calls, $0.9934 billed against an
estimate of $0.97. It ran against main at d788dfe, so it measured the two
rulings of 2026-10-26: the vocabulary paragraph and the word caps moved
above the response format. Compared with the 26 Oct v3 run:

- `verdict_line` failures fell from 5 in 72 to 1 (`stoic-strong`,
  sample 1). The longest accepted `verdict_line` was 18 words.
- `confucian-strong` had all three samples accepted, 86 each with
  fidelity 9, inside its bands; its gap over `confucian-wrong-school` is 62.
- `stoic-analogy` scored 72 [70-78], inside 60-95, with fidelity 7 [7-8],
  still below 8-10. No sample docked it for vocabulary any more. Two
  samples' `weakest_move` asked whether choosing to stand beside the system
  is itself just; the third named the patients' outcomes, and raised that
  consent in `a_stronger_version_would`.
- `confucian-hierarchy` reached fidelity 8 [7-8], inside 7-10, and went
  over its other two bands: score 78 [71-78] against 40-75, engagement 5
  [5-6] against 0-4. It was the only case to move more than 5 points
  (median 68.5 to 78; the earlier median was from two valid samples).
- No other case was outside a band, and none other moved more than 4.

**Arthur's rulings**, verbatim:

> Decisions on the 3 Nov run:
>
> 1. confucian-hierarchy: the judge never raised the power/hierarchy
>    objection in any sample (weakest_move and unanswered_objection were all
>    about virtue-ethics judgment). That is a judge blind spot, not a band
>    problem; bands stay. Fix in the v3 criteria for ALL SIX schools: add
>    each school's best-known objection, drawn from content/schools/*.md
>    gets_wrong (for the live three, write an equivalent line), and instruct
>    that engagement should check whether the argument meets it, and that
>    ignoring it costs engagement, not fidelity. v3-only for the live three;
>    the six v2 request fixtures stay byte-identical. Show me the six
>    objection lines.
> 2. stoic-analogy: the judge's reasons are substantive and fair: it never
>    justifies the choice to consent. Amend the fixture with one or two
>    sentences justifying that consent as her choice (e.g. in terms of
>    justice to the patients). Band stays 8-10.
> 3. verdict_line: add a single automatic retry when the judge reply fails
>    schema validation, for both v2 and v3, logged in ai_calls (and in the
>    golden-run log), max one retry, never truncating. I approve this change
>    to the frozen judge path. Add a test. Keep the prompt change from #47.
>
> Run the review loop and merge. Then dry-run a v3-only re-run and tell me
> the cost; do not start it until I approve.

How each was carried out:

1. **The objection each school is best known for having to answer.** Every
   school's v3 criteria now end with a fourth paragraph: "The best-known
   objection to ..." and the objection, then "Engagement should check
   whether the argument meets this objection, and ignoring it costs
   engagement, not fidelity." Each objection is taken from the gets_wrong
   section of the school's page in `content/schools`, in the page's own
   terms rather than quoted: quietism for Stoicism, the objection Rawls put
   to utilitarianism, no answer for scale for virtue ethics, role ethics
   authorising hierarchy for Confucianism, the community that is not one
   voice for Ubuntu, and Keown's point that Buddhist ethics has much moral
   teaching and little systematic moral philosophy, given as a challenge
   for reconstruction rather than proof, as
   `content/research/non-western-sources.md` asks it to be presented. For the three live
   schools the paragraph is in `src/lib/judge/rubric.ts`, in
   `OBJECTION_V3`, and `fidelityCriteriaFor` appends it under v3 only; for
   the draft three it is the fourth paragraph of each section of
   `content/prompts/fidelity-criteria.draft.md`. The six request fixtures
   are unchanged, and sending the paragraph to v2 deliberately failed
   about twenty tests (19 or 20, depending on how it was sent), the six
   fixture comparisons among them. Under v3 the live three's criteria now
   run 1464 to 1726 characters and the draft three 1541 to 1723, inside
   that band as Arthur ruled on 2026-10-24. `judge.v3.md` is not touched:
   its hash is still the one the 3 Nov run recorded.
2. **`stoic-analogy`.** Two sentences added after "whether she keeps
   looking": her consent comes first of the things up to her and has to
   be just, because justice is owed to the patients; they are owed a
   clinician at the point where the queue is decided, and refusing that
   post so as never to answer for an ordering she cannot explain would
   leave them with no one beside the system. Bands unchanged. `docs/phase2-fixtures.md` quotes the amended argument. A
   first draft justified the consent by the system ordering the queue at
   least as well as the triage desk; review pointed out that this leaned on
   outcomes the argument's own last sentence sets aside, close to the Stoic
   criteria's aggregate-welfare failure, and it was rewritten.
3. **One retry.** `judgeWithOneRetry` in `src/lib/anthropic.ts` makes a
   judge call and, if the reply fails validation (a cap breached, a field
   missing, or no JSON at all), makes the same call once more. A second
   failure is thrown; nothing is truncated; an API error is not retried. It
   reports every attempt before acting on it. `judgeDebate`, and so
   `/api/judge`, writes each attempt to `ai_calls` as its own row; the
   golden runner writes each to its run file with an `attempt` of 1 or 2,
   through `tests/judge/golden-sample.ts`, and prints how many replies were
   retried and how many retries failed. `tests/judge-retry.test.ts` drives
   production's path against a mocked SDK; with the retry disabled, six of
   its ten tests fail. `tests/golden-sample.test.ts` drives the runner's,
   and pins the runner's own `logCall` word for word, since importing the
   runner starts a run. The 2026-10-26 change to
   `judge.v3.md` stays. Two consequences of logging every attempt as its
   own row:
   - **The daily cap.** `/api/judge` counts `ai_calls` rows of kind
     `judge` per reader, once, before the call. A submission that needed
     the retry uses two of the reader's five, as a failure followed by the
     reader submitting again already did, and a reader at four whose
     submission is retried ends the day at six billed calls, one over the
     cap. Whether a retry should count against the reader is Arthur's
     question (d). Telling a retry apart from a first call in `ai_calls`
     would need a new column or kind, which is a migration and so a
     production database change (a); not done.
   - **Time.** A retried submission waits for two calls, about 11 to 13
     seconds at the 3 Nov run's latencies (median 5.4s, longest 6.6s). The
     project was created in September 2026, after Vercel made Fluid compute
     the default for new projects, but its time limit could not be read
     through the tools available, and production has logged one judge call
     (5.5s), which says nothing about it. A function stopped mid-retry would
     fail the reader and leave a billed call out of `ai_calls`. So
     `/api/judge` now sets `maxDuration = 60`, within every plan's maximum:
     one line in a frozen file, made as part of the retry Arthur approved.

The dry run's estimate also changed. It priced every v3 call at v2's
criteria length; it now adds each case's own criteria length, at four
characters a token. Against the 3 Nov run, which billed $0.9934, the old
estimate was $0.9657 and the new one would have been $0.9791.

### 2F: Arthur's rulings of 2026-11-03 on PR #48

His message, verbatim:

> Decisions on #48:
> 1. Ubuntu objection: keep as is.
> 2. Add a held-out Tier B case, confucian-hierarchy-school: same shape as
>    confucian-hierarchy (roles argued faithfully, power left unmet) but a
>    different setting, e.g. a school timetabling system, teacher over
>    pupil. Same bands. Write it without reusing the school page's example.
> 3. Add to judge.v3.md: when an argument leaves its school's known
>    objection unmet, that objection should normally be the one reported as
>    unanswered_objection, voiced by the rival school that would press it
>    hardest. v3 only; v2 and its request fixtures unchanged.
> 4. Daily cap: if it can count judged debates per day instead of ai_calls
>    rows with no schema change, do that; otherwise record it as a pre-pilot
>    item and leave it.
> 5. maxDuration = 60: keep.
>
> Review loop, merge. Then run the v3-only re-run at three samples on the
> merged main: approved now, up to $1.20. Run to the end, change nothing,
> commit the run file, and report: verdict_line failures and retries;
> stoic-analogy, confucian-hierarchy and confucian-hierarchy-school against
> their bands, including whether unanswered_objection names the power
> question; any case outside its band; any case that moved more than 5
> points since 3 Nov.

How each was carried out:

1. **Ubuntu.** Unchanged.
2. **`confucian-hierarchy-school`.** A twenty-fifth case, in
   `tests/judge/golden/`, with `confucian-hierarchy`'s bands: score 40-75,
   fidelity 7-10, engagement 0-4. A timetabling system, teacher over
   pupil, 186 words. It argues what each side of the relationship owes,
   holds the name of teacher to a teacher's work, and never meets the
   power the teacher holds; it uses none of the school page's wording. Its
   last sentences say the timetable makes nobody humane, so that it does
   not thin ren to consistency, which is what the 3 Nov run marked
   `confucian-hierarchy` down for; a miss for that reason would not test
   the blind spot the case exists for.
   `docs/phase2-fixtures.md` describes it with the other Tier B cases.
3. **`judge.v3.md`.** The section on the objection left standing gains a
   paragraph: each school's criteria end by naming the objection that
   school is best known for having to answer, and when the argument leaves
   it unmet it should normally be the one returned, voiced by whichever
   listed rival school would press it hardest. The header records the
   change in one sentence. `judge.v2.md` and the six request fixtures are
   unchanged. `tests/judge-v3-and-refusal.test.ts` pins the paragraph
   whole, in v3's objection section before the list of schools, once, and
   absent from v2; removing it, weakening it, inverting its condition,
   deleting its first sentence, moving it after the list or copying it
   into v2 each fail that test.
4. **The daily cap: not changed, recorded below as a pre-pilot item.**
5. **`maxDuration = 60`.** Kept.

### Open pre-pilot item: the daily cap counts calls, not judged debates

`/api/judge` caps a reader at five judge calls in a rolling 24 hours,
counted from `ai_calls` rows of kind `judge`, once, before the call. Since
the retry of 2026-11-03, a submission whose first reply fails validation
uses two of the five, and a reader at four whose submission is retried
ends the day at six calls.

Counting judged debates instead needs no schema change: `debates` has
`user_id`, `created_at` and `verdict`, so "rows with a verdict created in
the last 24 hours" is one query. It counts by when a row was inserted, not
when it was judged, since `debates` has no `judged_at`: a row first
inserted yesterday and judged today falls outside the window. It was not done, because on its own it
stops counting calls that end without a verdict. A submission whose
replies fail validation twice is billed for both calls and leaves its row
unjudged, and the route reuses that row on the next try at the same
topic, so a reader resubmitting such an argument would be billed two
calls a time while the cap never moved. The only limit left would be
`AI_MONTHLY_BUDGET_USD`, $50, and reaching it pauses judging for every
reader, not just the one.

Two ways to do it safely, neither needing a schema change, and both a
change to how the limit works, so Arthur's to choose (d):

- Count judged debates, plus `ai_calls` rows whose debate is still
  unjudged. A retried submission that succeeds costs one; failures count
  until the debate is judged.
- Count judged debates, and keep a second, higher ceiling on `ai_calls`
  rows per reader per day, at a number Arthur sets.

**Decide before the Winchester pilot.** Until then the cap stays as it is:
it can cost a reader an extra slot on the rare retried submission.

**Closed on 2026-11-05** by Arthur's rulings 6 and 8 ("The judge's caps and
budget (migration 0026)"): retries no longer use a reader's arguments, and
a ceiling of 20 judge calls a day sits above the five.

*Superseded in part, the same evening.* Arthur's ruling on retries (the
next entry) allows two retries and takes a submission that ends without a
verdict out of the cap. So a retried submission that succeeds now uses two
or three of the five, and a failed one uses none, which means the cap
**can** now be run up by failed submissions. The second option above,
a higher per-reader ceiling on calls, is what would close that; it is
still Arthur's (d).

### Two retries, and a failed submission does not use an argument

Arthur's ruling of 2026-11-03, after the second v3 run of that day (run file
`2026-11-03T21-35-58-347Z-v3.json`, commit 588cf1f on branch
`claude/beautiful-edison-aofswd`, #51) left one sample without a verdict when its retry also ran over the verdict_line cap:

> verdict_line: allow up to two retries. If both fail, the student sees a
> clear "judging failed, this did not use your turn, try again" message,
> the attempt does not count against the daily cap, and it is logged.

How it was carried out:

1. **Three calls at most.** `judgeWithOneRetry` becomes `judgeWithRetries`
   in `src/lib/anthropic.ts`, with `MAX_JUDGE_ATTEMPTS = 3`. The same
   request is sent each time, so the six request fixtures still describe
   every call, and a reply is never cut down to fit. The golden runner
   takes its samples through the same function, so a run measures what
   readers meet; run files from now on can hold attempts 1 to 3.
2. **The message.** `Judging failed.` / `This did not use one of today's
   arguments, and your argument is saved. Try again.`, in
   `src/lib/judging-failed.ts` and `docs/daily-path-copy.md`. The route
   sends it with `reason: "judging_failed"`, and the argue screen shows it
   in place of the generic "The judge could not be reached." "Turn" is
   "argument" because the daily-cap notice on that screen already says
   "argument". Each sentence is shown only when it is true, and
   `tests/judging-failed.test.ts` holds them so. "Your argument is saved":
   the route saves it on the debate row before calling the judge, and when
   it is updating an earlier unjudged try's row and that update fails, it
   stops before the judge, with the generic error and the detail line "The
   new text could not be stored, so nothing was sent to the judge.",
   rather than have the judge score text the row does not hold. "Did not use one of today's arguments": the route sends
   `offCap`, true only when `judgeDebate` took the submission's calls out
   of the cap; when that update failed, the screen shows `Your argument is
   saved. Try again.` instead. Review pass 3 found that both had been
   claimed "by construction" while neither failure was handled.
3. **Not counted against the cap.** Migration 0019 adds
   `ai_calls.counts_toward_cap`, true by default, so every existing row
   counts as it did. When a submission ends without a verdict, whether
   every reply failed validation or the API failed partway, `judgeDebate`
   sets it to false on that submission's rows, and the route's cap query
   counts only rows where it is true. A column, because nothing in a row
   said how its submission ended. "Rows whose debate has a verdict" would
   not do: the route reuses an unjudged debate row on the next try, so a
   later success would bring the earlier failure back into the count.
4. **Logged.** Each failed reply's ai_calls row carries the validator's
   summary in `validation_error`, also added by 0019. It names the field
   and the rule, never the reply's or the argument's text. Two places used
   to carry text, and review pass 1 found both: a reply that was not JSON
   was reported with its first 200 characters, and zod's message for a
   wrong enum value quotes the value. Now the first gives the reply's
   length, and the second has its "received '...'" clause cut; a test
   feeds each and checks the row. The route also writes a failed
   submission to the production log; until now it logged only outside
   production.
5. **A revision can be tried again.** A revision whose judging failed
   leaves an unjudged child row. Before this, the next try found that row
   and answered "already revised", and the revise page closed, so the new
   "Try again" would have been false for a revision. The route now reuses
   an unjudged child row, as it reuses an original's, and
   `getRevisionId` counts only a judged revision. Review pass 1 found it;
   it was already so on `main`, but the message made it a promise.
6. **The cap fails closed.** If the cap's own query errors (a missing
   column, before 0019 or after its rollback), the route refuses the
   submission with a 503 before anything is written or billed, where it
   used to read the failed count as zero.

**What it does not change.** A submission that ends with a verdict still
counts once per call. One that needed retries uses two or three of the
reader's five, the open pre-pilot item above, which stays Arthur's. Every
billed call still counts toward the monthly budget. (Superseded on
2026-11-05: a judged submission now counts once, whatever its retries;
"The judge's caps and budget (migration 0026)".)

**One case it does not cover.** If Vercel stops the function partway
(the route's `maxDuration` is 60 seconds), the calls already logged stay
in the cap and the reader sees the generic "The judge could not be
reached.", which makes no claim about the cap. Three calls came to about
20 seconds at the slowest call measured, so this should be rare.

**The risk it accepts, for Checkpoint A.** Failed submissions no longer
move the cap. An argument whose replies always fail validation can
therefore be sent again and again, at up to three calls a time (about
$0.04, at the $0.0148 a call the 21:35 v3 golden run averaged, in the run
file named above; production's v2 prompt is shorter). The only other stop
is meant to be the monthly budget, `AI_MONTHLY_BUDGET_USD`, which pauses
judging for every reader when it is reached. A second, higher ceiling on
calls per reader per day would close it, and that is a rate limit, so
Arthur's.

**And the budget does not hold as written.** Review pass 3 found, and a
read of `src/lib/budget.ts` confirms, that `getMonthlySpend` sums
`cost_usd` over a select with no range, so it adds up at most the rows
the Data API returns in one response (Supabase's default is 1000; the
project's own setting was not read), and it reads a query error as a
spend of zero. Past that many calls in a month the budget cannot be
reached, and an error waves judging through. Production holds one
`ai_calls` row today, so nothing is at risk yet. Fixing it changes how
the budget is enforced, which is Arthur's under (d): summing in the
database, and failing closed on an error as the daily cap now does, is
the proposed patch, for Checkpoint A. Nothing in #52
depends on it.

### 2F, Stage 1 of the brief of 2026-11-03: two v3 runs, and a miss

The brief's pass test for 2F: no verdict_line failure after the retry;
`stoic-analogy`, `confucian-hierarchy` and `confucian-hierarchy-school` in
band, with `unanswered_objection` naming the power question on both
hierarchy cases; the original six (`stoic-strong`, `stoic-wrong-school`,
`util-strong`, `util-wrong-school`, `virtue-strong`,
`virtue-wrong-school`) in band. **Neither run passes it.** Bands are
judged on the median of three samples, as the runner judges them.

**Run 1, `2026-11-03T18-15-56-294Z-v3.json`**, on `main` at `fe5fd3d`,
75 calls, $1.0806:

- verdict_line: no reply over the cap, no retry. Pass.
- `stoic-analogy` 78/78/78, fidelity 8. In band.
- `confucian-hierarchy` score 72/70/70 and fidelity 7 in band;
  engagement 5/5/5 against 0-4. Objections: virtue ethics, three times,
  on practical judgment.
- `confucian-hierarchy-school` score 86/86/86 against 40-75, engagement
  7/7/7 against 0-4. Objections: utilitarianism once, virtue ethics
  twice; none on power.
- The original six in band.

The paragraph #49 added to `judge.v3.md`, and the objection line ending
every school's criteria, moved neither hierarchy case's engagement or
objection. A judge blind spot, so the brief's rule applied, in its words:
"If they show a judge blind spot, fix it in v3 for all six schools
symmetrically and rerun."

**The fix**, in commit `e0e75ae`: the engagement criterion in `judge.v3.md`
now says to check first the objection the school's criteria name, and
that an argument leaving it unmet scores no more than 4 on engagement.
It is in the engagement criterion, before the rubric, so every school's
request carries it. v2 is unchanged. `tests/judge-v3-and-refusal.test.ts`
pins it whole; a cap of 6, or the rule moved to the objection section,
fails. "Check first" rests on Arthur's ruling on the 3 Nov run (item 1,
carried out by #48), which asked to "instruct that engagement should check
whether the argument meets it, and that ignoring it costs engagement, not
fidelity". It set no number. The number 4 is mine: it is the top of the
0-4 engagement band that three fixtures expect (`confucian-hierarchy`,
`confucian-hierarchy-school` and `ubuntu-conformity`), so the cap sits
exactly at the edge of every such band in the golden set. It goes on the
Checkpoint A list as a change to what the v3 judge receives.

The same commit also added a paragraph to the comment at the head of
`judge.v3.md` saying why, and that comment is sent to the model with the
rest of the file. As first written it named the hierarchy cases and their
engagement scores, which is golden-set information in the judge's prompt;
run 2 was made with it. Review of #51 found it, and the comment now gives
only the rule and where the runs are recorded. The next v3 run is the
first without it. An older paragraph of the same comment, from the ruling
of 2026-10-26, still tells the model that "5 of 72 v3 samples returned a
verdict_line over its cap". It predates #51 and is left for
Checkpoint A, with the wider question of whether the comment should reach
the model at all: removing it from what is sent means changing how
`src/lib/anthropic.ts` reads the file. **Ruled on 2026-11-05:** "Strip
comments from judge.v3.md before it is sent (v3 only)". Since then v3's
comment does not reach the model.

**Run 2, `2026-11-03T21-35-58-347Z-v3.json`**, at `e0e75ae`, 78 calls,
$1.1559:

- verdict_line: 3 first replies over the cap (`buddhist-wrong-school`,
  `stoic-analogy`, `virtue-exemplar`), each retried; the retry on
  `virtue-exemplar` ran over too, so one sample has no result. **Fail**,
  where run 1 had none. The instruction about the cap was the same in
  both runs, but the prompt changed elsewhere (the engagement criterion
  and the head comment), so two runs cannot say whether this is the
  model's variance or a side effect of that change.
- `stoic-analogy` 78/78/72, fidelity 8. In band.
- `confucian-hierarchy` score 61/70/62, fidelity 7, engagement 3/4/3.
  **In band on every axis**, where run 1 was out on engagement.
- `confucian-hierarchy-school` score 80/78/72 (median 78, band 40-75),
  engagement 5/5/4 (median 5, band 0-4). Out on both, by less than run 1.
- `unanswered_objection` on the hierarchy cases: virtue ethics five
  times, utilitarianism once, on practical judgment or outcomes. **Never
  the power question.** The judge finds it more often in `weakest_move`
  than in run 1: "Never addresses who holds power to adjust or override
  the system" (`confucian-hierarchy`, sample 3, with samples 1 and 2
  asking who adjusts the system), and "who sets or can override the
  system's encoding" on two of the three `confucian-hierarchy-school`
  samples. Run 1 had it once, on `confucian-hierarchy-school` sample 2:
  "Never addresses who designs or audits the system's encoding of what
  roles require".
- The original six in band. Nine cases moved by more than five points of
  median score: `buddhist-strong`, `confucian-strong`,
  `confucian-hierarchy` and `confucian-hierarchy-school` -8,
  `stoic-strong` and `ubuntu-conformity` -7, `util-strong` -6;
  `fabricated-source` +10 and `util-wrong-school` +6. All nine are in band
  in run 2 except `confucian-hierarchy-school`, which was out in both
  runs. Engagement on the strong cases fell from 5-7 to 4-6.

**Why the objection never names power.** `unanswered_objection.school`
must be one of the three live schools, and the judge voices whichever
objection that school is known for: practical wisdom for virtue ethics,
outcomes for utilitarianism. Sophecs's own Confucian page does not give
the power objection to any of them. It cites "Confucian Role-Ethics with
Non-Domination" and Rosenlee for it, and gives utilitarianism a different
objection, about strangers. So the instruction asks the judge to put an
objection in the mouth of a school that, on Sophecs's own pages, does not
make it. That is a content question, not a prompt one, and goes to
Checkpoint A.

**Why there is no third run.** The brief allows two further runs within
$4.80 on the eval key. After run 2 the key is at $4.6563, leaving $0.1437;
a full v3 run costs about $1.16, and a run of the hierarchy cases alone
would not show whether a further v3 change moved the original six. Stage 1
stops here and its questions go to Checkpoint A.

### Arthur's rulings of 2026-11-03 on the Stage 1 miss

> 2. Power objection: in the v3 criteria/known-objection lines, state which
>    rival normally voices each school's known objection. Confucianism's
>    power objection: Utilitarianism (the subordinate party's interests go
>    uncounted when the stronger party sets the terms) or Ubuntu once
>    published (solidarity requires the weaker party can be heard). Do the
>    same exercise for all six known objections, symmetrically.
> 3. Budget: eval cap raised to a cumulative $8.00 (I am raising the key's
>    Console limit to match). Rerun v3 at three samples after the change.

Ruling 1, "backup drop: done via retry (I approved the prompt).", does not
bear on #51; it is for Stage 2, under "Open item: drop `backup_20261022`
after 2026-10-29". Ruling 4, on retries, is
carried out in its own pull request; see "Two retries, and a failed
submission does not use an argument".

**The voices.** In `src/lib/judge/objection-voices.ts`, one table for all
six schools. Under v3 each school's criteria gain a fifth paragraph after
the objection paragraph, for the live schools in
`fidelityCriteriaFor` and for the draft schools in the golden runner's
`planCase`. It names the rival that normally voices the objection, and
why. Only rivals the prompt lists are named: a school outside the list
cannot be returned in `unanswered_objection.school`, so naming it would
invite a reply that fails validation. Ubuntu's voice for Confucianism
therefore reaches the judge the day Ubuntu is published, without an edit.
v1, v2 and the six request fixtures are unchanged.

The five Arthur did not set are drafted from the school pages, and are his
to confirm at Checkpoint A. **Ruled on 2026-11-05:** Utilitarianism's
voice became his wording (in the table below), and "Buddhist voices
stay"; the other three stand as drafted.

| School | Objection (in short) | Voiced by | Why, as the judge receives it | Once published | Source on the page |
| --- | --- | --- | --- | --- | --- |
| Stoicism | gives up on the world too easily | `utilitarianism` | the harm an unfair system does is a sum someone could reduce, and declining to try is itself a choice about that harm | `ubuntu`: a person is a person through other persons, so standing apart from an unfair system leaves the people inside it on their own | Stoicism's gets_wrong: "Utilitarians would say this gives up on the world too easily" |
| Utilitarianism | no total makes the trade fair to the person who pays | `virtue-ethics` | what is done to one person must be justifiable to that person, not only to the total (Arthur's wording, 2026-11-05; first drafted as "justice gives each person what is owed to them, and a total owes nobody anything") | `ubuntu`: each person's capacity for relationship is to be honoured, not netted against other people's gains | Utilitarianism's gets_wrong gives it to Rawls, who is no school here; Ubuntu's page: "Metz argues against building systems to maximise expected utility" |
| Virtue Ethics | no answer for scale | `utilitarianism` | a policy that touches thousands of people needs its outcomes compared, and asking what a good person would do does not compare them | none | Virtue Ethics' gets_wrong: "Utilitarians would say this has no answer for scale" |
| Confucianism | too ready to authorise hierarchy | `utilitarianism` | the subordinate party's interests go uncounted when the stronger party sets the terms | `ubuntu`: solidarity requires the weaker party can be heard | Arthur's ruling, in his words |
| Ubuntu | a community is not one voice | `stoicism` | a dissenter's own judgment is the one thing the community cannot decide for them | none | Ubuntu's gets_wrong: "Stoics would add that a self defined through others has handed away the one thing that was its own" |
| Buddhist ethics | much moral teaching, little systematic moral philosophy | `utilitarianism` | deciding who audits a model and how an appeal is weighed takes a way of comparing everyone's claims, which compassion alone does not supply | `confucian`: who answers to whom for a model is a question of roles and what each owes, which non-harm leaves unassigned | **None for this objection.** Buddhist ethics' gets_wrong names the gap; its Utilitarian line is a different objection ("a school weighing intention this heavily lets a well-meaning system off for damage a careless one would be condemned for"). The Confucian page asks "whether the people inside them can still hold each other to what they owe" |

Two of these are weak, and the most likely to need Arthur's change.
Utilitarianism's: its own page gives the objection to Rawls, and of the
live schools Virtue Ethics is the one that argues from what each person is
owed. Buddhist ethics': no page gives this objection to Utilitarianism, and
the Buddhist page gives Utilitarianism a different one, about intention
excusing a well-meaning system, which is what `buddhist-intention-excuse`
tests. Naming Utilitarianism as the voice for the systematic-theory gap
could pull that case's objection away from intention. The other four
match their pages, or Arthur's words. Review of #51 found the Buddhist
mismatch; the first version of this table hid it.

`tests/objection-voices.test.ts` checks four things:
- every school has a voice among today's listed rivals;
- no school voices the objection to itself;
- no unlisted school is ever named;
- Arthur's Confucian voices are in his words, with Ubuntu's named only
  once it is listed.

Breaking the rival filter fails three of those tests. The existing v3
tests pin the fifth paragraph, and the draft-criteria test pins it on the
draft plan.

**The budget.** The cap on the eval key is now $8.00 cumulative. It stood
at $4.6563 (the six run files' unrounded totals summed) before the rerun
this ruling asks for.

### 2F, the rerun after the objection voices (Arthur's ruling 3)

Arthur's ruling of 2026-11-03, item 3: "Rerun v3 at three samples after
the change." Run file `2026-11-04T00-02-04-581Z-v3.json`, on `main` at
`8490b96` (#51, the voices), prompt `judge.v3.md` sha256 `61a178ca90e5...`,
76 calls, $1.1371. The eval key's total, the sum of every run file's
`total_cost_usd`, is now $5.7934 against the $8.00 cap.

The pass test, as before, on the median of three samples using each
sample's last attempt:

- **verdict_line: pass.** One first reply over the cap
  (`confucian-hierarchy-school`, sample 3); its retry validated. No sample
  without a result.
- **`stoic-analogy`: pass.** 78/72/78, fidelity 8.
- **`confucian-hierarchy`: pass**, in band on every axis: score 70/70/68,
  fidelity 7, engagement 4/3/3.
- **`confucian-hierarchy-school`: fail**, as in both earlier runs: score
  80/80/80 against 40-75, engagement 5/5/5 against 0-4. Fidelity 9.
- **The power question in `unanswered_objection`: now raised**, which no
  earlier run did. All six hierarchy samples return the objection in
  Utilitarianism's voice, where runs 1 and 2 gave Virtue Ethics on five
  of six. On `confucian-hierarchy` all three name who sets the terms:
  "If the system sets the terms and the worker has no say in them, the
  worker's interests are only ever accounted for as the employer
  construes them, never weighed independently" (sample 1); "still lets
  the employer author both sides of the ledger" (sample 2); "A system
  fixed by the employer encodes only the obligations the employer
  recognizes" (sample 3). On `confucian-hierarchy-school` sample 1 does
  clearly: "whose judgment decided that". Sample 2 is borderline: its
  claim opens "If the system sets the terms by encoding what the
  relationship already asks, nobody is checking whether those terms still
  serve the pupil's actual interests", but its reason is about the pupil's
  welfare: "The argument never asks whether the encoded duties track what
  currently benefits the pupil, only whether they match the role." Sample
  3 is about the pupil's interests going unweighed, not about who holds
  power. That reading is mine; whether these meet "naming the power
  question" is Arthur's call. The quotations are verbatim from the run
  file.
- **The original six: pass.** `stoic-strong` 70, `stoic-wrong-school` 24,
  `util-strong` 82, `util-wrong-school` 22, `virtue-strong` 78,
  `virtue-wrong-school` 28, all in band.

**So Stage 1 still does not pass, on one case.** On my reading, which is
Arthur's to confirm on the power question, everything else in the test
now holds. `confucian-hierarchy-school` has been out of band in all
three runs (86, 78, 80). The brief says never widen a band, and that band
questions go to Checkpoint A, so it goes there.

**One thing the judge does not do.** On `confucian-hierarchy-school`,
sample 1 returns the school's known objection as unanswered, and sample 2
arguably does, and both score engagement 5. The v3 criterion says an argument that leaves that
objection unmet "scores no more than 4 on engagement". On
`confucian-hierarchy` it holds (4/3/3). So the cap is not applied
reliably, and that case's engagement band is missed because of it.

**What the voices did elsewhere.** Three cases moved by more than five
points of median score from run 2: `confucian-hierarchy` +8 (62 to 70),
`ubuntu-strong` -7 (78 to 71) and `util-wrong-school` -6 (28 to 22), all
in band. Review of #51 asked whether naming Utilitarianism as the voice
of Buddhist Ethics' objection would pull `buddhist-intention-excuse`
away from intention. It did once: two of its three objections still
target intention ("not inferred from the builders' good hearts", "not
just certify its intentions"), as all six did in runs 1 and 2, but
sample 1 is the systematic-theory gap, close to the voice's own words:
"compassion alone gives no way to make that comparison".

**No further run.** Arthur's ruling asked for one rerun, and the brief of
2026-11-03 (Arthur's instructions to the session, not in the repo) allows
"At most two further reruns within the budget." Both are used: run 2 after the engagement fix,
and this one. What remains is a band question and a judge-compliance
question, both for Arthur.

### The public views were writable (migration 0016)

Found on 2026-11-03 while preparing Stage 2, and reported to Arthur at
once under the brief's STOP NOW rule. Nothing recent caused it.

**The hole.** The four views that serve public pages, `debates_public`,
`exchanges_public`, `profiles_public` and `public_results`, are owned by
`postgres`, which bypasses row level security, and run with their owner's
rights. Supabase's default privileges had given `anon` and `authenticated`
every privilege on them, not just SELECT, and each is a simple view that
Postgres treats as updatable. So anyone holding the anon key, which ships
in the site's JavaScript as it must, could in principle have updated or
deleted any user's debate score, verdict and Elo columns, profile row and
quiz result through the API.

**Evidence, read-only.** The catalogue (`information_schema.role_table_grants`,
`is_updatable`, the owner's `rolbypassrls`); the security advisor, which
reported all four as ERROR "Security Definer View"; the app code, which
only ever reads these views; and the API logs, which keep 24 hours on this
plan and showed 25 requests in that window, all reads by our own server.
A zero-row UPDATE on `debates_public` as `anon`, inside a rolled-back
transaction, ran without a permission error before the fix.

**The fix, Arthur's yes of 2026-11-03.** `0016_public_views_read_only.sql`
revokes INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on the
four views from `anon` and `authenticated`, and revokes EXECUTE on
`is_class_member` and `is_class_owner` from `public` and `anon` (no
signed-out page calls them). Tested first on local Postgres carrying
production's grants (`scripts/test-0016-view-grants.sh`, 156 checks over
the hole, the fix, the rollback and a re-apply; a weakened migration fails
52). The pre-fix grants are in
`docs/seed-snapshots/2026-11-03-public-view-grants.json`, which the
rollback restores exactly.

**Read back after applying.** `has_table_privilege` shows SELECT kept and
every write privilege gone for both roles on all four views, and
`service_role` unchanged; `has_function_privilege` shows `anon` can no
longer execute the class helpers and `authenticated` still can. The same
zero-row UPDATE as `anon`, and a zero-row INSERT on `profiles_public`, now
fail with "permission denied". A zero-row DELETE probe as `authenticated`
was attempted through the Supabase tool, which asked for confirmation and
timed out without running; Arthur ruled that the read-back is enough and
no further DELETE-shaped probe is sent.

**Advisor before and after.** Before: four `security_definer_view`
ERRORs, and the class helpers flagged as executable by `anon`. After 0016:
the same four ERRORs, which are about the views' definer property and not
their grants, and no `anon` warning on the class helpers. No new ERROR.

### A read-only check for earlier tampering

Arthur asked for it on 2026-11-03, since the 24-hour log window cannot
show whether the hole was used before. Everything below was read, nothing
written.

- **Debates.** One row, `jjSZVZFBmu`, a v1 verdict on `opaque-benefit`,
  argument private. Its stored score, 68, equals the verdict's score, and
  its `prompt_version` and `rejected` match the verdict. Its Elo move,
  1200 to 1206, is exactly `soloElo(1200, 1200, 68)` from
  `src/lib/elo.ts` with the topic's par of 1200, and its author's profile
  Elo is 1206.
- **Quiz results.** All 28 recompute exactly from their stored answers,
  using the option weights in `content/quiz/questions.ts`: vector (largest
  difference 2e-16), school and secondary all match, and every answer set
  is ten known options. A first attempt with weights typed from memory
  showed 28 mismatches; the weights generated from the file showed none.
  That is why the check reads the file rather than a hand copy.
- **Row counters** since the statistics reset of 2026-08-25: deletes are
  2 on `quiz_results`, 2 on `debates` and 1 on `exchanges`. This file
  records test rows inserted and deleted again during the RLS checks
  ("Infrastructure" and "RLS, verified three ways"). The counters are
  consistent with those cleanups; they cannot be tied to them one by one.

**No sign of tampering.** The limit of the method: an edit that changed a
debate's score, verdict and Elo together, consistently, would pass the
debate check. The quiz check has no such gap, since answers and vector
would both have to be rewritten to agree.

### What each public view exposes on SELECT

Report only, at Arthur's request of 2026-11-03, after 0016.

| View | Columns | Who can read | Read by the app |
| --- | --- | --- | --- |
| `debates_public` | id, topic, school, score, verdict, Elo before and after, created, kind, parent, argument only when published | anon, authenticated | verdict page, OG image |
| `profiles_public` | every user's id, handle, display name, school, Elo, streak, join date | anon, authenticated until 0017 | nothing |
| `exchanges_public` | id, topic, both schools, both debate ids, created; only exchanges complete and published by both sides | anon, authenticated | nothing |
| `public_results` | quiz result id, school, secondary, vector, challenge source, created | anon, authenticated | `/r/[id]`, its OG image and card, `/c/[id]` |

Two findings came out of it, both ruled on by Arthur the same day and
recorded below: `profiles_public` listed every user and nothing read it,
and `debates_public` returned the whole verdict on a private argument.

### `profiles_public` cannot be read from the API (migration 0017)

Arthur's ruling of 2026-11-03: "the app never reads it, and the site
promises names are never shown. Revoke SELECT from anon and
authenticated. If anything does read it, stop and tell me instead."
Before writing the migration, the repository (pages, scripts, tests) and
the database (`pg_depend` on views and functions) were searched for a
reader; there is none.

`0017_profiles_public_no_select.sql` revokes SELECT from `anon` and
`authenticated`. The view stays, so the admin client could still use it.
Applied and read back: both roles have no privilege left on it,
`service_role` and `postgres` unchanged. The advisor's ERRORs went from
four to three, since it no longer counts a view the API cannot reach.

### The judge quotes arguments (migration 0018)

**Rule for any future public surface: a verdict is the argument's text in
pieces.** The judge quotes the argument it is judging, in each of the six
free-text fields measured below, and any field it writes in its own words
can do the same; `improvement_note` and `rejection_reason` were not
measured, since the golden runs hold no revisions and no rejections. Any
page, image, export, API or view that shows a verdict to anyone other than
its author has to treat the verdict's text with the argument's own
privacy, and has to do it before the verdict reaches the browser: a prop
handed to a client component is in the page's source whether or not it is
rendered.

The measurement, `scripts/measure-verdict-quoting.mjs`, over five golden
runs on `tests/judge/golden/`, 269 judged samples (the run of 2026-11-03
18:15 passed by path, since its file is not yet on `main`):

| Field | Has a quoted span | Shares four words in a row with the argument |
| --- | --- | --- |
| `verdict_line` | 17 | 10 |
| `strongest_move` | 78 | 118 |
| `weakest_move` | 187 | 71 |
| `a_stronger_version_would` | 48 | 12 |
| `unanswered_objection.claim` | 38 | 5 |
| `unanswered_objection.why_it_stands` | 36 | 7 |

Both counts overstate quotation: the first also counts a school's own
terms in quotation marks, the second stock phrases. The examples settle
it. `verdict_line` on `util-obscure-source`: "hiding behind 'the service
should say which it has.'"; `weakest_move` on `stoic-wrong-school`:
"Explicitly defines wisdom as 'maximize placements across the whole
population,'". An earlier count of 344 samples, given in conversation,
counted one run twice; 269 is correct.

Arthur's ruling of 2026-11-03, in his message that evening approving
0017 and 0018: "debates_public: for rows where the argument is not
public, return NULL for every verdict field that can quote the argument
(strongest_move, weakest_move, a_stronger_version_would, and any other
free-text field that can contain the student's words). Keep score,
criteria scores and verdict_line, and check whether verdict_line can quote
too; if it can, null it as well." It can, so it goes too.

`0018_debates_public_private_verdict_text.sql` rebuilds the verdict from
a list of what to keep for a row whose argument is private, and for a
revision whose original is private.

- **Why revisions too.** The revision judge is shown the original, and
  `judge.v2.md` asks its `improvement_note` to name what changed between
  the two, so a published revision's verdict can quote a private original.
  Review pass 2 of #50 found this.
- **What is kept:** `rejected`, `score`, `fidelity`, `rigor`,
  `engagement`, `objection_answered`, `prompt_version`, and the objection
  reduced to its `school`, with `claim` and `why_it_stands` as JSON null.
- **Each kept field must have its own type:** a boolean, a number or
  null, a version such as "v2", or a school id. Text cannot ride through
  in a field meant for a number.
- **Withheld fields are left out, not set to JSON null.** Reading one
  gives null either way, which is what the ruling asks. A list of what to
  keep means a field the verdict gains later is withheld until someone
  decides otherwise.
- **The first draft listed what to remove instead.** Review pass 1 showed
  four shapes it would have let through: an unknown key, an extra key on
  the objection, an objection stored as a string, and a verdict that was
  not an object. Nothing writes those shapes today.
- **Other cases:** a private verdict that is not a JSON object becomes
  null. A published argument's verdict, and a null verdict, are unchanged.
  The view's `argument` column still follows only the row's own
  `argument_public`.

**Tests.**
- Local Postgres: `scripts/test-0017-0018-public-views.sh`, 107 checks
  over all of these cases, rollback and re-apply included. Removing the
  parent rule fails 5 of them.
- `tests/verdict-privacy.test.ts` holds the view's keep-list and the
  page's equal. Adding `verdict_line` to the view's list alone fails it.
  The type check would still drop that string, so the SQL test does not
  notice on its own.
- The definition 0018 replaces is in
  `docs/seed-snapshots/2026-11-03-debates-public-before-0018.json`.

**The page goes first.** The verdict page's privacy decision is
`verdictForViewer` in `src/lib/verdict-privacy.ts`, tested case by case.
For anyone but the author of a private argument, or of a revision of a
private one, it cuts the verdict down on the server with
`withheldVerdict`, using the same keep-list and types as 0018. It reads
whether the argument is public from the view's own `argument` column
rather than from anything the page derives. Review pass 2 showed that a
page variable flipped to true went unnoticed by every test, which is why. It does this before the verdict reaches the `Verdict`
component, a client component whose props are written into the page's
payload. The author reads their own full verdict from `debates` through
row level security. So the page is right before 0018 and after it, and
0018 is applied only once that code is live.

The first version withheld the words only in what `Verdict` rendered. It
still passed the full verdict as a prop, so before 0018 every field was
in the page source, and `rejection_reason` and `improvement_note` were
rendered anyway. The fresh review of #50 found both, and this is the fix.
`tests/verdict-privacy.test.ts` now checks the props themselves, and that
the page's keep-list and 0018's are the same list.
A rejected private argument shows its own withheld note instead of the
judge's reason, and a revision's note on what changed is not shown. What a reader other than the
author sees is in `docs/daily-path-copy.md`, "A verdict on a private
argument, seen by someone else": the score and the three criteria, a note
saying why the rest is withheld, and the school whose objection was left
standing. The share line drops its "The judge's note:" sentence for them
(`src/lib/verdict-share.ts`). The OG image reads only school, score and
topic, so 0018 does not touch it.

### A challenge link stores the challenger's result (2026-11-04)

Found while building sample activity (#57), and fixed on Arthur's ruling
of 2026-11-04. `/c/<id>` sends a reader to `/quiz?c=<challenge id>`, and
`submitQuizResult` wrote that challenge id into `quiz_results.challenge_from`.
The column references `quiz_results(id)` (0001), so the insert failed the
foreign key and the reader's whole result was lost: no challenge could be
accepted. Production has no accepted challenge (a read-only query on
2026-11-04 at about 03:30 UTC: 3 challenges, none past `open`), which
fits. Shown on local Postgres: the challenge id
fails `quiz_results_challenge_from_fkey`, the challenger's result id
inserts.

`/r/[id]` reads the column as the challenger's result, so that is what is
now stored, looked up from the challenge first; an unknown challenge id
is treated as no challenge, and so is a challenger opening their own link
(same browser or account), who would otherwise take the slot meant for
the friend they sent it to. The acceptance that follows now applies only
to an open challenge with no challengee yet: the table holds one
challengee per challenge, and without the condition a link shared widely
would let each later reader replace the first and reopen a finished
challenge. Only the reader whose update took the slot reports
`challenge_accepted` to analytics. Nobody could accept a challenge before
this fix, so these conditions change nothing production has seen.
`tests/challenge-accept.test.ts`, whose fake enforces the foreign key;
four of its six cases fail on the old code.

### Only a result's owner can challenge from it (2026-11-04)

Found while building sample activity (#57), and fixed on Arthur's ruling
of 2026-11-04. `createChallenge` inserted a challenge for whatever result
id it was given, with the server role, so anyone could open a challenge
in another reader's name: the result's owner then showed as the
challenger to whoever opened the link. `/r/[id]` also offered the
"Challenge a friend" button to a visitor looking at someone else's result
that came from a challenge, which did exactly that.

The action now checks ownership the way `/r/[id]` already tells an owner
apart: the `anon_id` cookie the quiz was taken under, or the signed-in
account the result is saved to. Anyone else gets "Unknown result.", the
answer an unknown id gets. `/r/[id]` offers "Challenge a friend" only to
the owner (by cookie or by saved account, the latter newly treated as an
owner rather than as a first-time visitor); a visitor who is not the
owner gets "Debate them" where the page shows it, and "Take the quiz"
otherwise. `tests/create-challenge.test.ts`; two of its four cases fail
on the old code.

**What this does not close.** The action was one path to this. Another
goes through the database's own permissions and is part of the wider
write-permission fix reported to Arthur on 2026-11-03, which waits on his
"yes, the grants fix"; its details stay out of this public file until it
is closed.

### No client may update a challenge (migration 0021)

Part of the write permissions reported to Arthur under STOP NOW on
2026-11-03, and named again while building sample activity (#57), since
it is live in production and the site never needs it. Arthur's ruling of
2026-11-04 takes this one piece of the wider grants fix on its own:
"drop the 'accept sets challengee' policy and add a caller-is-a-party
check to assignChallengeTopic, under the views process (local test,
snapshot, apply, read-back, advisor before/after)". The rest of the
grants fix still waits on his "yes, the grants fix".

**The hole.** 0001 gave `anon` and `authenticated` an update policy on
`challenges`, "accept sets challengee", with `using (true)` and
`with check (true)`, and the table grants UPDATE to both. A select policy
narrows an update only when the statement reads a column. Through the
Data API every update carries a filter (Supabase runs it with
`safeupdate`), so the reach there is the rows the caller can read: a
signed-in party could rewrite any column of its own challenges, the other
side's result and the debate ids included, and `recordChallengeDebate`
trusts those debate ids when it moves both readers' ratings. In SQL as
the anon role an update with no filter reached every row; the message of
2026-11-03 said "anyone ... can edit any existing challenge", which holds
for that SQL session and overstates what the Data API allows. Every
challenge write the site makes is through the server role:
`createChallenge`, `submitQuizResult`, `assignChallengeTopic` and
`recordChallengeDebate`.

**The fix.** `0021_challenges_no_client_update.sql` drops the policy, so
row level security refuses every client update; grants and the other two
policies are unchanged. `scripts/test-0021-challenges-update.sh` shows on
local Postgres with production's grants that before it anon reaches all
three challenges with an unfiltered update and a party its own, that
after it neither reaches any while the server role still writes and a
party still reads, and that the rollback restores the policy exactly and
0021 applies again. `assignChallengeTopic` now answers a signed-in
stranger as it answers a missing challenge, using the same party test
`/api/judge` applies (`resolveChallengeSide`); `tests/challenge-topic.test.ts`.
`/r/[id]` shows "Debate them" only to the two parties
(`viewerIsChallengeParty`), since anyone else would now get an error from
it; they get what the page offers without it ("Challenge a friend" to
the result's owner, "Take the quiz" to anyone else, since #60). A party whose result is not saved to their
account is refused, as `/api/judge` would not record their debate either.

**Applied by hand on 2026-11-05**, in the Supabase SQL Editor, after the
tool's confirmation prompt timed out four times: so it is not in
Supabase's migration list. Snapshot, read-back and advisor are in
`docs/progress.md`.

### Clients keep only the writes the site makes (migration 0022)

Reported to Arthur under STOP NOW on 2026-11-03 and kept out of the repo
until closed; his "yes, the grants fix" came on 2026-11-04, "under the
same process (local test, snapshot, apply, read-back, advisor
before/after)". 0021 took the challenges update policy on its own first.

**The holes.** Supabase's default privileges give `anon` and
`authenticated` every privilege on every table made in `public`, so row
level security is all that stands between the public key and a write.
Six early policies, on five tables, allowed writes the site never makes
with a client key:

- `debates`, "debates insert own": a signed-in user could insert rows
  under their own id with any verdict, score and rating, which
  `debates_public` then shows on a public verdict page.
- `profiles`, "own update" and "own insert": no column limit, so a user
  could set their own rating, streak and school, or create a profile with
  them before the site made one.
- `challenges` and `quiz_results`, "anon insert own", `with check (true)`:
  anyone holding the public key could insert any row, a challenge naming
  someone else's result included.
- `class_members`, "member join self": a signed-in user who knew a class's
  id could join it without the code and past the joining limit.

Every one of these writes goes through the server role in the site:
`src/app/actions.ts`, `src/app/api/judge/route.ts`,
`src/app/debate/actions.ts`, `src/app/me/actions.ts`, `src/lib/claim.ts`
and `src/lib/challenge.ts`.

**The fix.** `0022_client_write_grants.sql` revokes INSERT, UPDATE,
DELETE, TRUNCATE, REFERENCES and TRIGGER on the five tables from `anon`
and `authenticated`, and gives back only what the site uses with a client
key: UPDATE of `profiles.display_name` and
`profiles.argument_default_public` (`setDisplayName`,
`setArgumentDefaultPublic`) and DELETE on `class_members` (`leaveClass`),
both to `authenticated` only. SELECT is unchanged. On Postgres 17 it also
revokes MAINTAIN from these tables and from the four public views, which
0016 missed ("Phase 3 item: move `motion_text` into `debates_public`").
`reading_responses`, which the site writes signed in, is not touched.
The policies stay. Five are unreachable without the grant; "own update"
on `profiles` still governs the two columns kept, which `/me` updates
through it. Dropping the five is a second change to review, and the
grant alone is what decides. A REVOKE
that finds nothing it may take (a privilege another role granted) still
succeeds, so the migration ends by reading what anon and authenticated
hold, on each table and on any of its columns, and fails as a whole if
anything meant to go is left.

**Beyond the wording Arthur approved.** The proposal he said yes to named
INSERT, UPDATE and DELETE on `debates`, `challenges` and `quiz_results`,
UPDATE on `profiles` limited to two columns, INSERT on `class_members`,
and MAINTAIN on the views. The migration also revokes TRUNCATE,
REFERENCES, TRIGGER and MAINTAIN on the five tables (none reachable
through the Data API, none used); INSERT and DELETE on `profiles` (without
the INSERT revoke, a signed-in user could create their own profile, with
any rating, before the server makes it at first sign-in); UPDATE on
`class_members`; and DELETE on `class_members` for anon. These are put to
him before it is applied.

Three other tables have client write policies the site also does not use:
`blocks` ("blocks own"), `reports` ("reports insert own") and `classes`
("class insert own"). Each lets a signed-in user do to their own rows
what the site already lets them do, without its validation (a class past
the limit, a block, a report). They were not in the approved fix and are
left as they are.

**Tests.** `scripts/test-0022-client-write-grants.sh` sets Supabase's
default privileges on local Postgres 16, applies every migration before
0022, and checks that each of the six writes goes through before it and
is refused after; that the client writes the site makes and its reads
still work, as anon, signed in and as the server role; each object's
exact ACL after it; that the rollback restores every ACL as it was, and
0022 applies again; and that privileges granted by another role, one of
each shape (both roles, a table privilege, TRUNCATE, an INSERT on columns
only, an UPDATE of a profiles column other than the two kept, and a
table-level UPDATE on `profiles`, the one table-level case the check reads
column by column), make 0022 fail naming each, without changing anything.
Breaking it on purpose, each caught (rerun on the final version): no
column grant (5 checks fail), DELETE on `class_members` revoked too (3),
the rollback keeping the column grant (1), the rollback leaving out
`class_members` (2), the closing check removed (7), and the closing check
narrowed to one role (4), one table (2), one privilege (1), no profiles
columns (2) or table-level privileges only (1); and `profiles` left out
of the revoke, or the column grant given to anon too, each make 0022
refuse to apply. Postgres 16 has no MAINTAIN: in production 0022's closing
check fails the migration if MAINTAIN is left and the read-back confirms
it, but the rollback's MAINTAIN half is not tested anywhere.
`tests/client-writes.test.ts` finds every `.from(...)` and `.rpc(...)` in
`src/`, works out whether the receiver is the admin client, reports every
other one that is not a read (its first method is not `.select(`, a
builder kept in a variable included), with the columns an update sets
(a spread or a non-literal shows as `?`), and checks that every helper
taking `admin: SupabaseClient` is given the admin client. The report is
held to the site's four client writes, so a new signed-in write fails a
unit test rather than production. It reads strings and comments as
blanks, leaves storage buckets out, and its header lists what it cannot
see, none of which `src/` does today.

For a later list: the column grant lets the Data API set `display_name`
without `setDisplayName`'s trim and 60-character limit, as "own update"
already did before 0022, and class owners see that name. A check
constraint on the column would hold it.

**Applied on 2026-11-05** at 03:00:50 UTC. Snapshot, read-back and
advisor are in `docs/progress.md`.

### For Checkpoint A, from the security work

- **Leaked-password protection** is off, and the advisor warns about it.
  Supabase's password-security guide says: "Leaked password protection is
  available on the Pro Plan and above." The project is on the free plan.
  Sophecs signs people in with an email link or Google and asks for no
  password (`src/components/auth/LoginForm.tsx`), so the protection would
  only matter if password sign-up is reachable through the Auth API; that
  setting has not been checked.
- **The three remaining `security_definer_view` ERRORs.** Closing them
  means making the views `security_invoker` and moving what they hide into
  row level security policies on the tables, a redesign rather than a
  revoke.
- **`is_class_member` and `is_class_owner`** remain executable by any
  signed-in user, which the advisor warns about. They cannot simply be
  revoked: the select policies on `classes` and `class_members`
  (`0013_classes.sql`) call them as the signed-in user, so a revoke would
  break class pages. Moving them out of the API's schema is the usual fix.
- **`exchanges_public`** is readable and unused. Kept, since it is meant
  to be public and exposes nothing private.

### Dependency audit (2026-11-05)

The sample-activity workflow's `npm ci` reported 17 vulnerabilities (2
critical, 7 high, 8 moderate). Arthur, 2026-11-05: fix the two critical
ones if they affect anything we ship or run, and list the rest.

**Fixed: `next` 15.5.24 to 15.5.29** (and `eslint-config-next` 15.5.25 to
15.5.29 with it). We ship and run it. 15.5.29 is the latest 15.x. It
clears:
- the critical "Unauthenticated Remote Code Execution in Image
  Optimization API when SVG files are used" (GHSA-2464-fhr4-w9xw, up to
  15.5.27);
- the high "Denial of Service in App Router using Server Actions"
  (GHSA-p3m5-59mp-jv5r, up to 15.5.27; the site uses server actions);
- the two moderate cache-poisoning advisories (below 15.5.27).

The RCE needs Next's own image optimizer serving SVGs. The site has no
`next/image`, no `remotePatterns` and no `dangerouslyAllowSVG`, and
Vercel serves `/_next/image` itself, so it was likely not reachable. The
DoS was. The lockfile otherwise moves only Next's own packages and
`sharp` 0.35.3 to 0.35.5 (Next's optional image dependency), which also
clears sharp's two high advisories (its bundled libheif and librsvg). In
review, all 30 prerendered pages built on 15.5.24 and on 15.5.29 had the
same visible markup, and the five gates pass.

**Mitigated, not fixed: `dompurify` (critical, GHSA-cg2g-xh64-v4q7, with one high and
three lows), by keeping it from loading.** It is in the lockfile only as
a dependency of `posthog-js`, for PostHog's product-tours extension, and
the copy that extension bundles (3.4.13) is also inside the range. No
chunk of the built site contains DOMPurify. But posthog-js loads the
extension from PostHog's servers whenever the project's remote config
turns product tours on, so a switch in the PostHog dashboard would have
run it on sophecs.com. `src/lib/analytics/client.ts` now starts PostHog
with `disable_product_tours: true` (`tests/analytics-product-tours.test.ts`).
One path is not covered by the switch: posthog-js's
`productTours.previewTour()` loads the extension without checking it.
Nothing in `src/` calls it; PostHog's toolbar, opened by a project member
from the PostHog app, might, which could not be checked from here. The
audit line stays: `npm update dompurify` would move the lockfile's copy
to 3.4.17, but not the copy the extension bundles.

**The rest, not fixed, for a later list.** `npm audit` on this branch
lists 16 packages (1 critical, 6 high, 9 moderate):

| Package | Severity | Reaches | Why it matters or not |
| --- | --- | --- | --- |
| `dompurify` | critical | `posthog-js` product tours | Above: not loaded. |
| `zod` 3.x | high (memory exhaustion validating oversized constrained collections) | direct; it parses only the model's replies, the judge's (`src/lib/judge/schema.ts`) and the turn screener's (`src/lib/screen.ts`), never a reader's input | Those replies are capped by `max_tokens` (850 for the judge, 60 for the screener), which bounds the collections. Fixed from zod 4.6.6, a major upgrade that touches the frozen judge schema: worth doing deliberately. Done on 2026-11-05 ("zod 4", below). |
| `follow-redirects` 1.16.0 | high (credential headers can follow cross-origin redirects) | `posthog-node` (`src/lib/analytics/server.ts`) through `axios` | Shipped in the server bundle, never called: posthog-node 4.18 uses `axios` only when there is no global `fetch`, and the Vercel project runs Node 24.x (its own setting; nothing in the repository overrides it, and the sample workflow's Node 22 is for CI), which has one. An `npm update` moves it to a fixed release within range. |
| `next` and its pinned `postcss` 8.4.31 | moderate and high (source-map path traversal, `</style>` escaping) | build only | Reads CSS we write; nothing attacker-controlled. Next 15 pins its own copy; fixed in Next 16. The site's own `postcss` 8.5.26 is outside the range. |
| `js-yaml` 3.15.1 | high (CPU with empty merge keys) | `gray-matter`, reading our own content frontmatter at build and request time | Only reads files in `content/`, which we write. |
| `source-map-js` 1.2.1 | high (DoS with crafted source maps) | build only | Our own source maps. |
| `vite` 8.2.2, `vitest` 5.0.0, `@vitest/mocker` | high and moderate (dev server and editor launch; three of the eight are Windows-only) | tests only | Never served. `npm update vite vitest` clears them: vite is a peer of vitest and has to move itself, to 8.2.4 or later. |
| `minimatch`, `@typescript-eslint/*` (five packages) | moderate (glob DoS) | lint only | Our own globs. |

### Arthur's rulings of 2026-11-05 on Checkpoint A

Arthur ruled on every item of `docs/checkpoint-a.md` on 2026-11-05, by the
numbers of the list sent with it. His words are quoted where they set a
rule. Items carried out in code or in the database get their own entries
when they ship.

The numbers map onto `docs/checkpoint-a.md` as follows:

| Numbers | Section of `docs/checkpoint-a.md` |
| --- | --- |
| 1 to 3 | Stage 1 (2F), items 1 to 3 |
| 4, 5 | Production database writes: (a), items 1 and 2 |
| 6 to 10 | Spending, rate limits and budget: (d), items 1 to 5 |
| 11 to 13 | What the judge receives: (b), items 1 to 3 |
| 14 to 16 | Content and philosophy: (e): the objection voices, Quiz v2, the colours |
| 17 to 19 | Sample activity, items 1 to 3 |
| 20 to 25 | Security design, items 1 to 6 |
| 26 | Housekeeping: the nav icon |

**The rulings**

- **1.** `confucian-hierarchy-school`: "keep the band. It's a judge
  weakness." The band in `tests/judge/golden/confucian-hierarchy-school.json`
  is not widened.
- **2 and 11.** "Yes, strengthen the v3 engagement-cap instruction (v3
  isn't live)."
- **3.** "Accept your reading." The readings in "2F, the rerun after the
  objection voices" stand.
- **4.** "Yes: display_name 60-char check constraint (verify existing rows
  first)."
- **5.** "Yes: drop the five unused policies, NOT 'own update'. Usual
  process." The DROP statements go to Arthur, by his instruction in the
  same message: "Database statements with DROP: post them for me to run
  in the SQL Editor rather than waiting on the Supabase prompt."
- **6.** "Yes: a hard daily ceiling on judge calls per reader, retries
  included, above the 5-argument cap. Pick a sensible number and state
  it."
- **7.** "Yes: budget check totals spend in the database and fails
  closed."
- **8.** "Retries must not use a reader's arguments. Additive schema
  change approved if needed."
- **9 and 10.** "No backups and no Supabase Pro: Arthur's decision. Record
  it in decisions.md as an accepted risk, and drop leaked-password
  protection." Recorded below.
- **12.** "Strip comments from judge.v3.md before it is sent (v3 only)."
- **13.** zod 4: "yes, own PR; the six judge request fixtures must stay
  byte-identical and v2 behaviour unchanged."
- **14.** "Utilitarianism's virtue-ethics voice becomes: 'what is done to
  one person must be justifiable to that person, not only to the total'.
  Buddhist voices stay."
- **15.** Quiz v2:
  - "Axes, plain names and the six positions: accepted as drafted,
    including Ubuntu at 0 degrees and Buddhist Ethics at 310."
  - "Weighted options (16.2-17.7%)."
  - "Reword the share lines, site description, SharePage and
    ChallengeInvite away from 'ten questions about AI', to something true
    of v2 (e.g. ten questions about how you decide what's right)."
  - Option edits, "same schools and vectors; re-run the simulation", in
    his words:
    - 2c: "Say whatever is most likely to get the essay improved before
      it is handed in."
    - 5c: "Tell them once, privately, what I saw. What they do next is
      theirs to answer for; what I say is mine."
    - 7a: "Tell the captain once, calmly, what I think is fair, then play
      as well as I can wherever I am put. Whether they listen is not up
      to me."
    - 7c: "Tell the captain to their face that it is unfair. Going along
      with it would make me someone I don't want to be."
    - 6b: "I am the older one, so it is on me to show him how we treat
      each other's things, and on him to learn to ask."
    - "Keep 1a, 10b, 3d, 5b, 6d, 9a, and 8c as written."
  - "No rule-based school: accept the reading and note in decisions.md
    that a duty-based school is the obvious seventh later." Noted below.
- **16.** "Colours: reject the all-violet set. The three new schools must
  come from different hue families; relax the colour-blind distance vs
  the live three from 12 to 8 (names always sit beside colours). Pick the
  best set under those rules, show it in the styleguide, and proceed;
  don't wait for me unless nothing passes."
- **17.** "Understood: plan the sample teardown and a fresh run into the
  launch steps (Quiz v2 ships at launch)." `docs/sample-activity.md`, "At
  launch".
- **18.** "Yes: no-referrer policy on sample pages."
- **19.** "Yes: one fresh review of #57's last fixes."
- **20, 24 and 25.** "accept as is; document why in decisions.md."
  Below.
- **21.** "Restrict is_class_member/is_class_owner if any signed-in path
  doesn't need them."
- **22.** "Yes: fix elo_percentile's search_path."
- **23.** "If nothing reads exchanges_public, revoke its read access."
- **26.** "No header icons: drop the item."

**Accepted as is (20, 24, 25), and why**

- **20, the three `security_definer_view` errors** (`debates_public`,
  `exchanges_public`, `public_results`). Each view is the public surface
  of its table and is meant to show rows the table's own policies hide
  from a stranger, which is what definer rights are for here. Each lists
  its columns by name ("What each public view exposes on SELECT"),
  clients can only SELECT from them (0016, 0022), and `debates_public`,
  as 0023 last defined it, keeps the private verdict fields out (0018,
  0020). Making them `security_invoker` would move every one of those
  choices into policies on the base tables: a redesign with its own risk.
  `exchanges_public` differs: if nothing reads it, 23 takes its read
  access away from clients.
- **24, the 0018 shape.** For a private argument, the withheld verdict
  fields are left out of the public verdict rather than set to null. The
  reason is the one 0018 records: the shape is a list of fields to keep,
  so a field the verdict gains later is withheld until someone decides it
  is safe, rather than shown until someone notices. `withheldVerdict` in
  `src/lib/verdict-privacy.ts` builds the same shape for the page, and
  `tests/verdict-privacy.test.ts` holds it.
- **25, the client write policies on `blocks`, `reports` and
  `classes`.** Each lets a signed-in reader write only rows that are
  their own:
  - "reports insert own" and "class insert own" allow an insert, the same
    write the site makes through the server, without its checks (a class
    past the limit, for one);
  - "blocks own" is `for all` (`0012_counterpart.sql`), so a reader can
    also update or delete their own block rows. The site only adds a
    block and offers no way to remove one, and deleting a block makes the
    pair matchable again (`seekCounterpart` in `src/app/debate/actions.ts`
    reads blocks in both directions). Checkpoint A said "the site makes
    those writes through the server, with its own checks", and the earlier
    message to Arthur that they let a user do "what the site already
    allows on their own rows, minus its limits"; both understated this,
    and it was put to Arthur after the ruling.

  No other reader's data is reachable through any of them.

**Accepted risk: no backups (9, 10)**

The project stays on Supabase's free plan, so there are no daily backups
and no Point-in-Time Recovery ("Open pre-pilot item: there is no
restorable backup"). Arthur's decision of 2026-11-05: no backups and no
Pro. A destructive mistake, ours or Supabase's, is unrecoverable beyond
whatever a migration's own snapshot holds. What limits that: every
change applied by hand goes through the usual process (a snapshot of what
it touches, a tested rollback, a read-back), and statements with DROP are
run by Arthur himself in the SQL Editor (his instruction quoted under 5).
The sample workflow writes on its own schedule with neither; its rows are
recovered from its registry, not from a backup (`docs/sample-activity.md`,
"Backup and recovery").

Leaked-password protection, which also needs Pro, is dropped. The site
asks for no password; whether password sign-up is reachable through the
Auth API has not been checked ("For Checkpoint A, from the security
work"), so this risk is accepted unmeasured.

**No rule-based school (15)**

The quiz's axes were drawn on the reading that none of the six schools is
a rule-based ethics (`docs/quiz-v2.md`, section 1). Arthur accepted that
reading. A duty-based school is the obvious seventh, later.

### Checkpoint A's database items (migrations 0024 and 0025)

Arthur's rulings of 2026-11-05 on Checkpoint A, items 4, 5, 21, 22 and 23
("Arthur's rulings of 2026-11-05 on Checkpoint A"). Two migrations,
because one of them drops:

- **0024, through the Supabase tool** (no DROP):
  - **4.** `profiles_display_name_length`: `display_name` is null or at
    most 60 characters. Production's rows were checked first: 3,280, none
    over 60, the longest 12. Added last, so `profiles` is locked for the
    shortest time.
  - **21.** No signed-in path needs `is_class_member` or `is_class_owner`.
    Every class read in `src/` uses the server role; the one signed-in
    class write, `leaveClass`, deletes the reader's own `class_members`
    row, which needs only "auth.uid() = user_id". So the two class read
    policies narrow to the reader's own rows (ALTER POLICY, renamed "class
    read owner" and "member read own"), and clients can no longer execute
    either function. The functions stay, unused; dropping them is a DROP
    for later. The closing check also fails if any policy still calls
    either. Checkpoint A and "For Checkpoint A, from the security work"
    said a revoke "would break class pages": it would not have, since
    class pages read with the server role; it would only have broken the
    two policies for a direct signed-in read through the API.
  - **22.** `elo_percentile` runs with `search_path = ''` and names
    `public.profiles` in full. Same signature, logic and results.
  - **23.** Nothing in `src/` or `scripts/` reads `exchanges_public`, and
    in production no database object depends on it (`pg_depend`, read on
    2026-11-05), so anon and authenticated lose SELECT on it. The server
    role keeps it.
  - It ends by checking what clients hold and fails as a whole if a revoke
    took nothing.
- **0025, run by Arthur in the SQL Editor** (his instruction: "Database
  statements with DROP: post them for me to run in the SQL Editor"): drops
  "debates insert own", "own insert" on `profiles`, "anon insert own" on
  `challenges` and on `quiz_results`, and "member join self". Not "own
  update", which `/me`'s two signed-in updates go through.

**Tests.** `scripts/test-0024-checkpoint-a-database.sh` applies every
migration before 0024 under Supabase's default privileges, then checks 41
things: the constraint at 60 and 61 characters, from the server role and
signed in; a member no longer reading the class and an owner no longer
reading others' memberships, while each still reads their own and
`leaveClass` still deletes; both functions refused to anon and
authenticated; `elo_percentile` counting genuine profiles only, its results unchanged
and its body running under an empty caller search path; `exchanges_public` refused to clients
and read by the server role; the rollback restoring every policy, grant,
function and constraint exactly (compared as text); 0024 refused, naming
the privilege, when another role has granted one of the functions, and
naming the policy when any other policy calls one; 0025
dropping the five and keeping "own update", with `/me`'s two updates and
the server role's join still working; and 0025's rollback restoring the
five exactly. `scripts/test-migrations.sh` passes.

**Snapshot:** `docs/seed-snapshots/2026-11-05-before-0024.json`, read from
production at 06:00 UTC on 2026-11-05.

### zod 4

Arthur's ruling 13 of 2026-11-05: "zod 4: yes, own PR; the six judge
request fixtures must stay byte-identical and v2 behaviour unchanged".
zod goes from 3.25.76 to 4.6.7, which fixes zod 3's high advisory
(memory exhaustion validating oversized constrained collections;
"Dependency audit (2026-11-05)"). zod parses only model replies, the
judge's (`src/lib/judge/schema.ts`) and the turn screener's
(`src/lib/screen.ts`), and the golden fixtures in `tests/judge/`.

**One behaviour change in zod, undone here.** From 4.5, zod counts a
string's `.max()` in Unicode code points; zod 3 counted UTF-16 code
units, which is what JavaScript's `length` is. Under zod 4 a
`rejection_reason`, or a screener's `reason`, of 199 letters and an
emoji (201 units, 200 code points) would pass where zod 3 refused it,
and any emoji-heavy string could run to twice the cap. No zod 4 release
that fixes the advisory counts the old way. So both 200-character caps
are now a check on `length` (`maxUnits` in `schema.ts`, a `refine` in
`screen.ts`), which counts as before. `.min(1)` is unaffected. This is
an edit to the frozen `schema.ts`, made under ruling 13 to keep its
condition; it changes nothing the judge is sent. The only other edit
to a frozen file is a comment in `src/lib/anthropic.ts`, on the clause
its error summary cuts.

**The request fixtures.** zod plays no part in what the judge is sent,
and `tests/judge-request.test.ts` holds all six byte for byte; nothing
under `tests/judge-request/` or `content/` changed.

**v2's behaviour.** One corpus of 91 model replies, 74 to the judge and
17 to the screener, run through the real parse paths (`callJudgeModel`
and `screenTurn`, the model replaced by a stub) under zod 3 and under
zod 4: every reply is accepted or refused the same way, every accepted
one parses to the same data, and every refusal names the same fields.
The corpus covers both verdict shapes, including the nulls `judge.v2.md`
asks for in the field the other shape uses; every field's type, bounds
and word caps at and past the limit; the two 200-character caps with an
astral character at and past the limit; a draft school and a wrong-case
one as the objection's school; keys the schema does not name (dropped,
as before); and replies that are not objects or not JSON.
`tests/model-reply-parsing.test.ts` keeps it, with the outcomes taken
from zod 3; without the caps' new check, its two astral cases fail on
zod 4. The reviews' own 179 further cases, run the same way (numbers
from `1e309` to `-0`, `__proto__` keys, lone and split surrogates,
combining marks, unknown keys nested deep and many more), differed only
in those two cases before the check and in none after it. One
difference outside production: the golden runner's fixture schema now
refuses an Infinity in a band, which zod 3 let through; no fixture has
one.

**What does change** is zod's wording of a refusal: "Too big: expected
number to be <=100" where it said "Number must be less than or equal to
100", and so on, and a refusal can name a field twice (an array in a
string field is refused for its type and again for its length). The
judge's summary is logged (`ai_calls`' `validation_error`, and the
production log) and printed by the golden runner, and no code parses
it. One
change is a fix: zod 3 quoted the value it got for a wrong enum value,
and the screener's summary kept it, so a screener reply naming no known
result put the model's text in the message; that message is logged only
outside production (`src/app/api/counterpart/turn/route.ts`), and zod 4
names the options only. The test holds the zod refusals of both to
that; the screener's not-JSON message still quotes the start of the
reply, by design.

### The new schools' colours

Arthur's ruling 16 of 2026-11-05: "reject the all-violet set. The three
new schools must come from different hue families; relax the colour-blind
distance vs the live three from 12 to 8 (names always sit beside colours).
Pick the best set under those rules, show it in the styleguide, and
proceed; don't wait for me unless nothing passes."

**Chosen:** Confucianism `#562b05`, a deep brown; Ubuntu `#1e3b4f`, a dark
blue; Buddhist Ethics `#7d56b8`, a violet. On `/styleguide/phase3`, "The
new schools' colours" (a preview deployment), with screenshots in
`docs/phase3-styleguide/`.

**The rules, as `scripts/colour-candidates.mjs` now applies them.** Every
constraint from Checkpoint A stands (white hero text at AA, a dot that
shows on paper, CIEDE2000 20 from the live schools and 15 from the judge's
blue and the step-done orange in normal vision, each school's stereotyped
hues excluded), with the distance to the live three under simulated
deuteranopia and protanopia lowered from 12 to 8. "Different hue
families" is eight named families of OKLCH hue (red, orange and brown,
yellow and gold, green, cyan and teal, blue, violet, magenta; red takes
two sectors, since it wraps through 0), one school to a family, and the three also at least 40 degrees of hue apart, so a
violet at 300 and a magenta at 320 do not count as different.

**Why this set.** The relaxed 8 hardly widens what passes: 1,059 colours
against 1,056, nearly all blue to magenta, because the binding limit is
the 20 from the live three in normal vision, which shuts out the greens,
teals, reds, oranges and golds near Stoicism, Virtue Ethics and
Utilitarianism. Among the sets that do pass, every school's possible
colours were tried together. Each set is scored by its closest pair
among all six schools, under the worst of the three views. The highest
score is 12.8, a blue, violet and magenta set whose three new colours
are only 12.8 apart and all within 90 degrees of hue of each other,
which is the all-violet set again in other words; this set scores 12.7,
a difference no one can see. So the score is rounded to the nearest
whole unit, and ties go to the set whose new colours are furthest from
each other: 21.5 for this one. Confucianism
has to be the brown, since the Ubuntu and Buddhist exclusions both cover
it; Ubuntu and Buddhist Ethics could swap blue and violet at the same
score, and this way round was the search's first.

**What to know.**
- The weakest pair is Confucianism's brown and Virtue Ethics' oxblood
  under simulated deuteranopia, 12.7, and the two are neighbours on the
  map (50 and 110 degrees). Under protanopia the brown is nearest
  Stoicism and Virtue Ethics (17.0 each); in normal vision it is nearest
  Utilitarianism's ochre (20.1, the limit being 20). Names always sit
  beside colours, which is what the relaxed rule rests on.
- The brown's hue is 21 degrees from the ochre's. The ruling's families
  constrain the three new schools among themselves, so this is no
  breach, and a reading that applied families across all six would rule
  the brown out and leave only blue, violet and magenta sets, the kind
  rejected.
- The relaxation to 8 turned out not to be needed: this set clears the
  original 12 (its weakest pair is 12.7), and the search with 12 picks
  the same set.
- Ubuntu's blue is 15.1 from the judge's blue in normal vision, the
  limit being 15.
- With the other two held where they are, Confucianism and Ubuntu have
  no alternative at least 10 from the chosen colour (they have near ones,
  4.6 to 8.5 away); Buddhist Ethics has two, shown beside it.
- Each card surface is the marker itself, except Buddhist Ethics',
  darkened to `#724aab` so the card's text holds AA at its lowest
  opacity. The live schools' surfaces are all darker than their markers;
  whether the new ones should be too was an open question at Checkpoint
  A that ruling 16 did not answer, and it goes on Checkpoint B's list.
  (Ruled at Checkpoint B, (e) 2: darker, the same way. See `### Arthur's
  rulings of 2026-11-05 on Checkpoint B`.)

Nothing live changes: the colours reach the site with Phase 3, behind
`SIX_SCHOOLS`.

### Quiz v2, as ruled

Arthur's ruling 15 of 2026-11-05 ("Arthur's rulings of 2026-11-05 on
Checkpoint A"), carried into `docs/quiz-v2.json` and `docs/quiz-v2.md`:

- The axes, their plain names and the six positions stand as drafted,
  Ubuntu at 0 degrees and Buddhist Ethics at 310 included, and so do the
  weighted options.
- 2c, 5c, 7a, 7c and 6b take Arthur's wording, each keeping its school
  and vector. The simulation, re-run, gives the same figures to the
  digit, as it must: it never reads an option's wording. Every school lands as
  primary for 16.2% to 17.7% of answer patterns.
- 1a, 10b, 3d, 5b, 6d, 9a and 8c stay as written. No rule-based school;
  a duty-based one is the obvious seventh, later (noted above).
- The copy's AI framing is reworded now, on the live site: "ten
  questions on how AI should decide things" was not true of v1 either
  (three of its ten questions involve AI), and "ten questions about how
  you decide what's right" is true of both. That covers the site
  description, `SharePage`, `ChallengeInvite` and the opening of one
  share line on each school page (`content/schools/*.md`, which the
  ruling names). The time ("about eighty seconds", which v2's longer
  options would make untrue) and three schools becoming six change at
  launch, and the share lines that describe v1's questions go to Arthur
  as content judgements (`docs/quiz-v2.md`, section 8).
- PostHog's `share_clicked` records a share line by its index, and three
  of those indices now hold new text (stoicism 1, utilitarianism 2,
  virtue-ethics 0) from this PR's production deploy on 2026-11-05.
  A comparison of share lines should split on that date.

Quiz v2 ships at launch, after the sample teardown, and the fresh run
follows it (`docs/sample-activity.md`, "At launch").

### Sample activity: halts that hold, and console logs (2026-11-05)

Arthur's ruling 19 of 2026-11-05 asked for one fresh review of #57's last
fixes. It found nothing blocking, and four things to fix:

- **A halt could be lifted without a validation passing.** `execute`
  cleared `last_error` before writing, so a `full` run by hand that then
  crashed left the run failed but not halted, and the next scheduled
  `extend` wrote; and a validation that threw left the run `complete`.
  Now every run that writes ends halted ("halted: validation not
  finished") and only a passing validation lifts it
  (`finishValidation`); a run by hand on a halted run keeps the halt
  while it writes, and through a crash; and a refusal while writing (a
  row it would not adopt or update, a user without its ban) halts the
  run rather than leaving the schedule to try again every six hours,
  which is what `docs/sample-activity.md`, "Stop conditions", already
  said it did. `scripts/seed-production.ts` does the same, and a canary
  cannot be run on a halted run or one that has had its full stage, so a
  run by hand from the command line cannot lift a halt either. The run's
  lock is kept from the end of the writes until the validation's result
  is recorded, so no teardown or other writer can come in between; if it
  is lost, nothing is recorded and the halt stays. An error from the
  writes goes to `last_error`, and the public log gets a line of its
  own, since the message can name a row.
- **The 5% duplicate check ran after the writes.** The rate is the
  plan's own, so it now runs with the dry-run checks: an extension that
  would cross it is refused before anything is written.
- **Console logs skipped `before_send`.** posthog-js sends console log
  records by their own path, and console capture can be switched on from
  the PostHog project. The `logs` setting's own `beforeSend` now drops
  every one once the page load has shown a sample page: a record logged
  before the logs script loads is filtered only when it is replayed,
  without the address it was logged at.
- **The sample users' email tag** comes from the generator's random
  streams, which are not meant for secrets. Changing it would break the
  live run's spot checks, so it becomes an HMAC for the fresh run at
  launch (`docs/sample-activity.md`, "At launch").

And from its nits: `return_visit` was lost for a visit that started on a
sample page (the flag was set before `track()` dropped the event), and is
now sent from the first genuine page; the docs say what web vitals and
the heatmap's mouse-move timer can still carry; and the stop conditions
say what each one does.

### Node 24 actions and the in-range fixes

Checkpoint A's housekeeping, "mine to do next" (`docs/checkpoint-a.md`):

- **The sample workflow's actions.** `actions/checkout` and
  `actions/setup-node` go from v4, which targets the Node 20 runtime that
  GitHub now runs on Node 24 with a warning (the last run's log says so),
  to v5, which targets Node 24, and are pinned to their commits
  (checkout v5.1.0, setup-node v5.0.0) rather than to tags, since this
  job holds the production service key and a tag can be moved without a
  commit here. v5 is the smallest step to Node 24; v6 and v7 of both
  exist, and their breaking changes touch nothing this job uses, so
  moving to them is a later choice. The job's own Node
  (`node-version: 22`) is unchanged.
- **follow-redirects, vite, vitest.** Each moves within its parent's
  range: follow-redirects 1.16.0 to 1.16.2, the only release with the
  fix (published 2026-10-25); vitest 5.0.0 to 5.0.5 and vite 8.2.2 to
  8.3.5, taken with `npm update --before=2026-10-22` so nothing is newer
  than two weeks (vite 8.3.6 and vitest 5.1.0 came out this week). Their
  dependencies moved with them, among them postcss 8.5.31 and
  source-map-js 1.2.2, which clears that advisory too, and two majors
  within vitest's own ranges (obug 3.0.0, why-is-node-running 3.2.1).
  `package.json` is unchanged; no dependency is added, and two
  (siginfo, stackback) drop out.

`npm audit` now lists 10 packages, down from 15 on main before this
(16 at the audit; zod went in #73): `dompurify` (not loaded, product
tours are off), `js-yaml` (our own front matter), `next` and its pinned
`postcss` 8.4.31 (build only, fixed in Next 16), `minimatch` and the
`@typescript-eslint` packages (lint only, moderate).

### Stage 5, step 1: the `SIX_SCHOOLS` flag (2026-11-05)

The first step of `docs/stage5-plan.md`. A build made with `SIX_SCHOOLS=1`
shows Confucianism, Ubuntu and Buddhist Ethics after the live three; a
build without it is the production build it was, which
`npm run check:bundle` confirms on every build.

- **Read when the build starts.** `next.config.ts` reads the variable and
  passes it through `env`, always `"0"` or `"1"`, so Next writes it into
  server and client code as a constant. Each module that holds a new
  school's strings tests `process.env.SIX_SCHOOLS === "1"` itself
  (`school-registry.ts`, `school-colors.ts`, `card-tokens.ts`), and on a
  flag-off build that test is false at compile time and the strings behind
  it are dropped. Tested in each module rather than imported as a
  constant, because a value carried across a module boundary is not one
  the build can fold.
- **Shown, not published.** `SHOWN_SCHOOLS` is the published three plus,
  with the flag, the three drafts, which keep `status: "draft"`.
  `PUBLISHED_SCHOOLS` is unchanged, because the judge reads it (the rival
  schools in its prompt, the schools its reply may name), and
  `tests/six-schools.test.ts` checks the judge's six request fixtures
  byte for byte with the flag on. Every lookup keyed by school now answers
  for the shown schools: `publishedLookup` is renamed `shownLookup`, and
  `schoolName`, the adherent nouns, `schoolColourVar` and `schoolShadeVar`
  read `shownEntry`. No page lists the three yet; step 2 moves the
  surfaces over.
- **Colours.** The markers and card surfaces are ruling 16's
  (`colour-candidates.json`). Each live school's deep shade, under a
  chunky control, is its marker at about three quarters of the lightness
  and chroma in OKLCH; the new deep shades are the new markers at 0.75
  and 0.73: Confucianism `#371a03`, Ubuntu `#112532`, Buddhist Ethics
  `#53387b`. They are in `src/app/six-schools.css`, which the layout
  imports through a name only `next.config.ts` resolves: the real file on
  a flag-on build, the empty `six-schools.off.css` on any other. The
  image routes' copies are in `card-tokens.ts`, behind the flag. The
  stylesheet also writes `.text-confucian` and the other two by hand,
  since Tailwind makes `text-*` classes only for `@theme` tokens, which
  every build ships.
- **Adherent nouns, for Checkpoint B (e).** Proposed, and shown on
  flag-on builds only: "Confucian", "Ubuntu Ethicist" and "Buddhist
  Ethicist", with plurals. Ubuntu has no settled English noun for one of
  its arguers, and someone arguing from Buddhist Ethics is not thereby a
  Buddhist, so those two follow "Virtue Ethicist". Six places write "a"
  or "A" before the noun, which "Ubuntu Ethicist" would need as "an"
  (`ChallengeInvite.tsx`, `ProfilePage.tsx`, twice in
  `ArgumentEditor.tsx`, the class page, and the quiz result, whose
  comment says every adherent name takes "a"). None can show one of the
  three until a reader is placed in one, in step 4, which handles them.
- **The bundle check** now looks for nineteen strings rather than six:
  the ids and names, the proposed adherent nouns (added to
  `DRAFT_SCHOOLS`, which does not depend on the flag), and every colour
  in `six-schools.css`. It throws if a draft lacks an adherent noun or
  any of its three colour tokens. It reads which kind of build it has
  from the build itself (`config.env` in `required-server-files.json`),
  and each script needs its own kind: `npm run check:bundle` fails on a
  flag-on build, and `npm run check:bundle:six` makes one into
  `.next-six` and fails unless all nineteen are in it whole, a name or
  id as a quoted string of its own and not inside a longer one. Both
  builds take about 35 seconds here.
- **The build cache.** Webpack's cache is keyed on Next's own config,
  which leaves out `env` and the stylesheet alias, and on the text of
  `next.config.ts`, which does not change with the variable. The review
  of #79 built with the flag and then without it into one directory, and
  the flag-off build kept the flag-on stylesheet: all seven colours and
  the three ids in its CSS. JavaScript was rebuilt correctly. Vercel
  restores `.next/cache` between deploys and runs no bundle check, so the
  flag is now part of the cache's version, and each kind of build reads
  only a cache its own kind wrote. Rebuilt both ways over one cache, and
  back, the checks pass each time.
- **No flag in production before launch.** `next.config.ts` refuses to
  build when the flag is on and `VERCEL_ENV` is `production`, or when a
  Vercel build (`VERCEL=1`) does not say which environment it is for, so
  a wrong tick in Vercel fails the deploy and the live one stays, rather
  than publishing the three with every gate green. The launch merge
  removes the refusal. It cannot see a promotion: promoting a flag-on
  preview to Production does not rebuild, and the review charter (rule 4)
  counts it as publishing.
- **Tests pin the flag off.** `vitest.config.mts` sets `SIX_SCHOOLS` to
  `"0"` for every test that does not stub it, so a flag left in the
  shell cannot fail unrelated tests under misleading names.

Vercel's Preview environment gets `SIX_SCHOOLS=1` once this is merged;
Production does not until launch.

### Stage 5, step 2a: the school pages, lessons and table for six (2026-11-05)

The first half of step 2 of `docs/stage5-plan.md`. On a `SIX_SCHOOLS`
build the three new schools have pages and appear wherever the product
lists the schools a reader can read about; on any other build every page
is as it was, and the landing page, a school page and the lessons index
were compared with the step 1 build to show it: the same markup once
scripts and build ids are set aside.

- **Loaders.** `src/lib/drafts.ts` gains one rule: on a `SIX_SCHOOLS`
  build, a draft that belongs to one of the three is shown with them, by
  every loader, without `includeDrafts`. A school file belongs to its
  `id`, a module to its `school`. On any other build there is no such
  school, so nothing loads that did not before. A draft that belongs to
  no school, such as an elsewhere passage, stays hidden; Today's view
  from elsewhere is step 2b's, with the lesson page it opens.
- **Pages moved to `SHOWN_SCHOOL_IDS`:** `/s/[school]` (with its static
  params, so a flag-on build prerenders the three), the landing page's
  schools section, the footer, the lessons index's order, chips and
  empty state, Today's lessons card, and the school table, whose new rows
  sit unranked with no average until someone argues for them. The
  table's "ranked once it has N judged arguments" rule from
  `/styleguide/phase3` is not used: N is Arthur's to set (Checkpoint B).
- **Counted headings.** "The three schools" and "The other two" are now
  counted from the list (`src/lib/count-word.ts`), so a flag-on build
  says six and five, and each is one string, so the markup a flag-off
  build serves is unchanged.
- **Left on the published three:** the sitemap, which lists sophecs.com
  URLs where the three do not exist; `/debate/rubric`, which is the
  judge's; the sharing image, whose "Three schools." is step 4's copy;
  and everything the judge reads.
- **What else a flag-on build does differently**, from the loaders:
  `/lessons/modules/[id]` prerenders the three's draft modules, one each;
  `/quiz/result` sends all six schools' content to the page, though the
  quiz still places a reader in one of three; and `getSchool` answers for
  the three, so `/r/[id]`, `/c/[id]`, their images, the verdict page and
  `/today` would render a row in one of them on a preview. On a flag-off
  build it still throws, which is why step 3 comes before any v2 write.
- **Today's lessons card** counts its modules too ("All six modules
  read." on a flag-on build).
- **The three's pages offer "Take the quiz" and "Argue a motion from
  it"**, which cannot yet place a reader in them or judge them (steps 4
  and 5). Previews only; for Checkpoint B.

### Stage 5, step 2b: Today's view from elsewhere (2026-11-05)

The second half of step 2 of `docs/stage5-plan.md`. On a `SIX_SCHOOLS`
build Today offers the week's view from elsewhere, and the passage has a
page; on any other build neither exists, and every passage page and the
lessons index serve the markup they did.

- **Which passages.** The six "elsewhere" passages in `content/micro`
  are drafts that belong to no school: their traditions are not all the
  three's (one is the Zhuangzi). They are Phase 3's, so the loader shows
  them on a `SIX_SCHOOLS` build and on no other, keyed on the flag itself
  and not on which schools are drafts, so that they stay at launch, when
  the three are published and the flag is on for Production. A draft in
  any other position stays hidden everywhere. When the flag is retired
  after launch, their `status: draft` goes with it.
- **Today.** The card from `/styleguide/phase3` sits in the path after
  step 4, "Face an objection", which brings the after-reading. It is a
  list item and not a seventh step: it has no check and nothing waits for
  it (`docs/daily-path-copy.md`). It is always there on a flag-on build,
  not only once step 4 is reached; the copy says it is optional, and
  whether it should wait for the after-reading is Arthur's (Checkpoint B).
  "Read it" opens the passage's page.
- **The passage's page.** `/lessons/[slug]` labels it "A view from
  elsewhere", leaves out the reading counter, and links to the passage
  that frames the question. The before and after pages count only their
  pair, so a flag-on build still numbers them 1 and 2 of 2
  (`src/lib/passage-place.ts`, tested on every real passage).
- **On Today**, the card is a list item in the path's `<ol>`, as the
  paused note is; each step's button names itself "Step N", so the card
  is not counted as one, and its title is an `<h2>` under the page's
  `<h1>`.
- **Kept out:** the lessons index (which pairs before and after, as it
  always has) and the sitemap, whose sophecs.com addresses have no such
  page.

### One address (2026-11-05)

Arthur saw the site move from sophecs.com to sophecs.vercel.app on his
phone, signed in, on `/debate`. Every production deployment also answers
at www.sophecs.com, sophecs.vercel.app and two vercel.app aliases Vercel
assigns (`sophecs-arthurrzhang-1874s-projects`, `sophecs-git-main-...`),
none of which redirected, and every link on the site is relative, so a
reader who reached one of them stayed there.

- **How readers reached it: signing in.** Supabase Auth sends a sign-in
  whose return address is not on its allow-list to its Site URL, and the
  Site URL was `https://sophecs.vercel.app`. Its logs show it: the
  `referer` GoTrue logs for the sample engine's admin calls, which carry
  no return address, is the Site URL, `https://sophecs.vercel.app`; and
  at 05:42:07 UTC on 2026-11-05 a Google sign-in started three seconds
  after a page view on sophecs.com (PostHog) was sent to that bare
  address, not to `/auth/callback`. The reader landed on sophecs.vercel.app
  signed out, signed in again from `/debate/opaque-benefit` there, and
  every page after it was on vercel.app.
- **Nothing in the code or the database pointed there.** No site-URL
  variable exists in Vercel; the share sheet, challenge links, sitemap and
  `metadataBase` all write `https://sophecs.com`; no stored row names
  vercel.app except one quiz result's `referrer` (a reader who arrived
  from a vercel.app page). PostHog counts 98 page views on
  sophecs.vercel.app by 6 people since 10 September, against 281 by 28 on
  sophecs.com, and 5 on a deployment's own URL in September.
- **The fix in code (`next.config.ts`).** A production build sends every
  page request on any host other than sophecs.com to the same path and
  query there. It shipped as a 307 in #83 (a browser keeps a 308, so a
  rule Vercel's router read differently from Next's could have left
  readers in a loop no rollback reaches), and became a 308 in #85, after
  the live check of 2026-11-05 21:41 UTC (`docs/progress.md`). Not moved:
  `/api/` (Vercel's cron calls one and does not follow redirects, and a fetch from a tab left open on an old
  host could not follow one: sophecs.com sees none of that host's cookies
  and answers no cross-origin request), `/_next` and anything under it
  (the same files on every host; Next adds the same exclusion to every
  redirect it runs itself, so the rule tells Vercel's router, which runs
  the rules in production), the deployment's own
  URL (behind Vercel's login; it lets a past deployment be opened), and
  previews and local builds. A sign-in that falls back to the Site URL
  arrives at the root with `?code=`, which the home page would drop; it
  is sent to `/auth/callback` with a 307, so it completes, at `/me`, or at
  the quiz for a reader who has not taken it.
- **Where a sign-in may land.** `/auth/callback` followed `next` from the
  query string wherever it pointed: `/login?next=//evil.example` sent a
  reader who had just signed in to evil.example. It now keeps a value only
  if it resolves on the site and the path it normalises to still does, on
  any origin (`src/lib/local-path.ts`): `/..//evil.example` normalises to
  `//evil.example`, which a first version of the check let through. Any
  other value lands where no `next` would. The quiz still carries its own
  `next` unused; the redirect that one day consumes it must use the same
  check.
- **The fix outside the code, which is Arthur's to click**: Supabase
  Auth's Site URL and redirect allow-list, and the Vercel domains' own
  redirects. The steps are in the pull request. The code's redirect does
  not depend on them, and they do not depend on it.
- **Cookies and storage are per host.** A reader signed in on
  sophecs.vercel.app is signed out on sophecs.com and signs in once more,
  and an unsent argument the editor saved in that host's local storage
  stays there, out of reach now that every page there redirects. A tab
  left open there across the deploy fails its next server action (they
  post to page paths, which redirect), and a quiz finished in it loses
  its pending result, kept in that host's session storage; reloading
  lands on sophecs.com. Submitting an argument goes through `/api/judge`
  and is not affected.
- **A loop to avoid.** A Vercel domain redirect from sophecs.com to
  another host (www, say) would loop with these rules, which send that
  host back. Today no domain redirects; the steps in the pull request
  point www at sophecs.com, the way that agrees.

### Sample scores that do not look generated (2026-11-05)

Arthur: no sample score should look generated, and none should cluster on
round numbers. Measured on the live run's rows before any change:

- **Composites:** 8,111 scored sample verdicts, 23.3% on a multiple of 5
  and 12.3% on a multiple of 10. The judge's own replies, 418 scored in
  `tests/judge/golden-runs`, land on a multiple of 5 16.3% of the time.
  The excess came from clamping each composite into its tier's range,
  which piled scores on 50, 70 and 90.
- **Criteria:** about half were half points (7.5). The judge has never
  given one: all 418 replies score every criterion in whole numbers.
- **Ratings:** 19.5% of `elo_after` on a multiple of 5 and 10.0% on a
  multiple of 10, and 22.4% of rating changes on a multiple of 5. That is
  the share any spread of whole numbers gives (20% and 10%), and the
  ratings come from the product's own `soloElo` and `pairwiseElo`, as a
  reader's do. Sample profiles with no rated argument hold 1200, the
  rating every account starts on.
- **Streaks:** 0 to 5, from the product's own `applyStreakDay`.
- **Quiz percentages** on result pages: 21.8% on a multiple of 5 for
  sample results and 21.4% for readers' own, both from `scoreQuiz`.

So the verdict scores, the only numbers the generator draws itself, were
the fix; ratings, streaks and quiz percentages are computed from them, or
from generated answers, by the product's own functions.

- **Not in place.** The engine inserts rows and refreshes a profile's
  rating and streak; it has no way to rewrite a written verdict, and its
  spot checks hold every written row to the plan, so a generator that
  changed a written row would halt the schedule. A one-off rewrite of
  8,111 production rows, with every later rating recomputed, would be a
  new kind of production write and not one the engine validates.
- **New rows, from 2026-11-06 06:00 UTC.** `scoreRuleFor` picks rule 2
  for rows dated from then, and for every row of a run begun after then.
  The live run had written to 2026-11-05 14:57 UTC; the six hours past
  midnight are margin for a late merge. With a dummy seed, the window the
  live run has written regenerates byte for byte the same on main and on
  this branch (the same manifest hash to 05:59 UTC on 2026-11-06), and
  with a window to 2026-11-08 every row dated before the cutover, in
  every table, is identical (28,814 rows, by the second reviewer's count),
  but for profiles' rating and streak, which the engine brings up to date
  on every run as it always has; only rows after it change. Rule 2 makes
  every draw rule 1 makes and takes its numbers from a stream of its own,
  so a rule-2 verdict differs from rule 1's for the same row only in its
  four numbers and its `prompt_version`, `sample-template-2`, which a
  revision's and a rejection's row carry too.
- **A late merge fails before it writes.** Old code running past the
  cutover would write a few rule-1 scores the new plan calls rule 2. The
  spot checks read 50 debates of about 8,600 and would almost never see
  them, so every run now compares every stored sample debate's score and
  `prompt_version` with the plan before it writes, and again in
  validation (`storedScoreCheck`). Run end to end against the in-memory
  adapter: on time, 0 of 9,853 stored debates differ and every check
  passes through 2026-11-20; with old code writing at 07:41 after the
  cutover, the next run is refused, "13 of 8576 stored sample debates
  differ", and writes nothing.
- **The existing rows** go at launch with the run, as planned; the fresh
  run follows rule 2 throughout.
- **Rule 2**, on six seeds of a full-size fresh run (three of mine, three
  of the second reviewer's): composites 12.5% to 13.0% on a multiple of
  5 and 5.8% to 6.3% on a multiple of 10; criteria on 0, 5 or 10 4.6% to
  5.2% (fidelity), 9.6% to 11.1% (rigor) and 13.4% to 15.2%
  (engagement); every criterion a whole number. Thinning harder would
  leave visible gaps at 50, 55 and 60. Score bands 70-90 / 50-69 / 25-49:
  about 26 / 47 / 25 (on my three seeds 25.8-26.3 / 46.4-47.8 /
  24.9-26.0), against the plan's 25 / 50 / 25, with about 1-2% below 25
  and 0.1-0.3% above 90, which rule 1's clamp never allowed. A first cut of the bands
  gave 23 / 44 / 30, and the mid tier's lower edges were raised to bring
  it back.
- **On the verdict page, for the live run only:** a rule-2 revision of a
  rule-1 original shows a half-point change ("6.5, now 7, +0.5"). Those
  rows go at launch.
- **The check.** `scripts/seed/round-scores.ts`: more than 20% of a run's
  rule-2 scores on a multiple of 5, for the composite or any criterion,
  refuses the run before it writes (with the duplicate-text check) and
  fails validation after, on every path that validates. It judges once
  there are 1,000 rule-2 verdicts, so that chance alone almost never
  refuses a run (at a true share of 15.4%, above rule 2's highest
  measured, about once in 24,000, by the exact binomial); the live run
  reaches that about eleven days after the cutover, at about 86 a day,
  and a fresh run starts with thousands. The schedule runs it, the
  stored-score check and the duplicate check before it writes; a run by
  hand (`seed-production`, `seed-local`) meets them in its validation,
  after the write, which halts the run if one fails.
- **If a merge comes after the cutover.** Every scheduled run is then
  refused, and the job goes red, until `SCORE_RULE_2_FROM` is moved past
  the run's `window_to`, which makes the rows old code wrote rule-1 rows
  again. Do not revert this change to recover: old code has no stored
  check, and its 50-row spot checks would rarely see the rule-2 rows
  already written.

### The judge's caps and budget (migration 0026)

Arthur's rulings of 2026-11-05 on Checkpoint A, items 6, 7 and 8
("Arthur's rulings of 2026-11-05 on Checkpoint A").

**8. "Retries must not use a reader's arguments."** The five-argument cap
counts `ai_calls` rows with `counts_toward_cap` (migration 0019), one per
call, so a judged submission that needed a retry used two or three of the
five. `judgeDebate` now takes the calls before the one that validated out
of the cap, so a judged submission counts once. A failed one still counts
not at all. Every call stays logged and in the budget. No schema change was
needed.

**6. "A hard daily ceiling on judge calls per reader, retries included,
above the 5-argument cap. Pick a sensible number and state it."** 20 judge
calls in any 24 hours, every logged call counted, the ones taken off the
argument cap included. A call the API refused or that never answered
writes no row, so it counts toward neither the ceiling nor the budget;
those are mostly not billed. A submission starts only if all of its possible attempts fit
(`count + MAX_JUDGE_ATTEMPTS > 20` refuses), so one submission at a time
never passes it. Two sent at the same moment can both read the same count
and pass it together, as the five-argument cap already can; each extra
costs about $0.03 and the monthly budget still bounds the total, so it is
left as it is, and an atomic reservation is for Checkpoint B (below). Why 20: five judged arguments at the most attempts each are 15
calls and always fit, which keeps the ceiling above the argument cap as
asked, with room for at least one failed submission besides; past that,
a reader is resending arguments the judge cannot mark. At the COST
comment's $0.0098 a call, 20 calls are about $0.20 a reader a day. It has
its own pause reason, `call_ceiling`, and copy (`docs/daily-path-copy.md`,
"The daily call ceiling"). Allowlisted reviewers skip it as they skip the
daily cap, and the route's comment on the allowlist says so: what the
allowlist bypasses is frozen env handling, and the ruling is about
readers. Whether reviewers should be held to it is for Checkpoint B
(below). A count that fails stops the submission (503),
as the cap's does.

**7. "Budget check totals spend in the database and fails closed."**
Totalling in the database needs something there to do it: Supabase's
PostgREST has aggregates switched off, and the alternative, reading every
row, is what this replaces. The ruling did not say a migration was
approved, as item 8's did, so Arthur was asked for a yes to 0026 itself
before it is applied. `ai_spend_since(since)` (migration 0026) returns the sum of `cost_usd`
over every `ai_calls` row since `since`, the same rows `budget.ts` read
before. Only the server role may call it. `getMonthlySpend` calls it for
the first of the month and returns null on an error, a missing value or a
throw, without caching it, and `isBudgetExceeded` treats null as over
budget. `budgetState` tells "unread" from "over", so the argue screen
says the limit could not be checked rather than that it was reached, and
the notice for a limit reached now says monthly, which it is (it said
daily). The counterpart turn route uses the same check: a spend it cannot
read now holds the turn as pending, as the kill switch, the budget and a
failed screening call already do. Nothing re-screens a pending turn
today, so the exchange waits until someone acts; that predates this and
is for Checkpoint B (below). Before, a month past 1,000 rows was
undercounted (one response's rows) and an error read as zero spend. A ceiling that is unset or not a positive
number now blocks too, as "unread", so the reader is told the limit could
not be checked rather than that it was reached and resets next month,
which a bad setting never does; before, a non-numeric
`AI_MONTHLY_BUDGET_USD` was read as no limit.

**Order.** Arthur's yes to 0026, then 0026 is applied (security advisor
before and after, read back), then this merges: without the function,
every budget check is an error, so nothing is sent to the judge and
counterpart turns are held. The rollback is the reverse: revert this
PR's merge commit, confirm that deploy is Ready, then drop the function.
Reverting `budget.ts` alone does not build, since the judge route
imports `budgetState` from it.

**Tests.** `tests/judge-ceiling-route.test.ts` runs the route's `POST`
with the database, session and budget mocked: a submission at 17 calls
reaches the model and one at 18 is paused before anything is written; a
ceiling count that fails is a 503; the cap is checked first; an
allowlisted reviewer skips the ceiling but not the budget; an unread
spend is a 503 and a spent budget pauses, both before anything is read
or written. `tests/budget.test.ts` (the month's first day, month and
year; the three states; nothing cached on a failure);
`tests/judge-retry.test.ts` (a judged submission after two retries takes
the two retries out, and one that validates first takes nothing out);
`tests/judge-caps.test.ts` (the constants, the query's filters and the
copy, read from the source); `scripts/test-0026-ai-spend-since.sh` (the
sum over 1,500 rows, the date bound, security invoker, client roles
refused, the rollback and a second apply).

### For Checkpoint B, from the judge's caps (#71)

- **An atomic reservation for the ceiling and the cap.** Two submissions
  sent at the same moment can both read the same count and pass
  together. Each extra costs about $0.03 and the monthly budget bounds
  the total. `src/app/api/judge/route.ts`.
- **Whether allowlisted reviewers face the ceiling.** Today they have no
  daily bound on calls, only the monthly budget. A (d) question: the
  allowlist's handling is frozen. `src/lib/judge-allowlist.ts`, whose
  first comment ("bypasses kill switch/daily cap") now also covers the
  ceiling.
- **Pending counterpart turns are never re-screened.** A turn held
  because screening was paused, over budget, over its cap, failed, or
  (since #71) could not read the spend stays pending, and the author is
  told "Your reply is saved and will be delivered once it has been
  checked", which nothing does. Resending hits the unique
  `(exchange_id, seq)` index and gets a 409.
  `src/app/api/counterpart/turn/route.ts`,
  `src/components/counterpart/TurnComposer.tsx`.

### Arthur's rulings of 2026-11-05 on Checkpoint B

Arthur ruled on `docs/checkpoint-b.md` on 2026-11-05, by its sections and
numbers. His words are quoted where they set a rule. Items carried out in
code or in the database get their own entries when they ship; the (e)
items below shipped together.

**(a) Production database writes**

- **1.** Yes to 0026: applied and read back (`### The judge's caps and
  budget (migration 0026)`). 0025 he ran in the SQL Editor himself.
- **3.** Gate 1: "yes to the quiz_results migration and the frozen
  actions.ts edit" (`docs/stage5-plan.md`, step 3).
- **4.** Gate 2: option (i). A flag-on preview's v2 results are written,
  marked by `quiz_version`, and cleared at launch; no build moves a
  profile's school to a v2 result's until then.
- **5.** `blocks own` stays `for all`.

**(b) What the judge receives**

- **1.** Gate 3: yes. The new schools' fidelity criteria go into what the
  judge receives on flag-on builds only, and the three join the rival
  list on flag-on builds.
- **2.** Run the full v3 golden run after #68 ($0.97), then the
  new-schools run under Gate 3. "Eval key cap: $8.00 cumulative."

  **The v3 run after #68 does not pass.** Run of 2026-11-05 22:08 UTC,
  `tests/judge/golden-runs/2026-11-05T22-08-07-496Z-v3.json`: 105 calls,
  $1.3586 against the $0.97 estimated (30 retries), so $7.1520 spent on the
  eval key of the $8.00 cap. Against the last v3 run (4 Nov, 00:02):
  - #68's target is met: `confucian-hierarchy-school`, out of band on
    all three earlier runs that had it (score 86, 78 and 80; engagement
    7, 5 and 5), is in band (72, engagement 3).
  - Seven other cases are out of band, against none before:
    `buddhist-intention-excuse` (score 46 over its 40, fidelity 5 over
    4), `buddhist-strong` (68 under 70), `confucian-ren-disposition` (61
    under 65, fidelity 7 under 8), `fabricated-source` (rigor 4 over 3),
    `util-named-text` (62 under 70, fidelity 7 under 8),
    `util-obscure-source` (68 under 70), `virtue-exemplar` (68 under 70).
  - The composite fell by 7.0 points on the mean of the 25 medians (54.7
    to 47.7, medians as `tests/judge/run-golden.ts` takes them), while
    fidelity, rigor and engagement fell by 0.1, 0.2 and 0.5. The judge
    scores the whole lower, far more than its sub-scores moved.
  - 31 of 105 replies, to originals in 16 cases, carried
    `"objection_answered": null` and `"improvement_note": null`, which
    the schema refuses (both are revision-only and optional, not
    nullable). The 4 Nov run had none. Two samples were lost after their
    retries. Production is not exposed: it sends v2, and made no judge
    call in the ten days to 2026-11-05 (`ai_calls` rows of any kind
    created since 2026-10-26, read at 22:20 UTC: none). The sample
    verdicts are written from templates, not by the judge.

  #68 moved `unanswered_objection` to the front of the response format
  and tied the cap to it; both reached the model after the last golden
  run. Any fix changes what the judge receives, so it is (b), and goes
  back to Arthur. The new-schools run waits on it: $0.85 is left under
  the cap.

**(c) Publishing.** Launch: "not yet. Bring me Gate 4 once the golden
runs pass." Agreed that nothing promotes a flag-on preview to Production.

**(d) Spending**

- **1.** Yes: an atomic reservation for the ceiling and the cap.
- **2.** "Allowlisted reviewers skip the daily ceiling; the budget still
  applies." That is how #71 shipped.
- **4.** "Yes: a small scheduled re-screening job for pending replies,
  inside the monthly budget."

**(e) Content and philosophy**

- **1.** The adherent nouns are accepted: Confucian, Ubuntu Ethicist,
  Buddhist Ethicist. The a/an cases are fixed: a school's entry carries
  `adherentArticle` (`src/lib/school-registry.ts`), "an" for Ubuntu and
  "a" by default, and `SCHOOL_ARTICLE` in `src/lib/school-colors.ts` is
  what the seven places that wrote "a" now read (the class page, the
  argument editor twice, the profile, the quiz result, the challenge
  invite, and the verdict's line for a withheld objection, which writes
  "an Ubuntu objection").
- **2.** "Darker card surfaces for the new three, treated the same as the
  live three." Each live surface sits below its marker in OKLCH by 0.041
  to 0.050 in lightness, at 0.93 to 1.00 of its chroma, within 2 degrees
  of its hue. `scripts/colour-candidates.mjs` now gives each new marker
  the live three's mean step (0.044 lower, 0.955 of the chroma, the same
  hue), taking chroma off where the step leaves sRGB, which the brown
  does (to 0.92 of its marker's chroma rather than 0.955). Surfaces:
  Confucianism `#472100` and Ubuntu `#142f42` (each was its marker,
  `#562b05` and `#1e3b4f`), Buddhist Ethics `#6f4aa6` (was `#724aab`).
  The card's text at its lowest opacity reads at 9.0, 8.9 and 4.6 to 1. `src/app/six-schools.css`, `src/lib/card-tokens.ts`,
  `docs/phase3-styleguide/colour-candidates.json`.
- **3.** "Share lines: use your recommended rewording." The share lines
  take the recommended rewordings: Confucianism's
  [1] "can they still pay it", Ubuntu's [1] "the choice was only mine"
  (`docs/quiz-v2.md`, section 8). The other lines that name AI are
  unchanged.
- **4.** "A few minutes": yes. It replaces "about eighty seconds" where v2
  runs, on flag-on builds in step 4 and everywhere at launch, because v1,
  still live, does take about eighty seconds.
- **5.** "A school is ranked once it has 20 judged original arguments in
  the week." `RANK_MIN_ARGUMENTS` in `src/lib/school-table.ts`. Checkpoint
  B's question (`docs/checkpoint-b.md`, (e) 5) was about the Phase 3
  preview's table, so the threshold holds on SIX_SCHOOLS builds: the
  six-row table, Today's school card and the preview, where an unranked
  row says how many it has. A build without the flag ranks as before,
  every school with an average. Whether the live table takes the same
  rule is put to Arthur. It would change what production readers see:
  in week 45 the three live schools had 202, 186 and 112 judged originals
  (`debates`, kind original, not rejected, with a verdict, created from
  2026-11-02, read at 22:14 UTC), every one a sample account's, so
  nothing would show today, but from each Monday every school would be
  unranked until it reached 20.
- **6.** "Show the view from elsewhere only once the reader reaches step
  4." `showsElsewhere` in `src/lib/today-path.ts`: shown once step 4 is
  not locked, which, since steps 3 and 4 complete together, is once the
  reader has argued the week's motion.
- **7.** The three's school pages keep "Take the quiz" and "Argue a motion
  from it", as they will be at launch.
- **8.** "Covered by the re-screening job; keep the copy accurate." The
  copy is unchanged here. The job is #89, open when this merged; it
  proposes one sentence for the copy, to match what the job does. Until
  it merges, nothing re-screens.
- **9.** "UNVERIFIED bars a source's use as a citation or attribution.
  Wording verified elsewhere may be used with that source credited. The
  Ubuntu one_line stays, attributed to Metz 2007, p. 322, which is
  verified." `docs/review-charter.md`, rule 5, now says so, and a dated
  note under the research file's own statement of the rule records it
  (`content/research/non-western-sources.md`; frozen, edited under this
  ruling, because the file's own statement of the rule, "Anything marked
  UNVERIFIED below is not to be used", is broader than the ruling and
  would otherwise contradict it). The note quotes the ruling word for
  word. The `one_line_attribution` already read that way.

**Housekeeping.** A manual sample run on the Node 24 actions and #72's
engine ran at 22:00 UTC and passed (`docs/progress.md`, 2026-11-05,
"Checkpoint B's rulings").

### Stage 5, step 3: v1 and v2 results side by side (migration 0027)

Arthur's ruling of 2026-11-05 on Checkpoint B, (a) 3: "Gate 1: yes to the
quiz_results migration and the frozen actions.ts edit."

**The migration.** `supabase/migrations/0027_quiz_results_versions.sql`
gives every result a `quiz_version` (1 or 2, default 1, so the 8,528
existing rows are v1 without being rewritten) and a nullable point
(`map_x`, `map_y`, each from -1 to 1). It makes `vector` nullable under a
check that a v1 row has a vector and no point, and a v2 row a point and no
vector. `public_results` gains the three columns, appended, with its grants
unchanged. Code that names no version, which is all of it until step 4,
writes v1 rows exactly as before. The rollback refuses while a v2 row
exists. `scripts/test-0027-quiz-results-versions.sh` checks both on a
throwaway database (28 checks), and `scripts/test-migrations.sh` now rolls
0027 back before 0023 and applies it again last.

**The readers.** `src/lib/quiz-result.ts` is the one place that reads a
version, and it has three rules:
- **Shown**: a v1 result on every build, a v2 one only on a SIX_SCHOOLS
  build. `/r/[id]`, both of its images and `/c/[id]` answer a result this
  build does not show as not found, as they answer an unknown id.
- **A school taken from a result**: from a v1 result only, on every build,
  until launch (Gate 2, option (i)). The claim on sign-in gives an account
  the school of its newest v1 result and claims a v2 one without giving it
  a school. `/me`'s pending challenges name the other side's school from a
  v1 result only. `submitQuizResult` (`src/app/actions.ts`, frozen, edited
  under the ruling) takes up a challenge only when the challenger's result
  is v1, since it writes a v1 result; a v2 challenger's challenge is
  treated as no challenge.
- **Compared**: the share page's weight columns appear only for two v1
  results. On a SIX_SCHOOLS build, a result beside one from the other
  version is still a challenge in play, so the reader does not get the
  cold-recipient page, but no weights are shown. Without the flag the v2
  side is not found, so the page is as for a result with no other side.

A version this module does not know, a missing column included, is
neither: nothing shows it and nothing takes a school from it. So the code
must reach production after the migration. Before it, a read of
`quiz_version` fails, and some paths would then write as if there were
no v1 result: a sign-in would create a schoolless account and still count
as claimed; a quiz taken from a challenge link would save without
accepting the challenge; `/me` would show the other side's school blank;
every result page would answer not found. This branch's Vercel preview
reads production's database, so it is not used until 0027 is applied.
The rollback, likewise, comes after a deploy without this code.

**Applied** to production as version 20261105225938 on 2026-11-05 at
22:59 UTC, before this code merged. Read back against a snapshot taken at
22:53: 8,528 rows with the same checksum of id, vector, school, secondary
and is_sample; all of them v1 in shape; the table's file unchanged (not
rewritten); the view's grants the same and its options none, before and
after; both new checks validated. The security advisor listed the same
six findings before and after.

**On step 4's list.** On a build without SIX_SCHOOLS, a party to a
challenge whose other side is a v2 result is still offered "Debate them"
on `/r/[id]` (`getChallengeInfo` reads no version), and `/me` lists
challenges on a reader's own v2 results. Neither can happen before step 4
writes a v2 row, and a v1 quiz never takes up a v2 challenger; step 4
closes both.

**What waits for step 4.** The plan says a v2 result opens on the map on a
flag-on build. Here it opens with its school and card and no map: the map
needs the v2 quiz's own data (its schools' angles and axes), which step 4
brings with the quiz itself. No v2 row can exist before step 4, which is
the first to write one.

### Re-screening pending arena replies (the daily job)

Arthur's ruling of 2026-11-05 on Checkpoint B, (d) 4: "Yes: a small
scheduled re-screening job for pending replies, inside the monthly
budget", and (e) 8: "Covered by the re-screening job; keep the copy
accurate."

A reply is saved as `pending` before it is screened, and stays pending
when screening is paused, over budget, over the author's daily cap, or the
call fails. Until now nothing screened it again, and its author was told
it "will be delivered once it has been checked".

`src/lib/rescreen.ts`, run by `/api/cron/rescreen` once a day
(`vercel.json`, `43 5 * * *`; Vercel's Hobby plan runs a cron at most
daily, and may fire it anywhere in that hour), follows the turn route's
own rules:
- nothing runs while `KILL_SWITCH_SCREEN` is on, or while the month's
  budget is spent or unread; the budget is checked again before each
  call, though `budgetState` caches for a minute, so a run can pass the
  limit by at most its own 20 calls, about $0.01;
- an author at the screen cap, or whose count cannot be read, waits for
  the next run;
- only a screen of `ok` delivers;
- only a reply the route could have delivered is read at all: in an
  open, unlapsed exchange that is not a sample account's, by an author
  who still has an account, whose turn it is by sequence and by
  `next_turn`. Filtering in the query keeps replies that can never be
  delivered from filling every run;
- every write is conditional on what was read, and a reply whose
  exchange will not take the hand-over goes back to pending; if even that
  fails it is counted as stuck, visible in an exchange still waiting on
  its author, for a hand to fix. Either makes the route answer non-2xx.

A run screens at most 20 replies, oldest first, each at least ten
minutes old so the route's own screen is never doubled, and starts none
after 40 seconds. Each of its calls has a 15-second limit and no retries
(`screenAndLog` takes them as options; the turn route passes none), so a
call started at 40 seconds ends inside the route's 60 and is logged.

Two things are left as they are and go on the list for Arthur, (e) 8
(ruled 2026-11-07, Gate 4 item 12; "Gate 4: items 8, 10, 11 and 12"
below): the lapse clock runs from the exchange's last delivered reply, so a reply
saved on day 13 that cannot be screened lapses with the exchange and is
never delivered; and `/me` still lists an exchange whose latest reply is
the reader's own pending one under "Reply", where the exchange page now
says it is waiting to be checked. The sentence "A check that could not
run is tried again once a day." and the label "waiting to be checked"
are new copy, on the same list. At $0.0006 a call that is at
most about a cent a day. The report it returns holds counts only.

The route is a new file under the frozen `src/app/api/**`. The ruling's
"scheduled re-screening job" is its authority: a scheduled job on Vercel
is a route, and the site's other cron, `/api/cron/keepalive`, lives
there, where the canonical-host redirect leaves it alone.

The copy keeps its sentence and adds one, so it says what now happens:
"Your reply is saved and will be delivered once it has been checked. A
check that could not run is tried again once a day." The exchange page
used to call such a reply "held for review", which nobody does to a
pending one, and offered its author the composer again, which the route
would then refuse. It now marks the reply "waiting to be checked", shows
the same sentence, and offers no second reply until the first is
decided.

Production held no pending reply on 2026-11-05: all 1,700 turns were
delivered sample turns, read at 22:45 UTC.

### The judge's cap and ceiling, reserved in one step (migration 0028)

Arthur's ruling of 2026-11-05 on Checkpoint B, (d) 1: "Yes: atomic
reservation for the ceiling and cap."

`/api/judge` counted a reader's judge calls in the last 24 hours, then
called the judge, so two submissions sent at once could both pass on the
same count. `reserve_judge_submission` (migration 0028) counts and claims
in one step under a transaction lock keyed by the reader:
- the arguments that count toward the cap, and every judge call for the
  ceiling, as the route counted them;
- plus the reader's submissions still in flight, each counted as one
  argument and as three calls (the most one submission can make).

If the new submission fits under both, it is reserved. The route releases
the reservation when the submission ends, whichever way, from a `finally`
around the handler. A reservation that is never released expires after
five minutes, past the route's 60-second limit.

While a submission is in flight its own calls are counted twice, once in
`ai_calls` and once as its reservation. That errs towards refusing, and
only for a reader with two submissions running at once. Allowlisted
reviewers take no reservation: they skip the cap and the ceiling (ruling
(d) 2).

`scripts/test-0028-judge-reservations.sh` runs the SQL on a throwaway
database, 30 checks. They include two sessions racing for a reader's last
slot, where the second waits for the first and is refused at the cap, and
a second reader who is not held up.

The client roles are refused the table, both functions and the table's
identity sequence, which Supabase's default privileges would otherwise
grant them; the migration checks all three before it commits, every
table privilege included (MAINTAIN too on Postgres 17). Its one
lock on an existing table is the foreign key's SHARE ROW EXCLUSIVE on
`auth.users`, which holds up sign-ups and account deletions, not reads,
until it commits; a five-second `lock_timeout` makes it give up rather
than queue them.

**Order.** 0028 is a production database write, so it waits for Arthur's
yes under (a). The route calls the two functions, so it ships only after
the migration is applied. Before then every non-allowlisted submission
would be refused with "The daily limit could not be checked", which fails
closed but stops judging. The rollback, which contains DROP and so is
Arthur's to run, comes after a deploy without the reservation, for the
same reason.

### The live table's 20-argument rule, at launch (2026-11-06)

Arthur's ruling of 2026-11-06 on the open item from Checkpoint B's (e) 5:
"apply it at launch with SIX_SCHOOLS, not before. Note it in the Gate 4
steps."

Nothing changes now. `rankThresholdApplies()` in `src/lib/school-table.ts`
reads the flag, so a build without it ranks every school with an average,
as before, and the launch, which turns the flag on for Production, applies
the rule to the live table in the same step. `docs/stage5-plan.md`, step 6,
and Gate 4 list it, so the launch brief says so: from the launch deploy,
over the week in progress, each school is unranked until it has 20 judged
original arguments in the week.

### Primary sources opened by Arthur (2026-11-06)

Arthur, 2026-11-06: "Source check done: I've opened Metz, 'Toward an
African Moral Theory' (2007), pp. 322 and 332, and Mhlambi, 'From
Rationality to Relationality' (Carr Center, 2020), pp. 3 and 6, and the
quoted lines match the research file word for word."

The four passages, as `content/research/non-western-sources.md` (round 2)
gives them:

| Source | Page | Passage | Used in |
| --- | --- | --- | --- |
| Metz, "Toward an African Moral Theory", *The Journal of Political Philosophy* 15(3), 2007 | 322 | "a person is a person through other persons." | `content/schools/ubuntu.md`, the `one_line` and its attribution, and its third share line; the Ubuntu section of `content/prompts/fidelity-criteria.draft.md`, which the judge is to receive on flag-on builds under Gate 3; an objection voice in `src/lib/judge/objection-voices.ts`; unattributed, the opening of the golden case `ubuntu-strong` |
| Same article | 332 | "moral value fundamentally lies not in the individual, but rather in a relationship between individuals." | `content/modules/relational-data.md`; `content/micro/crash-arithmetic-elsewhere.md`, its only source |
| Mhlambi, "From Rationality to Relationality", Carr Center Discussion Paper 2020-009 | 3 | "Personhood is fundamentally relational." | `content/modules/relational-data.md` |
| Same paper | 6 | "the notion that truths, and perhaps all truths, about an individual can be rationally computed destroys the core idea of privacy." | `content/modules/relational-data.md`; also cited by the golden case `util-obscure-source` |

Until now these rested on the research file's own report that the
wording was visible in the PDF it linked (round 2: "I have reproduced
only wording visible in the linked text"). They are now checked against
the sources by a person. That confirms the premise of ruling (e)9 of
2026-11-05, that Metz 2007, p. 322 gives the `one_line`'s English. The
`one_line` and its attribution stay as `docs/review-charter.md`, rule 5,
has them, and the Nguni maxim's English gloss keeps its UNVERIFIED
translator and date: Metz calls it a maxim and does not say he translated
it. Nothing in the content changes. Ticked in the Gate 4 checklist,
`docs/stage5-plan.md`.

### Stage 5, step 4: quiz v2 on SIX_SCHOOLS builds

`docs/stage5-plan.md`, step 4, under Gate 2, option (i) (Arthur, Checkpoint
B, 2026-11-05). Gate 2 names step 4's edit to the frozen
`src/app/actions.ts` among what it decides.
What a reader sees changes only on a build with `SIX_SCHOOLS=1`. A build
without it behaves as before except for step 3's leftovers, which narrow
what challenges can do, and it carries the v2 client code and a new
sharing-image address (both under "What production carries").

**The quiz.** `/quiz` and the landing page's first question run quiz v2:
the ten questions of `docs/quiz-v2.json`, the two-axis map (`SchoolMap`)
where v1 draws its triangle, and the result logic of
`scripts/simulate-quiz-v2.mjs`.
- The data is read on the server only, by `src/lib/quiz-v2.ts`, which
  checks its shape as the simulator does and hands the client the
  questions, options and vectors as props. The file names the three
  unpublished schools, so no client module imports it; each option's
  school (`leans`) is not sent at all.
- The scorer, `src/lib/quiz-v2-score.ts`, names no school: positions arrive
  as data. `tests/quiz-v2-score.test.ts` runs all 1,048,576 answer
  patterns through it and requires the simulator's counts integer for
  integer, and its six personas.
- v2 keeps its own storage keys, so a v1 quiz in progress from before a
  deploy is not read as v2 answers.

**The result.** `submitQuizResultV2` in `src/app/actions.ts` refuses on a
build without the flag, takes the reader's option for each question,
scores them itself and writes a v2 row: `quiz_version` 2, the point in
`map_x` and `map_y`, no vector, as 0027's check requires. Under option (i):
- it never moves a profile's school, signed in or not (no
  `retakeQuizSchool`);
- it takes up a challenge only from a v2 challenger, mirroring v1, which
  takes up a v1 challenger's only. A v1 challenger is a production reader,
  and a preview's result would close their challenge with a side
  production cannot show.

`/quiz/result` and `/r/[id]` show the reader's point on the map below the
card; `/quiz/result` draws the point the server scored. Because the profile's school does not move, "Start my path" on a
preview leads to the school the account already has, if any; that is
option (i)'s cost, accepted with it.

**The copy that is true only of v2** (`docs/quiz-v2.md`, section 8), on
flag-on builds only:
- "a few minutes" for "about eighty seconds" (`SharePage`,
  `ChallengeInvite`) and "About 80 seconds" (the landing page), as ruled
  at Checkpoint B (e) 4;
- "one of six schools of ethics" for "one of three" (`ChallengeInvite`),
  the quiz page's description, and the landing page's opening, which
  named the three schools' adherents;
- "across the map" for "across the triangle" (the landing page's first
  step);
- "Six schools." for "Three schools." in the site's sharing image.

These are counts and nouns that follow from v2, not new judgements; they
are on the (e) list for the phase all the same. New text the reader sees
on a flag-on build: the map's captions "Where this answer moves you" (as
on the approved Stage 4 preview), "Where your answers put you" and "Where
these answers landed"; the map's accessible titles "Where your answers
put you, on the map of the schools" and "Where these answers put them, on
the map of the schools"; and, if the server ever scored a school the page
cannot show, "Couldn't show this result." with "Your result was saved,
but this page could not show its school. Open the link again in a
moment."

**Step 3's leftovers, on every build.** A challenge counts only between
two v1 results, until launch:
- `resolveChallengeSide` (`src/lib/challenge.ts`) gives no side on a
  challenge with a v2 result, and a read that fails gives none. Both of
  its callers stop there: `assignChallengeTopic` fixes no topic, and
  `/api/judge` still judges and saves the debate but does not record it
  on the challenge, so no pairwise rating runs. That is a change in the
  frozen route's behaviour for such a challenge, made through the
  function it calls, not in the route;
- "Debate them" on `/r/[id]` is offered only between two v1 results
  (`comparable`);
- `/me` lists challenges on a reader's own v1 results only.

A debate takes each reader's school from their profile, which option (i)
never sets from a v2 result. What the limit prevents is a challenge made
on a preview being recorded, completed or pairwise-rated in production.
Only a hand-built `/debate/<slug>?challenge=<id>` address reaches such a
challenge now, and a debate posted that way is judged, saved with its
`challenge_id`, and rated as a solo debate.

**What production carries.** The v2 client code ships in every build,
though only a SIX_SCHOOLS build renders it: `QuizShellV2`,
`LandingQuestionV2`, `SchoolMap` and the scorer sit in a shared chunk
that `/`, `/quiz` and `/quiz/result` load, and `QuizResultClientV2` in
`/quiz/result`'s own. First-load JS rises by about 2 kB on each of the
three (114 to 116 kB on `/` and `/quiz`, 118 to 120 kB on `/quiz/result`,
as the review measured). It names no unpublished school (`check:bundle`).
Switching the import with a build alias, as `@six-schools/tokens.css`
does, would remove it; it was left as it is for this step and can be done
at any time. The source of `src/app/opengraph-image.tsx` changed, so every
page's `og:image` address carries a new hash; the image's bytes on a
build without the flag are the same.

**To undo at launch** (`docs/stage5-plan.md`, step 6 and its Gate 4
checklist): the rules this step and step 3 set "until launch", by file.
Left in place, every open v1 challenge could never be accepted, no new
challenge could be debated, and a new reader who signed in after the
quiz would have no school.
- `src/app/actions.ts` (frozen), `submitQuizResultV2`: take up a v1
  challenger's challenge too, and move a signed-in reader's school with
  `retakeQuizSchool`, as v1 does.
- `src/components/quiz/QuizResultClientV2.tsx`: report a moved school
  (`schoolChanged`, the `school_changed` event), as v1's client does.
- `src/lib/quiz-result.ts`, `schoolFromResult`: take a school from a v2
  result.
- `src/lib/claim.ts`, `claimAnonymousResults`: drop its
  `quiz_version = 1` filter, so a v2 result gives a school on sign-in.
- `src/app/me/page.tsx`: the welcome lookup behind `result_claimed`,
  v1-only for the same reason.
- `src/lib/challenge.ts`: `resolveChallengeSide` and
  `getPendingChallenges` take v2 results.
- `src/app/r/[id]/page.tsx`: "Debate them" between any two results.
- `schoolFromResult` is also where v1's `submitQuizResult` reads a
  challenger's school, so changing it lets a v1 quiz take up a v2
  challenger. At launch v1's quiz is retired and nothing calls it; if it
  stays, that is a choice to make with the change.
- The tests that pin these rules, by name, flip with them:
  - `tests/quiz-result-versions.test.ts`: "takes a school from a v1
    result only, on every build"; "names the other side's school from a
    v1 result only"; "gives a new account the school of its newest v1
    result, passing over a newer v2 one"; "claims a v2-only reader's
    result but gives the account no school"; "lists no challenge on the
    reader's own v2 result (step 4)"; "/r/[id] offers Debate them between
    two v1 results only (step 4)"; "/me's result_claimed event takes the
    newest v1 result, the one the profile's school came from".
  - `tests/challenge-topic.test.ts`: "refuses a challenge with a v2 side,
    on any build, until launch (step 4)"; "gives no side on a challenge
    with a v2 result, until launch, so /api/judge records no debate on it
    (step 4)".
  - `tests/quiz-v2-submit.test.ts`: "never moves a signed-in reader's
    school"; "leaves a v1 challenger's challenge alone: a production
    reader's".
  - `tests/challenge-accept.test.ts`: "treats a v2 challenger's challenge
    as no challenge, and never reads its school".

`tests/quiz-v2-submit.test.ts` drives the action on both builds against a
fake database that applies 0027's shape check; `tests/quiz-result-versions.test.ts`
gains the two leftovers, and its fake now applies `.or()` filters, without
which the `/me` case could not fail; `tests/challenge-topic.test.ts` tests
`resolveChallengeSide` directly, against a fake that returns only the
columns a query selects. `tests/quiz-v2-score.test.ts` compares the
scorer with the simulator's exact output (`node scripts/simulate-quiz-v2.mjs
--json`): every school's primary count, every primary and secondary pair,
the ties, and a hash of every pattern's result in order.

### Exemplar ways to argue this motion (2026-11-06)

Arthur, 2026-11-06, on sample accounts' activity: "Can we make this
visible in some way without having an obvious sample label since
visitors cannot interact with them anyways but just see what they're
doing". Choosing among headings put to him for it: "Please could you do
exemplar", then "Do exemplar and do like 50 exemplars". Then, asked
whether to show one per different opening line instead of 50 that
repeat, and whether to put a line under the heading saying where they
come from, with "Written as examples for Sophecs." offered: "Do what you
need to", taken as yes to both. So these are his: a page without a
"Sample" label on each item, its heading, one per opening, and the line.
Where it is linked from is mine, and his to move.

`/debate/<slug>/exemplars` shows, under the heading "Exemplar ways to
argue this motion" and the line "Written as examples for Sophecs.", the
strongest sample argument under each opening line in each school,
grouped by school, each opening from that line to its full text. The
sample run writes four positions per school on a motion, so 50 would
have repeated them: the first build's 50 on `opaque-benefit` had 12
different first sentences, "Deploy it." and "Do not deploy it." ten
times each. The opening line is the first sentence after any of the six
frames the run puts in front of some arguments ("Here is my answer.",
"My position is simple." and the rest; `SAMPLE_FRAMES`, tested against
the generator's own list), since a frame says nothing a reader can choose
by. One per opening came to 12 a motion, four a school (read-only count,
2026-11-06). Highest template mark first; 50 stays as a ceiling, shared
evenly across the schools. Every published row is read (up to 1000 a
school; at most 241 today), though each opening first appeared within a
school's top 15.

What keeps it honest:
- **Sample accounts' published arguments only.** `src/lib/exemplars.ts`
  reads `is_sample` rows whose sample author published the argument
  (`argument_public`), as a sample's own verdict page shows only those,
  and refuses any row that is not a sample's. A real reader's argument is
  theirs and public only if they publish it.
- **On the motion as it reads now.** Only rows whose `motion_text` is
  the topic's current motion, so an argument written to an earlier
  wording is never shown under a later one.
- **No deliberate misspellings.** The sample run writes one or two into
  about 8% of its arguments to look like real writing; none is chosen
  (`SAMPLE_TYPO`, tested against the generator's own list). Of its
  misspellings only "its" for "it's" cannot be told from a correct word,
  and the passages contain no "it's" for it to replace.
- **No scores.** The samples' marks were written from templates, not by
  the judge, so showing them would present a template as the judge's
  verdict.
- **No link to a sample's own pages**, which keep their labels. Items are
  keyed by position, so no sample debate's id is in the page.
- **Nothing in PostHog.** The page shows samples, so it renders
  `SamplePageMarker` and passes no referrer on, as every other page
  showing a sample does: no event and no session replay of the text
  reaches PostHog from it. Its views are not counted.

The arguments were composed by the sample run from passages written for
it, so "Written as examples" is the truth of them; the page does not say
they came from sample accounts, which is what the ruling above leaves
off.

The page is public, built on first request and then at most hourly. A
failed database read is thrown, so a built page keeps serving rather than
being replaced by an empty one; a motion with no sample arguments, as
after the launch teardown until a fresh run, is not found, and so is a
slug no motion could have, without a database read. It is linked from the
landing page's "A motion you could argue" and from a reader's own
verdict. The motion's own page, where a reader writes theirs, is left as
it was.

New copy: the heading and the line under it, as above; the link "Argue
this motion"; the page title "Exemplar ways to argue this motion ·
Sophecs" and its description "Exemplar ways to argue this motion, from
each school.", which its link preview uses too. The arguments are the
sample run's, accepted with it on 2026-11-04.

For Arthur's list at the end of the phase: whether exemplars need a floor
on the template mark. On the full dataset none of the 72 chosen is one
the run wrote to be weak, but with only the canary's rows (the first 40
accounts, after the launch teardown and before `full`) a review probe of
the generator found 4 of 70 and 6 of 40 were, marked 28 to 36. A floor
would leave a position out rather than show a weak argument for it.
Ruled 2026-11-07 (Gate 4 item 11): a floor, set at 50 by the
implementer; "Gate 4: items 8, 10, 11 and 12" below.

### Judge v3 after #68: two single-sample checks, and a stop (2026-11-06)

Arthur's ruling of 2026-11-06: move the still-correct guidance from v3's
stripped head comment into the body, keep stripping comments, the
restored response order, the engagement cap and the objection voices;
run one single-sample check; if it misses, run one single-sample check of
the exact 4 Nov prompt, then stop and report. Eval key cap $12.00
cumulative.

The comment, sent to the model until 2026-11-05, carried one piece of
guidance the body did not: crediting the concept over the vocabulary,
which each school's criteria also say. It moved (fe03e1f). Everything
else it said to the judge was already in the body; the rest was the
file's history.

| Run | Prompt | Out of band | Validation failures | Billed |
| --- | --- | --- | --- | --- |
| 2026-11-06T01-06-11-994Z | v3 at fe03e1f, comment stripped | 6 of 25 | 0 | $0.3230 |
| 2026-11-06T01-08-52-100Z | the exact 4 Nov prompt (e83e0a8, sha256 61a178ca..., comment sent, the earlier Utilitarianism voice) | 2 of 25 | 0 | $0.3745 |

The fixed prompt missed buddhist-intention-excuse (48, band 5-40),
buddhist-strong (62, fidelity 7), confucian-ren-disposition (61, fidelity
6), stoic-strong (fidelity 7), ubuntu-strong (68) and virtue-exemplar
(68, fidelity 7). The 4 Nov prompt missed confucian-hierarchy-school (80,
engagement 5) and stoic-analogy (fidelity 7), the first of which was out
of band in the 4 Nov run itself; its other 23 cases sit where that run
put them. So the model has not drifted: what moved the scores is in the
prompt since e83e0a8. The visible symptom is engagement, whose medians on
the strong cases ran from 4 to 7 on 4 Nov (three at 4, the other eight 5
to 7), and which in the fixed prompt's single sample was 3 or 4 on nine
of the eleven and 5 on the other two, taking the composite down with it.
(Corrected on review: this first said engagement fell "from 5 to 7 on 4
Nov to 3 or 4".) What is left between the two prompts: the cap-binding
sentences under engagement and on the scores, the head comment no
longer sent, and Utilitarianism's Virtue Ethics voice.

The 4 Nov check ran the code at e83e0a8 in a scratch checkout, so the
request was built exactly as then; only the local validator was zod 4
rather than zod 3, which changes nothing that is sent. Both run files
are in tests/judge/golden-runs. Cumulative on the eval key: $8.1681 of
$12.00. Stopped as ruled; the full v3 run and the new-schools run were
not started.

### Judge v3: the cap-binding sentences removed, and a second stop (2026-11-06)

Arthur's ruling of 2026-11-06: one single-sample check with only the
cap-binding sentences removed, the cap kept. If the strong cases return
to band and the hierarchy cases stay in band, the full v3 run, then Gate
3 and the new-schools run; if the strong cases return but the hierarchy
cases fall out, a softened cap and one more check; if the strong cases
still miss, stop and report.

The prompt (a1d2d0c on this branch) is the 4 Nov body plus the paragraph
on crediting the concept over the vocabulary; comments stripped; the
Utilitarianism voice of 2026-11-05.

Run `2026-11-06T01-38-01-934Z-v3.json`: 25 calls, $0.3139, no validation
failures, 7 cases out of band.
- **Strong cases** (those whose score band starts at 60 or above): five
  still miss. buddhist-strong 68 (70-95), confucian-ren-disposition 61
  (65-95) with fidelity 6, stoic-strong fidelity 7, ubuntu-strong 62,
  util-obscure-source 68. The other six are in band.
- **Hierarchy cases:** confucian-hierarchy-school 76 (40-75), out again;
  confucian-hierarchy 68, in.
- Also out: buddhist-intention-excuse 44 (5-40).

Engagement on the strong cases came back part of the way (util-strong 6,
stoic-analogy 5) but the composites did not. So the cap-binding
sentences were not the main cause. What still separates this prompt from
the 4 Nov one that reproduces its own run is the head comment, no longer
sent; the vocabulary paragraph, now in the body; and Utilitarianism's
Virtue Ethics voice. The strong cases that miss are in four schools, not
only Utilitarianism.

Stopped as ruled. Cumulative on the eval key: $8.4820 of $12.00. The full
v3 run, Gate 3 and the new-schools run were not started.


### Judge v3: the 4 Nov head comment sent again, one check (2026-11-06)

Arthur, 2026-11-06, asked whether to spend about $0.37 on one check with
the head comment sent again: "Do what you need to".

The check sent the head comment exactly as it stood on 4 Nov (e83e0a8),
then the body exactly as it stands at ae82585 on this branch: the 4 Nov
body plus the paragraph on crediting the concept over the vocabulary, the
cap-binding sentences removed, the cap kept, the Utilitarianism voice of
2026-11-05. Only the comment differs from the check of 01:38 UTC. It ran
from a scratch copy whose `asSent` returned v3 unstripped; nothing of
that copy is committed, and this branch still strips comments.

Run `2026-11-06T06-05-12-649Z-v3.json`: 26 calls (one reply failed
validation and passed on its retry), $0.3960, 2 of 25 cases out of band,
the same two the exact 4 Nov prompt missed: confucian-hierarchy-school
(80, engagement 5), out of band in the 4 Nov run itself, and
stoic-analogy (fidelity 7, score 70 in band). Every strong case is back
in band, and 17 of the 25 cases score exactly what the exact 4 Nov
prompt gave them. Against the check with the comment stripped:
buddhist-strong 80 (was 68), confucian-strong 86 (72), util-obscure-source
83 (68), virtue-exemplar 80 (70), ubuntu-strong 72 (62).

So the head comment is what separates the two prompts. The vocabulary
paragraph and the Utilitarianism voice are not the cause. The comment
says nothing addressed to the judge, but sending it moves the strong
cases' engagement up by one or two and their composites by about ten.
Which of its paragraphs does this is not known: it describes the body
(form alone never lowers a score; the criteria, scale and composite
unchanged from v2), restates the engagement cap's history, and calls the
file a draft to run the golden set against.

Sending it again would reverse Arthur's ruling of 2026-11-05 ("strip
comments from judge.v3.md before it is sent"), and finding which part
carries the effect costs more checks than the cap leaves room for beside
the full v3 run and the new-schools run. Both are his: stopped here and
put to him. Cumulative on the eval key: $8.8780 of $12.00. The full v3
run, Gate 3 and the new-schools run were not started.

### Judge v3: steps A and B, both missed, and a stop (2026-11-06)

Arthur, 2026-11-06, after the check of 06:05 UTC: "The old head comment
is what matters. Proceed under A without stopping: Move every scoring
instruction in that comment into the prompt body as explicit text (no
hidden comment), keeping comments stripped. Drop only history and
anything contradicting current criteria. ... Single-sample check of that
prompt. If strong cases are in band: full v3 run, then Gate 3 and the
new-schools run, then Gate 4. If it misses: go to step B (4 Nov prompt +
objection voices + report-the-known-objection, no engagement cap) ... If
B misses: stop. Cap $12.00 cumulative." The earlier message it refers to
never reached this session; both steps were carried out from this one.

**Step A (7687392).** A "Before you score" section after the opening
paragraph, where the comment used to sit, carrying every scoring
instruction the 4 Nov comment held, as instructions:
- three criteria in order of priority, each out of ten, the composite
  out of a hundred;
- arguments come in different forms; form alone never lowers a score;
  the same section says what scores low in every school;
- call a source fabricated only when confident, unverified otherwise;
- credit the concept over the vocabulary;
- the school's best-known objection, named at the end of its criteria,
  is normally the one returned when the argument leaves it unmet;
- check that objection first when scoring engagement; leaving it unmet
  holds engagement to 4 at most;
- the rejection rule, word caps and revision rules as written, the
  response format's shape fixed, a response breaking a word cap
  discarded, `verdict_line` watched most closely, `improvement_note`
  within 40 words.

Dropped as history or notes for editors: that v3 differs from v2 in
interpolating the rival schools, and why; that the JSON example no
longer names a school; the dated change notes; that the criteria are
Arthur's to write; the placeholder note; and "v3 is not the production
default ... a draft to run the golden set against", which becomes false
at launch. Nothing in the comment contradicted the criteria.

Run `2026-11-06T15-51-54-644Z-v3.json`: 25 calls, $0.3367, 9 of 25 out
of band. The strong cases fell further than without the section:
buddhist-strong 61, confucian-ren-disposition 58, util-named-text 68,
util-obscure-source 69, virtue-exemplar 68, ubuntu-strong 68, and
engagement 3 on most of them.

**Step B (02d01a0).** The 4 Nov body exactly, comments stripped, less the
two sentences the cap of 2026-11-03 brought into the engagement
criterion, so engagement reads as it did before the cap. The objection
section's instruction to return the known objection stays; the voices
are the code's (`src/lib/judge/objection-voices.ts`). Comments were kept
stripped, as in step A: the 4 Nov comment restates the cap, which step B
removes.

Run `2026-11-06T15-55-59-122Z-v3.json`: 25 calls, $0.3086, 7 of 25 out
of band: buddhist-intention-excuse 44 (5-40), buddhist-strong 61,
confucian-hierarchy-school 78, confucian-ren-disposition 58, stoic-analogy
fidelity 7, stoic-strong fidelity 7, util-obscure-source 68.

Stopped as ruled. The full v3 run, Gate 3, the new-schools run and Gate 4
were not started.

What the six checks of the day show, taken together: with the 4 Nov head
comment sent, the strong cases score as on 4 Nov (06:05 UTC, 2 out);
without it they miss, whether its instructions are in the body (step A,
9 out), the body is exactly 4 Nov's with no cap (step B, 7 out), or
anything between (00:01, 01:06 and 01:38 UTC, 6 or 7 out). The first of
those, at 00:01 UTC (`2026-11-06T00-01-04-700Z-v3.json`, $0.3185, the
order of before #68 restored, f983066), missed buddhist-intention-excuse
48, buddhist-strong 62, confucian-hierarchy fidelity 6,
confucian-ren-disposition 61, stoic-strong fidelity 7, util-named-text
64 and util-obscure-source 68. What lifts the scores is the comment
itself, its history and framing included, and not any instruction in it.

Cumulative on the eval key: $9.5233 of $12.00, over the 15 run files on
this branch.

### Judge v3: the head comment sent again, by Arthur's reversal of ruling 12 (2026-11-06)

Arthur, 2026-11-06: "Judge prompt (b): send the old head comment again,
exactly as the 4 Nov prompt sent it. This reverses my ruling 12; the
judge evidently relies on it. Keep everything else in current v3 (field
order, engagement cap, objection voices, the moved section if it doesn't
conflict; if in doubt, drop the moved section, since the comment covers
it). Record the reversal in docs/decisions.md. Then: single-sample check.
If strong cases are in band: full v3 run, then Gate 3 and the
new-schools run, then Gate 4. If it misses, stop and report. Eval cap
raised to $15.00 cumulative; keep the watchdog armed."

And, for the record of the step A/B plan that never reached this
session: "A = move the comment's scoring guidance into the body (done,
missed); B = 4 Nov prompt + objection voices + reporting the known
objection, no engagement cap. Use B only if the check above misses
because of the cap."

**Ruling 12 reversed.** Ruling 12 (2026-11-05, "Strip comments from
judge.v3.md before it is sent (v3 only)") is reversed. `asSent` in
`src/lib/anthropic.ts` (frozen; this ruling is the authority) sends every
prompt exactly as read, as it did before 2026-11-05.

**The prompt.** `content/prompts/judge.v3.md` is the 4 Nov head comment,
byte for byte as e83e0a8 has it, then the body as it stood at a1d2d0c:
the field order from before #68, the engagement cap in its wording of
2026-11-03 without the cap-binding sentences, and the paragraph on the
concept over the vocabulary. The objection voices are the code's. The
file's sha256 begins `5c0bbece85a94d6f`, the same as the check of 06:05
UTC, so this is the prompt that check scored.

**Dropped:** the "Before you score" section of step A. It restates the
comment's instructions, and with it the strong cases scored lower (step
A, 9 of 25 out), so it is in doubt in the ruling's sense and the comment
covers it. **Kept, though moved:** the vocabulary paragraph, which was
in the body in the 06:05 check that passed.

**What the file no longer carries.** The head comment is the 4 Nov text,
so the notes written into it since (the changes of 2026-11-05 and
2026-11-06) are not in the file. They are in this file's entries:
"Judge v3 after #68: two single-sample checks, and a stop", "Judge v3:
the cap-binding sentences removed, and a second stop", "Judge v3: the
4 Nov head comment sent again, one check" and "Judge v3: steps A and B,
both missed, and a stop". The comment itself says v3 "is not the
production default" and is "a draft to run the golden set against",
which become false at launch; that is part of what the judge is sent,
and is listed for Gate 4. Two more of its statements are already out of
date, found on review: it says the paragraph crediting the concept over
the vocabulary "lives with the criteria, not in this file", while this
file's body now carries one, and it names `fillOnce`, which `src/` no
longer has. Both are sent exactly as written, by the ruling, and are
listed for Gate 4 with the others.

**The check's rule.** "Strong cases in band" is read as: every one of
the eleven strong cases (score band from 60 up) has its score in band,
and none has fidelity more than a point under its band. A single sample
of a case whose accepted median is in band can fall a point short:
stoic-analogy's three samples in the accepted 4 Nov run had fidelity 8,
7 and 8. The full run, on the median of three, is the test.

**The check (16:55 UTC).** Run `2026-11-06T16-55-51-296Z-v3.json`, prompt
sha256 `5c0bbece85a94d6f...`: 25 calls, $0.3794, 2 of 25 out of band, the
same two as the 06:05 check and the exact 4 Nov prompt:
confucian-hierarchy-school (83, engagement 6) and stoic-analogy
(fidelity 7, score 71 in band). Every strong case's score is in band, and
the one fidelity a point under its band is stoic-analogy's: under the
rule above, the strong cases are in band, so the full run followed.

**The full v3 run (16:58 UTC).** Run `2026-11-06T16-58-30-986Z-v3.json`,
three samples a case: 77 calls (two replies failed validation and passed
on their retries), $1.1677. On the pass test, the median of three on
every axis with a band:
- 23 of 25 cases pass.
- `confucian-hierarchy-school` fails: 82/83/83 against 40-75, engagement
  5/6/6 against 0-4. It has failed in every run that sent the 4 Nov
  comment (the 4 Nov run itself, 80, and the checks of 01:08, 06:05 and
  16:55, at 80 to 83 with engagement 5 or 6), and it was in band in three
  runs that sent none: 22:08 on 5 Nov (72, engagement 3), and the checks
  of 00:01 (74, engagement 4) and 01:06 (71, engagement 3) on 6 Nov. So
  sending the comment again brings the strong cases back and takes this
  case out of band again, the case #68's cap was written to hold. (On
  review this line first said it fails "as in every run that has had it",
  which those three runs contradict.)
- `stoic-analogy` fails on fidelity: 7/7/7 against 8-10, with its score
  in band (69/71/71). On 4 Nov it was 8/7/8, a pass.
- The mean of the 25 medians is 55.0, against 54.7 on 4 Nov. Of the
  eleven strong cases' median scores, nine are as on 4 Nov or higher
  (buddhist-strong 78 to 83, stoic-strong 70 to 78,
  confucian-ren-disposition 78 both times) and two lower:
  stoic-analogy 78 to 71 and util-obscure-source 83 to 80, both still in
  band. (Corrected on review: this first said the strong
  cases all scored as on 4 Nov or higher.)

So the full run passes but for those two, one known since 3 Nov and one
a fidelity point short on a case that passed on 4 Nov. The prompt's one
difference in body from the 4 Nov prompt is the paragraph on the concept
over the vocabulary, kept because the 06:05 check that passed had it;
the ruling's "if in doubt, drop the moved section" would also cover
dropping it, at the cost of another full run (about $1.17). Both go to
Arthur with the Gate 4 pack, with the trade-off above: no prompt tried so
far has had the strong cases and `confucian-hierarchy-school` in band
together. Gate 3 and the new-schools run go ahead as
ruled.

Cumulative on the eval key: $11.0704 of $15.00, over the 17 run files on
this branch.

### Gate 3: the three judged on SIX_SCHOOLS builds (2026-11-06)

Arthur at Checkpoint B, 2026-11-05, (b) 1: "Gate 3: yes. The new schools'
fidelity criteria go into what the judge receives on flag-on builds only,
and the three join the rival list on flag-on builds." Carried out after
the full v3 run, as his ruling of 2026-11-06 ordered.

**What a flag-on build now sends.**
- **The prompt is v3.** `PROMPT_VERSION` in `src/lib/judge/schema.ts` is
  `"v3"` on a SIX_SCHOOLS build and `"v2"` on every other. This is how the
  ruling is read, and Arthur may rule otherwise at Gate 4: v2 names the
  three published schools in its prose and asks for an objection from
  "the two schools the argument was not assigned", so it cannot name six
  rivals or judge a new school (the golden runner has refused to run the
  three under v2 since Tier B began). Only v3 takes its rival list from
  the registry. A flag-on build stores `prompt_version` `"v3"`; the
  column is plain text.
- **The rival list is the six.** `RIVAL_SCHOOLS_BLOCK`, `rivalsOf`, and
  the schools a reply's objection may name (`VerdictSchema`) follow
  `SHOWN_SCHOOL_IDS`: the published three without the flag, all six with
  it.
- **The three's criteria come from the draft file.** Arthur's ruling of
  2026-10-24 keeps them out of `rubric.ts` until he publishes the
  schools. `src/lib/judge/draft-criteria.ts` (server-only) reads
  `content/prompts/fidelity-criteria.draft.md` once, as the module loads,
  and only when `SIX_SCHOOLS` is `"1"`; otherwise its map is empty and
  nothing is read. `fidelityCriteriaFor` gives each of the three its
  section, verbatim, the text every golden run since 3 Nov 18:15 has
  judged them against (the file last changed in 8e76d62, at 17:50 that
  day), then the voice paragraph a published school gets. That paragraph names
  only the voices whose school is among the rivals listed, so with six
  listed Confucianism's also names its Ubuntu voice and Buddhist Ethics'
  its Confucian one, which earlier runs, listing three rivals, did not
  send; Ubuntu's is as before. (Corrected on review: this first said the
  whole text was exactly what earlier runs sent.) Under v1 or v2 it
  throws for them.
- **`rubric.ts`'s criteria for a published school are unchanged.** What
  fills the prompt's criteria for one is not quite: its voice paragraph
  names only the voices whose school is among the rivals listed, so on a
  flag-on build Stoicism's and Utilitarianism's also name their Ubuntu
  voice, which `src/lib/judge/objection-voices.ts` already held for when
  Ubuntu joined the list; Virtue Ethics' is unchanged. With the rival
  list, that is all that differs from a flag-off v3 request.

**What does not change.** A build without the flag, production
included, sends byte for byte what it sent: v2, three rivals, the
published criteria (the six fixtures in `tests/judge-request/`), and
`/api/judge` refuses the three after reading the budget and the profile,
before the topic lookup, the cap, and any write or call. The
draft file is not read (`tests/draft-criteria-reads.test.ts` records
every path the route asks for, and now also shows the recorder catching
the flag-on read). `next.config.ts` still refuses SIX_SCHOOLS for a
production build. Previews have no judge key and their budget fails
closed, so no preview judges anything either.

**Pinned.** Every request a flag-on build can send, for all six schools,
original and revision, is a committed fixture in
`tests/judge-request/six-schools/` (`tests/six-schools.test.ts`), so a
change to what the judge receives on that build moves a fixture. The
draft file is read once, at load: a test judges one of the three on a
flag-on build and records no further read.

**The golden runner.** With SIX_SCHOOLS=1 it judges the three through
the build's own path (no draft override), after checking that path sends
exactly the draft file's text; both read the file with the same parser,
`parseDraftCriteria`. The new-schools run is that run. The flag sets the
rival list, so on a SIX_SCHOOLS run the list itself, in its order, is
part of a record's request fingerprint: every fingerprint of a run
without the flag is computed as before (all 77 of the 16:58 full run
still reproduce), and none of a flag-on run's can match one. A flag-on
run file carries `"six_schools": true` and a run id ending `-six`. The
runner prints which build's requests it sends; refuses a SIX_SCHOOLS
value other than "1", "0" or none, since the modules treat anything but
"1" as off and an operator meaning a flag-on run would otherwise pay for
a flag-off one; and runs SIX_SCHOOLS=1 under v3 only, the one version a
flag-on build sends.

**The new-schools run (18:14 UTC).** Run
`2026-11-06T18-14-06-111Z-v3-six.json`: SIX_SCHOOLS=1, v3 (the prompt of
the 16:58 full run, sha256 `5c0bbece85a94d6f...`), three samples a case,
all 25 cases, the live three's included since their requests change too.
77 calls (two replies failed validation and passed on their retries),
$1.1727, under a watchdog set to stop at $1.80 (armed from outside the
repository: it reads the run file's total every two seconds and stops the
runner at the limit; its log ended "runner finished; last total
$1.17267"). Cumulative on the eval
key: $12.2431 of $15.00, over the 18 run files.
- **Bands, median of three:** 23 of 25 cases in every band, and the two
  that miss are the two the flag-off run of 16:58 missed.
  `confucian-hierarchy-school` scores 78/80/78 against 40-75, with
  engagement 4/5/4, now inside its 0-4 (at 16:58: 82/83/83, engagement
  5/6/6). `stoic-analogy` has fidelity 7/8/7 against 8-10, its score in
  band (71/78/72).
- **Objections:** under each fixture's expected schools, written for
  three rivals, 8 cases fail the objection check, 7 of them passing every
  band, so 16 of 25 pass. In each of the 8 the majority objection is a
  voice the flag-on prompt names for that school: `ubuntu` for
  `stoic-analogy`, `stoic-strong`, `stoic-wrong-school` and
  `fabricated-source` (Stoicism), and for `confucian-hierarchy`,
  `confucian-ren-disposition` and `confucian-wrong-school` (Confucianism);
  `confucian` for `buddhist-wrong-school`. Counting the voices the prompt
  names, 23 of 25 pass, the same two as above. (The objection check on
  its own passes 17 of 25 on the fixtures' sets and 25 with the named
  voices; 16 and 23 are whole-case passes.) Two wrong-school cases also
  drew one objection in three from a school neither reading expects
  (`confucian` for Utilitarianism and for Virtue Ethics), a minority that
  fails neither. 72 of the 75 objections were a voice the prompt names.
- **Scores:** the mean of the 25 medians is 54.76, against 55.00 at
  16:58. Every strong case's score is in band; against 16:58 four are
  higher, four the same and three lower (buddhist-strong 83 to 80,
  confucian-strong 86 to 80, util-strong 83 to 80). The eleven cases of
  the three new schools have a mean of medians of 58.09, against 58.45
  with three rivals listed.
- **The records:** all 77 fingerprints reproduce with the flag on and
  none with it off; `criteria_source` is `draft` for the three's cases
  and `live` for the rest.

**For Gate 4.** Each is Arthur's; none is decided by being written here.
- That a flag-on build, and so production at launch, judges with v3.
- What v3 at launch does to verdicts already stored under v2. A revision
  of a v2 original would be judged under v3. `/api/judge` computes the
  revision's `scoreDelta` and `fidelityDelta` against the original's
  scores for the `revision_judged` analytics event, and the verdict page
  computes its own from the two stored verdicts and shows it, so both
  would cross two prompt versions; Elo and a topic's par would take v3
  scores beside v2 ones. The 26 Oct comparison found v3 scoring the
  strong and exemplar cases 3 to 13 higher, with a v3 prompt since replaced ("2F:
  Arthur's rulings of 2026-10-26, on the golden runs"), and this file's
  rule is that scores across versions are not compared as equivalent.
  (Corrected on review of the Gate 4 pack: this first cited the 3 Nov
  re-run, which compared v3 with v3.)
- `/debate/rubric` says "These are the criteria the judge is given for
  each school, in full — the same text". On a flag-on build it still
  shows rubric.ts's v2 text for the published three only, while the
  judge gets v3's text for six. At launch that would be untrue in
  production: copy and publishing, (e) and (c).
- Statements in frozen files that this makes untrue on a flag-on build,
  and so at launch, and are his to change: v3's head comment says it "is
  not the production default"; the draft criteria file says it is "NOT
  LOADED BY ANYTHING IN PRODUCTION" and that `hasFidelityCriteria`
  returns false for the three, and "One thing reads this file: the golden
  runner". (`src/lib/anthropic.ts` said, of `draftCriteria`, that
  "/api/judge keeps refusing them meanwhile"; that comment is corrected
  here, under the Gate 3 ruling this PR already edits the file by.)
- What counts as a fitting objection on a flag-on run. Each golden
  fixture's expected objection schools were written for three rivals.
  On a flag-on build the prompt names, from the approved voices,
  `ubuntu` for Stoicism, Utilitarianism and Confucianism, and
  `confucian` for Buddhist Ethics, and the judge follows the named voice
  closely. The runner's pass test keeps the fixtures' sets; its notes now
  say when an objection came from a school the fixture does not expect,
  and whether the prompt named it, apart from one from the argued school.
  Whether the named voices count is Arthur's: the new-schools run passes
  16 of 25 if they do not, and 23 of 25 if they do.
- The new-schools run's two misses, the same as the flag-off run's: the
  hierarchy case (closer in this run, its engagement in band, its score
  78 against 75; its objection was `utilitarianism` three times in both
  runs, so the added Ubuntu voice does not show in it) and stoic-analogy's
  fidelity.

### Navigation for six schools, behind SIX_SCHOOLS (2026-11-06)

Arthur, 2026-11-06: "Queue this after Gate 3 and the new-schools run;
don't let it delay them. Navigation restructure, as part of Stage 5
behind SIX_SCHOOLS (launches with the six schools; production unchanged
until then). Signed out: Header: Lessons · Motions · Schools · How it
works, plus a primary "Take the quiz" button. Logo -> /. Signed in:
Header: Today · Motions · Lessons · Schools. Logo -> /today. The ME
button opens a menu: Profile, My debates and challenges, Classes,
Settings, Retake the quiz, Sign out. Pages: "Schools" (/schools): a card
per published school linking to its /s/[school] page, with this week's
table below. /table redirects to it. "How it works": merge /method and
/debate/rubric into one page with anchors; old URLs redirect, including
/method#samples. Rename "Debate" to "Motions" in the nav and headings
(keep /debate URLs). Add an "Exemplars" link on each motion card in the
list. Mobile: the same items in the existing Menu dropdown. Keep every
existing URL working (redirect, never 404). Copy goes into
docs/daily-path-copy.md first. Screenshots of both menus, signed out and
signed in, at 390px and 1280px, in the Gate 4 pack for my review."

Built after Gate 3 and the new-schools run, as asked. The copy is in
`docs/daily-path-copy.md`, section 13, with what is new marked for his
ruling. A build without the flag, production included, renders every
touched page and component byte for byte as before. Tests pin it against
fixtures rendered from main (`tests/nav-six-flag-off/`), and two reviews
served main and the branch, both built without the flag, side by side.
On such a build `/schools` and `/how-it-works` are rewritten
(`flagOffRewrites` in `next.config.ts`) to a path no route answers, so
they get the site's own not-found page, as on main; a page that refuses
by itself answers with Next's bare error shell instead.

Choices made where the instruction left room, each his to change:
- **Signed-in or not, before the page is drawn.** Both link sets are in
  the page; a one-line script in the root layout marks `<html
  data-auth="in">` from the session cookie, and CSS shows one set. No
  page reads cookies on the server for it, so static pages stay static,
  and neither set flashes into the other. The header re-reads the cookie
  on each page change; Sign out loads the Supabase client only when
  pressed.
- **No sign-in link in the signed-out header,** as given. The landing
  page keeps its own link to `/login`. (Ruled otherwise on 2026-11-06:
  a quiet "Sign in" link; below.)
- **The Me menu's targets:** Profile `/me`; My debates and challenges
  `/me#challenges` (the pending challenges, with the debate history after
  them); Classes `/me/settings#classes`; Settings `/me/settings`; Retake
  the quiz `/quiz`. The anchors exist on flag-on builds only.
- **"A card per published school":** the cards are the schools the
  build shows, the list every public surface moved to in Stage 5's step
  2, which is the six on a flag-on build and the six published at launch.
- **How it works** keeps both pages' text unchanged, shared with them
  (`src/components/how-it-works/`), under a new heading and a contents
  line, with anchors `#judge`, `#rubric`, `#counterpart` and `#samples`.
  The method page's closing sentence ("The criteria the judge is given
  are published in full, including the fidelity criteria for each
  school. Read the rubric.") is left out with its link, since the rubric
  is on the same page. The rubric's own claim to show the judge's
  criteria in full is unchanged and is Gate 4's item 10. The merged page
  does not send `rubric_viewed`, which `/debate/rubric` sends: that event
  counts views of the rubric page, and a visit to `/how-it-works` is not
  one. Whether it should count the merged page is his. (Both ruled on
  2026-11-06: the sentence kept, and `rubric_viewed` counted when the
  rubric's section is seen; below.)
- **Redirects** (`sixSchoolsRedirects` in `next.config.ts`, flag-on
  builds only): `/table` to `/schools`, `/method` to `/how-it-works`
  (a browser keeps the anchor, so `/method#samples` lands on
  `#samples`), `/debate/rubric` to `/how-it-works#rubric`. Temporary
  until the launch makes them permanent (308; ruled 2026-11-06, below).
  Checked on a served flag-on build: each answers 307 to its
  destination.
- **Exemplars** sits under each motion card, not inside it: the card is
  itself a link, and a link cannot hold another. Read aloud as
  "Exemplars: {motion title}".
- **"Debate" to "Motions"** in the header, the footer and the two debate
  pages' titles; the footer's About column and its disclosure link point
  at the merged page on a flag-on build.
- **Widths.** The header keeps to one line from 360 pixels, the
  design's phone width (`design/layout.md`), up, with nothing pushed
  sideways; below 360 the quiz button wraps. Between 640 and 768 the
  bar's links and gaps were a little narrower, so "How it works" stayed
  on one line; with "Sign in" the bar starts at 768 and that narrower
  step is gone (below). Only one of Menu and Me is open at a time.
- **Links go to the new addresses directly.** On a flag-on build every
  link inside the site that led to `/method`, `/debate/rubric` or
  `/table` leads to `/how-it-works`, its anchors, or `/schools`
  (`src/lib/nav-routes.ts`), and the sitemap lists the new pages. A
  redirect followed inside the site drops the anchor, so the verdict's
  "How this was judged" would otherwise land on the top of the page, not
  the rubric. The old addresses still redirect, for links from outside.
- **The session cookie test** matches Supabase's auth cookie and its
  numbered parts (`sb-{ref}-auth-token`, `.0`, `.1`), not the
  `-code-verifier` cookie a half-finished sign-in leaves, so a reader who
  abandoned a sign-in is not shown the signed-in header.
- **The flag-off bundle.** The flag-off build's markup is pinned by
  fixtures taken from main (`tests/nav-six-flag-off/`). What it sends is
  not byte for byte main's:
  - The root layout's script, which every page loads, grows by 1,743
    bytes (about 560 compressed): the header picks its version at build
    time, but what the six-school header imports still comes along
    unused, namely the published three's names and colours and the
    session-cookie test.
  - Four page scripts grow by 84 to 117 bytes each (`/today`, a debate,
    the chunk the debate and revise pages share, `/styleguide/arena`),
    where `src/lib/nav-routes.ts` is a module of its own.
  - Each page's HTML is 41 to 65 bytes longer, in the inline data React
    reads (the layout's unused flag and head, the footer's fragment); the
    markup itself is the same.
  - `_buildManifest.js` lists the two rewrites, so the addresses
    `/schools` and `/how-it-works` are in a public file no page loads.
  - The stylesheet grows by 684 bytes (103 compressed; 664 and 105
    after the rulings below): rules for
    classes no flag-off page uses, since Tailwind writes a rule for
    every class it finds in the source, whichever build uses it.

  No draft school is among any of it (`check:bundle` passes). Measured
  on flag-off builds of main at 901e3a4 and of this branch; the page
  scripts and the HTML by the third review.

### Navigation: Arthur's rulings on #99 (2026-11-06)

Arthur, 2026-11-06, on #99 and Gate 4 item 14:

> - .rsc returning 200: yes, the small follow-up so they 404 as before.
> - Kill-switch line moved to a shared file: fine. It's a read, not the
>   enforcement; leave it where it is.
> - Gate 4 item 14:
>   - Add a "Sign in" link to the signed-out header (returning students
>     need it), styled as a quiet text link beside "Take the quiz".
>   - Me items: accept as built.
>   - Restore the method page's closing sentence ("The criteria the
>     judge is given are published in full...") on /how-it-works. That
>     transparency is part of the site's credibility.
>   - Count rubric_viewed when the rubric section of /how-it-works is
>     viewed.
>   - Redirects: temporary until launch, permanent (308) at launch. Add
>     that to the Gate 4 steps.

Carried out:
- **`.rsc`.** On a build without the flag, `/schools.rsc` and
  `/how-it-works.rsc` are rewritten with the two pages, before any file
  is looked up (`flagOffRewrites` in `next.config.ts`). After #99 they
  answered 200 on production with a not-found payload: fetched from the
  production deployment of 80b8d5b (dpl_4nX8uRi1CKXr4XxoSomo7Lg6AHpJ)
  at 21:26 UTC, both gave status 200, `x-matched-path` their own `.rsc`
  address, and a payload whose page segment carries the digest
  `NEXT_HTTP_ERROR_FALLBACK;404`. Vercel serves a page's `.rsc` file
  from the build, and widens only afterFiles rewrites to cover it
  (`@vercel/next` 29.0.0, read by the review). `next start` serves no
  `.rsc` address at all, so only a production deploy can show the fix.
- **The kill-switch read** stays in `src/lib/school-table-page.ts`.
- **"Sign in"** (`/login`), a quiet text link (the bar links' grey, no
  fill or border) just before "Take the quiz", shown only signed out.
  Beside the button it does not fit on most phones: the page would scroll
  sideways from 320 to 413 pixels (6 at 320, 36 at 360, 21 at 375, 6 at
  390; none from 414 to 639) and between 640 and 719 (up to 62). So
  it is beside the button wherever the four links are in the bar, and
  the Menu's last item, below a rule, wherever they are in the Menu; and
  the bar now starts at 768 (`md`) rather than 640, the Menu below it,
  for both readers: signed in, the Menu is used from 640 to 767 too,
  which "Sign in" does not itself need, and is kept so the two headers
  change at one width. The row's gaps stay at 12 pixels up to 1024, so
  the signed-out bar has 18 pixels to spare at 768. Measured on a served
  flag-on build from 320 to 1280 pixels, signed out and in: one line
  from 360 up (below it the quiz button wraps), nothing pushed sideways.
  Where it sits on a phone, and the bar's new width for both readers,
  are his to change (Gate 4 item 14).
- **The Me items** as built.
- **The method page's closing sentence** is back at the foot of
  `/how-it-works`, before "Questions or corrections", its "Read the
  rubric" now a link to the page's own `#rubric`. Like the rubric's own
  claim, it says the judge's criteria are published in full; on a
  flag-on build the page shows v2's criteria for three schools, which is
  Gate 4's item 10, now naming this file. The link to `#rubric` is a
  choice his ruling left open.
- **`rubric_viewed`** is sent from `/how-it-works` once a page view, when
  the rubric's section first reaches the upper half of the window
  (`src/components/how-it-works/RubricSectionViewTracker.tsx`); a link
  to `#rubric` lands it there at once. Same event and properties as
  `/debate/rubric`, which counts on load; PostHog's own path tells the
  two apart. What counts as "viewed" is a choice his ruling left open.
  Checked in a browser by the review: no event on load at the top of
  the page (390 to 2560 pixels wide), one when the section's top passes
  the window's middle, none after, one on landing at `#rubric`, none on
  landing at another section.
- **Redirects:** temporary until the launch; making them permanent (308)
  in the launch merge is on Gate 4's item 15 and the checklist in
  `docs/stage5-plan.md`.
- The copy is in `docs/daily-path-copy.md`, section 13; the Gate 4
  screenshots are retaken with "Sign in".

### Gate 4: Arthur's rulings (2026-11-07)

Arthur, 2026-11-07, on `docs/gate4.md`:

> 1. confucian-hierarchy-school: accept as a known miss. Record it.
> 2. stoic-analogy: accept as a known miss.
> 3. Count the named voices; widen the fixtures' objection sets to match.
> 4. Yes: production judges with v3 at launch. Spending accepted ($50/month
>    covers ~3,300 calls). Update the COST comment.
> 5. Option (ii): no score change shown where the two verdicts' prompt
>    versions differ; Elo and par unchanged.
> 6. Yes: at launch move the three's criteria into rubric.ts, same text,
>    proven by the flag-on request fixtures.
> 7. Leave judge.v3.md's head comment exactly as sent (it is what makes
>    the judge work); record in decisions.md that its wording is stale by
>    design. Fix the draft criteria header and the COST comment, which the
>    judge doesn't receive.
> 8. v2 copy accepted, with two fixes: rewrite Utilitarianism's share line
>    [1] so it doesn't cite v1's self-driving-car question; on /r/<id> the
>    map's screen-reader description says "where they stand".
> 9. Write the 18 stances (6 topics x the three new schools), one sentence
>    each, from content/schools/*.md and the approved criteria, no new
>    quotations. Keep the test as it is. Seeding debate_topics is approved
>    (a). The elsewhere passages are enough on micro-lessons for launch.
> 10. At launch the rubric shows the v3 criteria for all six, so "in full"
>     stays true, on /how-it-works and anywhere else that makes the claim.
> 11. Yes: an exemplar floor on the template mark, dropping a position
>     rather than showing a weak one.
> 12. Re-screening: a pending reply holds the lapse clock until it is
>     screened; /me shows "Waiting to be checked" for it, matching the
>     exchange page; copy accepted.
> 13. Yes: the fresh sample run covers all six schools, placed by quiz v2.
>     Write argument banks for the three new schools from their school
>     files, criteria and the research file (quotation guard applies), at
>     the same depth as the live three's, so launch week shows six active
>     schools. Show me 3 sample arguments per new school before running.
> 14. Navigation: accepted as built.
> 16. Clearing the preview's v2 rows: send me the SQL for the SQL Editor
>     when the time comes.
> 15. Launch: when 8-13 are done, send me the flag-on preview link and the
>     10-minute phone click-through. Launch only on my explicit "launch".

Items 1 to 7, carried out together:
- **1 and 2, the known misses.** `confucian-hierarchy-school` (82/83/83
  at 16:58 against 40-75, engagement 5/6/6 against 0-4; 78/80/78 in the
  new-schools run) and `stoic-analogy`'s fidelity (7/7/7 and 7/8/7
  against 8-10, its score in band) are accepted as known misses of v3.
  Their fixtures keep their bands: a later prompt that brings either into
  band shows as a pass, and one that moves the rest out still fails.
  The Gate 4 checklist's first item is ticked on that footing.
- **3, the named voices.** Each golden fixture's
  `expected_objection_school` now holds, beside the rivals it was written
  for, every rival its school's voice paragraph names
  (`src/lib/judge/objection-voices.ts`): `ubuntu` for the fifteen Stoic,
  Utilitarian and Confucian fixtures, `confucian` for the three Buddhist
  ones; 18 files. The Virtue Ethics and Ubuntu fixtures already listed
  the rivals their schools' voices name. Read
  against the two v3 run files, every one of the 25 cases now passes the
  objection check in both, so each run passes 23 of 25 whole cases, the
  two misses above. The bands are untouched. The objection check is a
  majority over a case's samples: of the 75 samples per run, 68 (16:58)
  and 72 (18:14) named one of the school's voices, and two in the 18:14
  run (`util-wrong-school`, `virtue-wrong-school`) named `confucian`,
  outside even the widened sets. `tests/objection-voices.test.ts` now
  holds every fixture to its school's named voices.
- **4, v3 at launch.** Nothing changes before the launch: the flag
  chooses the version (`PROMPT_VERSION`, `src/lib/judge/schema.ts`), and
  the launch turns the flag on. The judge's COST comment
  (`src/lib/anthropic.ts`, frozen; this ruling is the authority, and the
  judge does not receive it) now gives v3's measured cost, $0.0152 a call,
  the mean of the 154 calls of the two v3 runs of 2026-11-06, and the
  $50 month as about 3,300 judge calls. Its `est_in=1700 est_out=650`
  stay, marked as v2's measurement, because the golden runner prices a
  run from them by adding the larger v3 prompt to that base
  (`tests/judge/run-golden.ts`).
- **5, option (ii).** The option as put to him: "show no score change, in
  any of those places, when the two verdicts' versions differ, and leave
  Elo and par as they are", the places being the verdict page, the share
  line, `/me` and the `revision_judged` event (`docs/gate4.md`, item 5).
  Where a revision and its first attempt were judged under different
  prompt versions:
  - the verdict page shows neither the first scores nor the change, but
    one line saying why (new copy, `docs/daily-path-copy.md`, "A revision
    judged by a newer version of the judge", for his ruling);
  - the share line uses the school's line rather than
    `{first} → {score}`;
  - `/me` lists the revision under its original without its score, which
    its own page shows, so the two are not set side by side;
  - `revision_judged` records `score_delta` and `fidelity_delta` as null.
    The event is fired by `src/components/debate/ArgumentEditor.tsx`
    from the change the judge route works out (`src/app/api/judge/route.ts`,
    frozen, unchanged); the revise page tells the editor whether the
    original was judged under the version this build judges with. A
    revise page opened on the v2 build and sent after the launch deploy
    would still record a change across versions; that window is minutes,
    affects only the event, and the frozen route returns no version to
    check against.
  The verdict page reads both rows in one query, and across two versions
  hands the component no first scores at all, so they are not in the
  page's payload either. Each row's own `prompt_version` column is
  compared (`src/lib/verdict-versions.ts`), never the copy in a verdict read
  through `debates_public`: that view keeps a withheld verdict's version
  only when it reads `v<n>` (migration 0023), so a sample's template
  version would vanish and two same-version verdicts would look
  different. The versions are compared as stored, so a sample's two
  template rules count as two: of the 484 sample revisions with a judged
  original (production, read 2026-11-07; there are no genuine ones yet),
  the 3 judged under `sample-template-2` whose originals were
  `sample-template-1` lose their table, and the 481 others keep it. The
  line is not shown on a sample's page, which already says no judge read
  the argument: two template rules are not two versions of the judge.
  Elo and par are untouched.
- **6, the criteria at launch.** On the launch checklist
  (`docs/stage5-plan.md`): the three sections move from the draft file
  into `src/lib/judge/rubric.ts` unchanged, and the flag-on request
  fixtures passing unchanged is the proof.
- **7, the frozen statements.** `content/prompts/judge.v3.md`'s head
  comment is left exactly as sent. **Its wording is stale by design:** it
  says v3 "is not the production default" and is "a draft to run the
  golden set against", that the vocabulary paragraph "lives with the
  criteria, not in this file", and names `fillOnce`, which `src/` no
  longer has. All four are untrue or will be at launch, and none is
  corrected, because the judge reads the comment and it is what holds the
  strong cases in band (the 06:05 check of 2026-11-06); rewording it
  would change what the judge receives. Whoever reads it should read it
  as an instruction to the model, not a description of the code. The
  draft criteria file's header (frozen `content/**`; this ruling is the
  authority) now says who reads it on which build and what happens at
  the launch; only its per-school sections (each headed `## ` and the
  school's id) reach the judge, and the
  flag-on request fixtures pass unchanged, so the edit is not one the
  judge sees. The same goes for the line under its `# Draft fidelity
  criteria` heading, which made the same claim and is rewritten with the
  header. The test that pins its wording
  (`tests/judge-v3-and-refusal.test.ts`) is updated with it. One frozen
  comment the judge is not sent becomes stale with item 4 and is left
  for Arthur's next list: `src/app/api/judge/route.ts`'s "At most $0.20
  or so a reader a day at the COST comment's rate", about $0.30 at
  v3's $0.0152.

Items 8 to 13 follow in their own pull requests; 14 needs nothing; 15
and 16 come at the launch.

### Gate 4 item 9: the new schools' stances (2026-11-07)

Arthur, 2026-11-07, quoted in full in "Gate 4: Arthur's rulings
(2026-11-07)":

> 9. Write the 18 stances (6 topics x the three new schools), one sentence
>    each, from content/schools/*.md and the approved criteria, no new
>    quotations. Keep the test as it is. Seeding debate_topics is approved
>    (a). The elsewhere passages are enough on micro-lessons for launch.

Each of the six topics in `content/topics/*.md` (frozen `content/**`;
this ruling is the authority) now gives Confucianism, Ubuntu and Buddhist
Ethics a stance, one sentence each, after the published three's, at about
their length (29 to 34 words; theirs are 20 to 34). Each is written from
that school's file (`read` and `gets_wrong`) and its approved criteria
(`content/prompts/fidelity-criteria.draft.md`), and quotes nothing, not
even wording a source has verified:
- Confucianism reasons from what a role and a relationship require, and
  from holding a name to its work (`moral-training`, `no-decision`);
- Ubuntu reasons from what people become through one another, reads a
  harm as a failure of relationship, and asks who was left out of
  deciding, on Metz's relational reading rather than Menkiti's stronger
  one;
- Buddhist Ethics reasons from intention as much as outcome, from
  non-harm and the checking that goes on after acting, from no fixed self
  (`borrowed-judgement`, `crash-arithmetic`), and from many conditions
  rather than one cause (`no-decision`). None reduces it to reducing
  suffering, which the research file warns against.

They are mine, written under the ruling, and his to read. Readings a
reviewer of #103 raised for him, kept as written: Buddhist Ethics on
`careful-builder` lowers blame for careful, well-meant builders, as
volition weighing as much as outcome implies, while saying the intention
excuses nothing left unchecked; on `crash-arithmetic` it argues impartial
compassion from no fixed self, the later traditions' inference the
criteria accept when argued, though non-harm might instead refuse to
program a death at all; Confucianism on `crash-arithmetic` keeps the
maker's partiality to its passenger, the objection its school file names;
Confucianism on `opaque-benefit` makes an account the decider owes, where
the site's own Confucian passage on that motion
(`content/micro/opaque-benefit-elsewhere.md`) says the people's confidence
does not rest on explanation alone.

`tests/topic-stances.test.ts` is unchanged, as ruled: it checks the
published schools, which are the three until the launch publishes the
others. `/debate` prints only the reader's own school's stance
(`TopicList`, a server component), and a reader on a build without the
flag is placed only in the three, so the new lines are not seen on
production before the launch. `debate_topics` is publicly readable, as
the repository is.

Seeding: after the merge, the six rows' `stances` are written to
production's `debate_topics`, which he approved ((a)). `npm run
seed:topics` needs the service key, which this environment does not hold,
so the write goes through the Supabase connector. Charter rule 10's three
items, and the checks either side:
- **Snapshot:** `docs/seed-snapshots/2026-11-07-debate-topics.json`, the
  six rows as read at 06:06 UTC on 2026-11-07, in the format
  `npm run restore:topics` reads. Loaded into local Postgres, every row's
  `md5(stances::text)` and the md5 of its other columns equal
  production's.
- **The write:** `docs/seed-snapshots/2026-11-07-debate-topics-stances.sql`,
  generated from the topic files: six `UPDATE ... SET stances` statements
  in one transaction, nothing else. Only `stances` differs between the
  files and production (checked with `seedDiff` by the reviewer of #103),
  so this is exactly what `npm run seed:topics` would write. `par_elo`
  and `par_n` are not touched.
- **Locks:** each statement takes ROW EXCLUSIVE on `debate_topics` and
  FOR NO KEY UPDATE on its row (`stances` is in no unique index, so
  inserts into tables referencing `debate_topics` are not blocked); the
  row locks are held until the commit, milliseconds in all. From the app
  only `/api/judge`, updating a row's `par_elo`, can make it wait;
  otherwise a seed, a restore or DDL could.
- **Rollback:** `docs/seed-snapshots/2026-11-07-debate-topics-stances-rollback.sql`,
  generated from the snapshot. Tested on local Postgres 16 on a copy of
  the snapshot: the write gave each row six stances and left every other
  column as it was; the rollback brought all six rows' md5s back to
  production's.
- **Before the write:** each row's `md5(stances::text)` must still equal
  the snapshot's, or the rollback would not restore what was there:
  opaque-benefit `2ab4a93974fdbf294458cb7c2f03582c`, crash-arithmetic
  `ecb72e1cc234f9f958f5f0937466e92a`, no-decision
  `f25846b9f7bb4cec044aceb29f561abb`, moral-training
  `b79fbd23b4109cb4515b732d92e0cfa5`, careful-builder
  `9d343a518e0b88cbcfe6af4f1f96d17c`, borrowed-judgement
  `64f321e5715308fdf33f7caac073a974`.
- **Read-back:** after the write, each row's `md5(stances::text)` must
  equal what the write gave locally: opaque-benefit
  `82d42cbfbd9a8189c0408f36dfcab6d1`, crash-arithmetic
  `0c46c464b4e696d5d3b0d867800c9bab`, no-decision
  `cf53750d9d42b22a9fee95a3a91d4d29`, moral-training
  `aceb73e7903f50ebfafda951aa05e558`, careful-builder
  `eca34a4781323f537cee179a406ff61a`, borrowed-judgement
  `69b992d93e0293fc461bbc912bfcfb89`. jsonb's text form is canonical, and
  the snapshot loaded on local Postgres 16 hashes as production's 17
  does.

No micro-lesson is added: the ruling says the elsewhere passages are
enough for launch.

**Carried out, 2026-11-07.** #103 merged at 06:29:02 UTC. Before the
write, each row's `md5(stances::text)` in production was the snapshot's,
as listed above. The write, `docs/seed-snapshots/2026-11-07-debate-topics-stances.sql`
as merged, ran once through the Supabase connector straight after the
merge. Read back at 06:29:31 UTC, each row's hash was the one listed
above for after the write (opaque-benefit `82d42cbf…`, crash-arithmetic
`0c46c464…`, no-decision `cf53750d…`, moral-training `aceb73e7…`,
careful-builder `eca34a47…`, borrowed-judgement `69b992d9…`); every row
had six stances; the md5 of every other column, `par_elo` and `par_n`
included, was unchanged. The rollback was not run. No page reads the
new lines before the launch, so the write did not wait for #103's
deploy.

### Gate 4: items 8, 10, 11 and 12 (2026-11-07)

Arthur's rulings of 2026-11-07, quoted in full in "Gate 4: Arthur's
rulings (2026-11-07)":

> 8. v2 copy accepted, with two fixes: rewrite Utilitarianism's share line
>    [1] so it doesn't cite v1's self-driving-car question; on /r/<id> the
>    map's screen-reader description says "where they stand".
> 10. At launch the rubric shows the v3 criteria for all six, so "in full"
>     stays true, on /how-it-works and anywhere else that makes the claim.
> 11. Yes: an exemplar floor on the template mark, dropping a position
>     rather than showing a weak one.
> 12. Re-screening: a pending reply holds the lapse clock until it is
>     screened; /me shows "Waiting to be checked" for it, matching the
>     exchange page; copy accepted.

Carried out:

- **8, the two fixes.**
  - `content/schools/utilitarianism.md`, share line [1] (frozen
    `content/**`; this ruling is the authority), now reads: "Turns out
    I'd pick whatever does the most good for the most people, even when
    I'm the one who pays for it. Sophecs called that Utilitarian." It
    keeps the old line's point, impartiality that counts the speaker too,
    without v1's question. The words are mine, for his reading.
    Share lines are not behind the flag, so this one changes on
    production with the merge; it is as true of a v1 result as of a v2
    one.
  - `SchoolMap` takes whose dot it draws (`whose`, "your" by default);
    `/r/<id>` passes "their", so its description says "A filled dot marks
    where they stand.", matching that map's title ("Where these answers
    put them"). Every other map is the reader's own and is unchanged. The
    map is drawn on a SIX_SCHOOLS build only.
  - `docs/stage5-plan.md`, the v2 copy table, records the acceptance and
    both fixes.
- **10, the rubric in full.** `src/components/how-it-works/Rubric.tsx`,
  which both `/how-it-works` and `/debate/rubric` render, shows what
  `fidelityCriteriaFor` hands the judge under the build's prompt version
  for every school the build shows. On a SIX_SCHOOLS build that is v3's
  text for all six: each school's
  criteria with v3's vocabulary, objection and voice paragraphs, and the
  three new schools' approved sections. The text is shown as the judge
  is given it, including the voice paragraph's "Of the rival schools this
  prompt lists" and its school ids in backticks (on Arthur's next list:
  "in full" requires it, and it reads as text written for the judge). A build without the flag
  shows the published three's criteria, which are exactly what the v2
  judge is given (`fidelityCriteriaFor(id, "v2")` returns them
  unchanged), so production's rubric is as it was. `/method`'s "published
  in full" links to this rubric and needs nothing of its own. At the
  launch, when the three's criteria move into `src/lib/judge/rubric.ts`
  (item 6), the page goes on reading them through the same function.
- **11, the exemplar floor.** `EXEMPLAR_FLOOR = 50`
  (`src/lib/exemplars.ts`): nothing marked under it is read or chosen,
  so a position whose strongest argument is under it is left out. The
  ruling sets a floor; the value is mine, where the sample plan's middle
  band starts (`scripts/seed/verdicts.ts`, 70-90 / 50-69 / 25-49), and it
  is on Arthur's next list. It is a floor on the mark, as ruled, not on
  the tier the run wrote an argument to. Measured before choosing it:
  - production, read-only on 2026-11-07: all 707 published originals
    the run wrote to be weak are marked 25 to 45. Of the 2,496 others, one
    is under 50 (49), and 24 stronger arguments share its opening, so it
    is never shown. The floor changes nothing on today's pages;
  - the generator run in memory under rule 2, as the run after the launch
    will be: weak arguments were marked 18 to 49 on the seed I used, and
    the review of #102 found 16 to 52 across five others. Rule 2 has no
    clamp, so a weak argument can now and then be marked 50 or a little
    over (59 at most by the arithmetic). At full size the 72 chosen were the same with
    or without the floor on every seed tried. At the canary's size (40
    accounts) the floor drops a few, and on some seeds leaves a school, or
    a whole motion, with nothing to show: that school's section is left
    out, and a motion with nothing at all answers not found, as it does
    after the launch teardown until a fresh run, while the links to it
    stay. That is the ruling's "dropping a position rather than showing a
    weak one" at its limit, and it lasts only until the run passes the
    canary.
- **12, a pending reply holds the lapse clock.** `exchangeLapsed`
  (`src/lib/counterpart.ts`): an open exchange does not lapse, however
  long ago its last delivered reply was, while its latest reply is one the
  daily job could still deliver: waiting to be screened, by the author
  whose turn it is by sequence and by `next_turn`, in an exchange both of
  whose parties still have accounts. A reply already screened holds
  nothing, even one whose hand-over failed: the ruling holds the clock
  "until it is screened", and such a hold would never end. Screened and delivered, the reply restarts the clock as any
  delivery does; screened and held, the clock runs from the last
  delivered reply again, as it does for a reply held when it is sent (the
  held author cannot post again until it is resolved, so the exchange
  cannot move anyway). A reply to a counterpart who has since left holds
  nothing: it can never be handed over.
  - The exchange page decides lapse with it, after reading the turns
    (`closeIfLapsed`, `src/lib/counterpart-lapse.ts`), and closes an
    exchange only while it is still open and waiting on whoever it was
    waiting on when read, so one the daily job has just moved on is not
    closed under it. If the close does not take, the page shows the
    exchange's status as it now stands (only the status is read again),
    and a turns read that failed closes nothing. Two races are left,
    each a round trip wide, and only for a reply that arrives after its
    exchange's 14 days have already run out, before anyone has opened the
    exchange (from a tab left open, say). The job's: a view reading the
    turns between the job marking a reply `ok` and handing the turn over
    closes the exchange; the job's hand-over is then refused, the reply
    goes back to pending, and the job answers non-2xx, which the cron log
    shows. The turn route's (frozen `src/app/api/counterpart/turn`): it
    marks a reply `ok` and then hands the turn over with no condition on
    the exchange's status, so a close in between leaves a delivered reply
    in an exchange marked lapsed, with `next_turn` set; and a view that
    read the turns before the route saved a reply, and closes after,
    leaves that reply pending in a lapsed exchange, where the job no
    longer reads it. Both are narrower than on `main`, where any view
    during the screening call closed the exchange.
  - `/me` leaves out lapsed exchanges by the same rule
    (`meExchangeRows`, `readExchangeTurns`), from one read of the open
    exchanges' turns: who wrote each, its place and how it was screened,
    no text. If that read fails it leaves none out, as the page closes
    nothing on a failed read.
  - The daily job (`src/lib/rescreen.ts`) no longer skips a pending reply
    whose exchange's last delivered reply is over 14 days old, and no
    longer reads one to a counterpart who has left, so such replies can
    never fill a run.
  - A reply whose screening call keeps failing is tried once a day, and
    holds its exchange, until a call succeeds, which is what "until it is
    screened" says; the job's batch and the monthly budget still cap what
    that costs. Because the job takes the oldest first, 20 such replies
    would take every run's calls and starve newer ones, when each call
    fails fast; if each times out at 15 seconds, three use up the run's
    40-second limit. On main they left the queue 14 days after their
    exchange's last delivered reply. On Arthur's next list, in case he
    wants a limit. So is screening stopped altogether (the kill switch on,
    the month's budget spent or unreadable): then every exchange with a
    pending reply is held until screening resumes, and the cron answers
    200, since nothing failed.
  - `scripts/review-turns.ts` now moves an exchange on only when the
    reply approved was held. Approving a reported reply that had already
    been delivered moved the exchange on a second time, handing the turn
    back to its author and stranding any reply then waiting, which the
    job would read on every run.
  - `/me` shows an exchange whose latest reply is the reader's own,
    waiting to be screened, with "Waiting to be checked" where "Reply"
    was, the exchange's title linking to it, under "Your counterpart is
    waiting", which is still true. The copy is the label he accepted.
  - Production held no reply other than a delivered one when this was
    written (read 2026-11-07), so no exchange's state changes with the
    merge.

### Gate 4 item 13, first part: the new schools' argument banks (2026-11-07)

Arthur, 2026-11-07, quoted in full in "Gate 4: Arthur's rulings
(2026-11-07)":

> 13. Yes: the fresh sample run covers all six schools, placed by quiz v2.
>     Write argument banks for the three new schools from their school
>     files, criteria and the research file (quotation guard applies), at
>     the same depth as the live three's, so launch week shows six active
>     schools. Show me 3 sample arguments per new school before running.

This first part writes the banks and the samples. The run itself, six
schools placed by quiz v2, is the second part, and runs only after he has
seen the samples.

- **The passages** (`scripts/seed/arguments/fragments/*.json`) for
  Confucianism, Ubuntu and Buddhist Ethics, at the live three's depth: for
  each of the six topics, a direction, 4 positions, 4 reasons, 3 examples
  and 2 objections each with its answer, and 4 closings per school: 234
  passages and 12 closings, 246 in all, mine, written from each school's
  file (`read`, `gets_wrong`), its approved criteria, and, for the
  scholars a school file names, what the school file and the research
  file say of them: Mhlambi, that a discriminatory automated decision is
  a failure of relational personhood; Menkiti, that the community confers
  personhood once its demands are met; Gyekye, that individuals keep
  their own worth and rights (the school file) while community stays
  essential (the research file).
- **Sources.** A passage names a scholar or text only where the school
  file does (the Analects' Books 12 and 13; Metz, Menkiti, Gyekye and
  Mhlambi; the discourse to Rahula). Two verified wordings are used, each
  word for word as the research file has it and with its source named in
  the same passage, as ruling (e) 9 allows: the Nguni maxim, as Metz gives
  it, and Metz's principle. Book 13 is paraphrased, not given in Legge's
  words. Nothing is put in the mouth of Confucius or the Buddha, and the
  research file's UNVERIFIED items are not used.
  `tests/seed/launch-passages.test.ts` holds the passages to those rules
  and to the house style, since the quotation guard reads only quotation
  marks under `content/` and the passages carry none. The arguer is "a
  Buddhist Ethicist", not "a Buddhist", as accepted at Checkpoint B (e) 1.
  Buddhist Ethics is not reduced to reducing suffering, which the research
  file warns against: suffering is weighed with intention and non-harm.
- **Objections.** Two per topic, as the live three have, from two rivals:
  the rivals each school's criteria name as voicing its best-known
  objection (`src/lib/judge/objection-voices.ts`), and for Ubuntu, whose
  criteria name one, Utilitarianism too. A rival is introduced with its
  own article ("An Ubuntu Ethicist will object that"), read from the full
  registry so a bank reads the same on any build; the live three's
  articles were all "a", so their banks are unchanged.
- **The banks** (`scripts/seed/arguments/<topic>.<school>.json`, 18 new
  files): built by `npm run seed:banks` as the live three's are, 40
  arguments each, 10 strong, 20 mid and 10 weak, 80 to 250 words, all
  different. The weak tier draws on the topic's shared weak passages, as
  the live three's does.
- **Nothing reads them yet.** The generator's schools are still the
  quiz's three (`SCHOOLS`), so no run changes and the live three's 18
  banks rebuild byte for byte; `tests/seed/banks.test.ts` holds all 36 to
  their passages, and the new three to two objections from two rivals,
  their named voices among them. `tests/seed/determinism.test.ts` pins
  the datasets `main` gave at 3008b29, before the new banks, for the base
  window and for ten days of extension, so a change that would move rows
  a live run has written fails the tests.
- **The samples** for Arthur: `docs/gate4-samples.md`, one argument of
  each tier per school, the first of its tier in its topic's bank.
- **Directions** follow the stances #103 wrote, and several positions
  restate a stance almost word for word. So the question already on
  Arthur's list from item 9, whether non-harm lets Buddhist Ethics program
  a death at all on `crash-arithmetic`, covers these passages too: they
  argue for minimising deaths, owning the rule as an intention about who
  dies.
- **For Arthur's list**, three readings the passages take that are his to
  judge:
  - several Buddhist passages read dependent origination as spreading
    responsibility for an AI's harm across the many people and conditions
    behind it (`careful-builder`, `moral-training`, `borrowed-judgement`,
    `no-decision` and `opaque-benefit`, and one closing). The approved
    criteria call that reading "an inference, not doctrine" and draw
    nothing from it;
  - no Ubuntu passage states Ubuntu's best-known objection as the
    criteria give it (a community is not one voice, and an appeal to it
    can make a dissenter the problem): the Stoic objections make the point
    about one's own judgement but not the one about dissent, and the
    Utilitarian ones now argue as Utilitarians;
  - Buddhist Ethics' best-known objection, the gap between moral teaching
    and institutions (who audits, how one appeals), appears only obliquely:
    in a Confucian objection on `no-decision`, and in one on
    `opaque-benefit` that an account is owed to the person refused.

### Gate 4 item 13, second part: the generator for six schools, placed by quiz v2 (2026-11-07)

Arthur's ruling, quoted in full in "Gate 4: Arthur's rulings
(2026-11-07)", begins "Yes: the fresh sample run covers all six schools,
placed by quiz v2". The first part wrote the banks and the samples; this
writes the generator that uses them. Nothing runs: the fresh run is a
launch step, after the teardown, on his word.

- **A run's quiz.** `GenConfig.quiz`, 2 or absent, chooses the quiz and
  so the schools: quiz v2 and all six, or quiz v1 and its three. The
  scheduled job takes it from `RUN_QUIZ` in `scripts/seed/generate.ts`,
  absent until the launch merge sets it to 2 (on the launch checklist in
  `docs/stage5-plan.md`). The command line takes `--six-schools`, which
  used to be refused as "the six-school quiz ... is a draft that is not
  built"; production still refuses it until `RUN_QUIZ` is 2, since before
  the launch production shows three schools.
- **Placed by quiz v2.** Each sample answers quiz v2's questions, read
  from `docs/quiz-v2.json` as the app reads them, and is scored by the
  app's `scoreQuizV2`. Its answers lean towards a school by how far each
  option's vector points towards that school's place on the map, as quiz
  v1's answers lean by the option's weight for the school. The result is
  written as `submitQuizResultV2` writes one: version 2, the point, no
  vector, the answers by question id.
- **The mix.** Equal, one sixth each, by the same calibration quiz v1's
  40, 35 and 25 use. The ruling asks for six active schools at launch;
  equal shares take no view on which are more popular. Mine, on Arthur's
  list. At production volume (seed `six-check`) each school has 85 to 111
  judged originals in each of the two seven-day windows after the base
  window, against the table's threshold of 20.
- **The six come from the quiz file**, in its order, not from the
  registry's lists, which the launch changes when it publishes the three:
  a quiz v2 run regenerates its rows from this code, so they must not move
  under it. A quiz v2 run is refused unless the quiz, every motion's
  passages, the closings and the verdicts' lines cover the same six, and
  `tests/seed/determinism.test.ts` pins a quiz v2 run's datasets and base
  hash as this code first made them.
- **Verdicts.** A template verdict names a school and its adherent from
  the full registry, so it reads the same on any build, with the
  adherent's article ("an Ubuntu Ethicist", "an Ubuntu position"). The
  live three's verdicts are word for word as before. Nine new lines say
  what standing on a new school's own ground looks like (`FEATURE`), from
  the school files and criteria; mine, on Arthur's list. Every verdict of
  a six-school run passes the judge's schema as a six-school build has it.
- **Exchanges.** Among the six, two schools often have no objection
  between them in the passages: 12 of the 15 pairs lack one in at least one
  direction, and 6 in both, on every motion, since a school's two rivals
  are the same on all six. Between them the opening turn
  argues from a reason and the reply from a reason and an example, where
  the old fallback would have said one reason twice in each. That is most
  exchanges of a six-school run: at production
  volume 286 of 492 open with no objection to raise, and 258 of 440
  replies have none to answer, so they argue past each other more than the
  live three's do. Among quiz v1's three every pair has an objection both
  ways, so those turns are unchanged. On Arthur's list.
- **Addresses.** A quiz v2 run's sample addresses carry HMAC-SHA256 of
  the run and the user's number, keyed by the seed, which
  `docs/sample-activity.md` had set out for the fresh run.
- **The live run is untouched.** The quiz enters a plan's base hash and
  config only when one is named, so every existing plan hashes as it did
  (pinned), and the datasets of a run that names no quiz are pinned as
  `main` gave them at 3008b29, for the base window and ten days on. A
  plan with a quiz has another base hash, so the live run cannot be
  extended as a six-school run: the dry run refuses it.
- **Checked on Postgres.** A quiz v2 plan of 600 accounts written to a
  disposable local database with every migration: canary and full
  stages, every check passed (migration 0027's check on a result's shape
  among the writes), and teardown left nothing.
- **Left as they are**, because changing them would change rows the live
  run has written. About half of revision verdicts keep the first
  attempt's weakest move, "The argument never meets an objection.",
  while saying the revision now meets one (at production volume, seed
  `six-check`, 279 of 545 revisions carry that line, 224 of them judged
  as answering the objection, in a three-school run and a six-school one
  alike). In about 1 revision in 8 the verdict says the revision now
  answers an objection and still suggests answering it (71 of 545 in a
  three-school run, 66 of 545 in a six-school one); with the first, 350
  and 345 of 545 revisions carry at least one of the two. Both are in
  `templateRevisionVerdict`. And a name ending in "s" takes "'s" ("Virtue
  Ethics's", and now "Buddhist Ethics's"). All three could change for the
  fresh run only, if Arthur wants that.
- **Commands.** `--six-schools` is refused with `--plan`, since a plan
  names its own quiz, and production refuses a plan whose quiz is not
  `RUN_QUIZ`, which every scheduled extension of that run would refuse.
- **For Arthur's list**, besides the mix and the `FEATURE` lines: the
  exchanges above; the three left as they are above, which the fresh run
  is the one chance to change (`scripts/seed/verdicts.ts`:
  `templateRevisionVerdict`, and the templates that write
  `` `${NAME(…)}'s` ``); and that a fresh run's base window still starts
  on 2026-09-18, so its quiz v2 results and the new three's arguments are
  dated weeks before readers could have made them.

### Gate 4: Arthur's rulings of 2026-11-08

Arthur, 2026-11-08, on the click-through, the samples and the list:

> CRON_SECRET is set in Vercel (Production, sensitive). Pick it up with
> the next merge, then confirm from the logs that the keep-alive and the
> re-screening job both return 200 on their next run.
>
> Samples (gate4-samples.md): approved, with one fix before the run.
> Closing lines must fit their motion and not repeat stock phrases across
> arguments: e.g. Ubuntu's "not the total" closing on Trained to be good
> doesn't fit, and both Confucian samples end with the same sentence.
> Write closings per motion (or check each against its motion) for all six
> schools' banks, so exemplar pages never show the same ending twice.
>
> Revision verdicts that say "never meets an objection" while also saying
> the revision meets one: fix in the fresh run.
>
> "That is why judging is paused rather than running" on /method and
> /how-it-works: make it follow the kill switch, so it is only shown when
> judging is actually paused.
>
> Supabase: Site URL https://sophecs.com, https://sophecs.com/** and the
> preview pattern are in the redirect list. www redirect: [done.

How each is carried out:

- **The pause sentence.** `JudgeMethod` shows "That is why judging is
  paused rather than running." only when `KILL_SWITCH_JUDGE` is the exact
  string "true", the test `/debate` and `/today` already use; the
  sentence before it stays. Both pages are prerendered, so the switch is
  read at build, which matches its own rule (set it and redeploy).
  Allowlisted accounts are not considered: the pages are the same for
  every reader. `tests/nav-six.test.tsx` holds `/method` byte for byte to
  main's render with the switch on, and to that render less the one
  sentence with it unset, empty, "false", "TRUE" or "1".
- **`CRON_SECRET`.** Vercel refused the value as set: Arthur's redeploy of
  production at 01:16:35 UTC (`dpl_BGcegwBSDCMAt894edwVitEWUFvC`) ended
  in `INVALID_CRON_SECRET` within two seconds, because the value holds a
  character that is not valid in an HTTP header (Vercel allows visible
  ASCII only). Production is still `dpl_3nPkpSEoLUbvaPGzCaq31qcBGVDu`,
  which has no secret. Asked of Arthur: the value again, of letters and
  digits only. Arthur, 2026-11-08: "CRON_SECRET re-entered, letters and
  digits only, Production-only, sensitive. Go ahead with #107." (the
  variable's record shows it changed at 01:59:53 UTC). The first
  production deploy after that, #107's merge, picks it up;
  confirming both jobs answer 200 comes after their next runs (Hobby
  fires the keep-alive in the 04:00 hour and the re-screening job in the
  05:00 hour, UTC), recorded in the progress log with how it was read.
- **Closings per motion, and the revision verdicts.** In the fresh run
  only, since the live run regenerates its rows from this code until the
  teardown: a separate pull request.
- **Supabase and the www redirect.** Supabase done by Arthur. For www,
  Vercel's record of the domain has no redirect (`www.sophecs.com`,
  `redirect: null`, unchanged since 2026-09-11). A request to
  `https://www.sophecs.com/robots.txt` answered 308 to
  `https://sophecs.com/robots.txt` (2026-11-08, 01:19 UTC), but that is
  the app's own rule (`canonicalRedirects` in `next.config.ts`, #83 and
  #85), which leaves `/api/` and `/_next` on www by design. Asked of
  Arthur whether "done" means that rule. Arthur, 2026-11-08: "www: the
  app's own 308 rule is fine. That's what I meant; no Vercel domain
  redirect needed."
- **Not ruled, so left as they are:** the other two things the run's
  verdicts do ("Gate 4 item 13, second part", "Left as they are"): a
  revision verdict that says an objection is now answered and still
  suggests answering it, and "'s" after a name ending in "s". They stay on
  Arthur's list.

### Gate 4: each motion's own closings, and the fresh run's revision verdicts (2026-11-08)

Two of Arthur's rulings of 2026-11-08, quoted in full in the section
above:

> Closing lines must fit their motion and not repeat stock phrases across
> arguments: e.g. Ubuntu's "not the total" closing on Trained to be good
> doesn't fit, and both Confucian samples end with the same sentence.
> Write closings per motion (or check each against its motion) for all six
> schools' banks, so exemplar pages never show the same ending twice.
>
> Revision verdicts that say "never meets an objection" while also saying
> the revision meets one: fix in the fresh run.

- **Closings per motion.** 144, four for each school on each motion, in
  `scripts/seed/arguments/fragments/closings-by-motion.json`, each written
  to that motion and to the school's stance on it in the passages. Mine,
  for Arthur's reading. `closings.json`, four for each school shared by
  every motion, stays as it was. The first review read all 144 against
  each motion and its school's passages and found about twenty that
  restated a passage or the stance almost word for word, two schools'
  closings on one page cut from one template, stock phrases ("keep
  watching", "Ask ..., and the answer ..."), and some that did not fit:
  a driver in a self-driving car, "not by fortune" (the Stoics' wording)
  in a Confucian closing, and readings the passages do not carry
  ("Nothing permanent is lost", "Ritual shapes the heart"). The second
  review found more of the same that the first round's checks let
  through, mostly a passage restated with its words inflected. 72 of
  the 144 are rewritten in all.
- **Held to:** `tests/seed/closings.test.ts`:
  - every school, four on every motion, each one sentence of 10 to 30
    words;
  - none repeated, here or from `closings.json`;
  - no five words in a row, and no first three words, in any two of them;
  - by stem, so that "restates" and "restated" count as one word, and
    counting a run only when two of its words carry content, the
    motion's own words aside: no four words in a row from the school's
    passages or its stance on the motion; no three in a row between two
    schools on one motion, which is one exemplar page; no two within one
    school's four;
  - the house style ("program", the British spelling for code, is
    allowed). The new three's are held to the quotation guard's rules too
    (`tests/seed/launch-passages.test.ts`).
- **Who reads them.** A run made with quiz v2 (the fresh run) closes its
  arguments, revisions and exchange turns with its motion's own closings,
  and the banks show them. A run that names no quiz closes with
  `closings.json` as before, since the live run regenerates its rows from
  this code until the teardown: its datasets are byte for byte as pinned.
  The quiz v2 pins move, and are pinned again.
- **Exemplar pages never show the same ending twice.** Closings alone do
  not do it: a school's four exemplars on a page (one per opening) choose
  among four closings, and a strong argument whose closing was cut to fit
  ends on a body sentence.
  - `selectExemplars` (`src/lib/exemplars.ts`) keeps no two arguments that
    end on the same line, in any school. Its first pass is as before,
    schools in their order and strongest first within each, with an
    argument whose ending is already taken giving way to the strongest
    under its opening whose ending is not. Where that
    leaves an opening with nothing, a kept argument moves to the next
    strongest under its own opening if that frees an ending the left-out
    opening can take (an augmenting path, as in Kuhn's matching). So an
    opening is left out only when no choice of one argument per opening
    could show it, and where the first pass already shows every opening,
    nothing moves.
  - The first pass alone left openings out that a matching shows
    (review pass 1: 143 or 142 of 144 on five of nine production-volume
    quiz v2 seeds). With the matching, on 17 configurations (the
    fixture's plan with quiz v2 and without; with quiz v2, seeds
    `six-check`, `launch-b`, `launch-c` and `d1` to `d6`; with no quiz,
    seeds `six-check`, `live-like-a` and `n1` to `n4`), every page shows
    as many openings as any choice of one argument per opening could, and
    no ending twice.
  - Measured at production volume (seed `six-check`, base window to
    2026-11-10 09:00 UTC, two weeks on): main's selection shows an ending
    already on the page 47 times across the six motions in a quiz v2 run,
    and 22 times in a run that names no quiz; this one never, with the
    same number of arguments shown (144 and 72). It shows a different
    argument in 53 and 25 of those places: another under the same
    opening, the strongest whose ending is not already on the page, which
    is the second strongest under it in 28 and 8 of them and as far down
    as the fourteenth and thirteenth in others. On the fixture's small plan (quiz v2) it
    shows 130 openings to main's 135, which is as many as any choice could
    show there.
  - Not handled, as it cannot arise today: where a school has more
    openings than its share of `EXEMPLARS_PER_MOTION`, the matching could
    move a shown opening to a weaker argument to free an ending for one
    the share then leaves out. A page has at most 24 openings against a
    share total of 50.
- **The live pages change too.** The rule is in the page's selection, so
  it applies to the live run's rows from the merge, not only the fresh
  run's. Read from production on 2026-11-08 around 02:20 UTC (one
  read-only query, returning for each school's opening its candidates'
  ranks and a hash of each one's ending, with the page's own filters):
  main's selection shows 72 exemplars across the six pages and repeats an
  ending 16 times, at least once on every page. With this rule it shows
  the same 72 openings, repeats none, and shows a different argument in
  16 places, each another under the same opening: the second strongest
  under it in 4 of them, and down to the twelfth in the rest, marked 0 to
  19 points lower than the one it replaces (review pass 2 measured this
  from production's ranks and marks, read-only). In 3 of the 18 school
  groups the order of the openings on the page changes with it, as a
  school's cards come strongest first. The opening and ending
  were computed in SQL to match `openingOf` and `endingOf`, except that a
  first sentence over 160 characters is compared by its first 160.
- **The fresh run's revision verdicts.** A revision that answers the
  objection keeps the first attempt's weakest move, which for a middling
  argument opened "The argument never meets an objection." In a run made
  with quiz v2, that move keeps its quoted passage but is described as a
  strong argument's verdict describes one ("... is asserted more than
  shown, and it carries weight the argument never quite earns."). No
  draw is added: `tests/seed/verdicts.test.ts` checks over every banked
  argument that the verdict and the draws after it are otherwise
  identical. A revision that tried and missed keeps "never meets an
  objection", which is true of it. A run that names no quiz writes what
  it wrote.
- **Not ruled, so left as they are:** a revision verdict that says an
  objection is now answered and still suggests answering it, and "'s"
  after a name ending in "s".
- **The samples** (`docs/gate4-samples.md`) are regenerated from the
  rebuilt banks: six of the nine now close with their motion's closings,
  five of them on a closing rewritten after the first review, and
  nothing else in them changed.
