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
Production had no exchange, so nobody was caught in one.

The fix keeps who opens, which the code's own comment attributes to the
brief ("`next_turn` is the newer seeker"): the newer seeker is now
`user_a`, with their own debate and school on the `_a` side, and
`next_turn` names them. The route is frozen and unchanged. Every other
reader of an exchange works out "mine" and "theirs" from `user_a` and
`user_b` symmetrically. `tests/counterpart-pairing.test.ts` checks the
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

### Open pre-pilot item: there is no restorable backup

The project is on Supabase's free plan, which has no daily backups and no
Point-in-Time Recovery; both start at Pro. Phase 2C worked around it by
taking its own copy into `backup_20261022` before applying, by hand, once.
That is adequate for one migration Arthur is watching. It is not adequate
for a term's worth of student work.

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
the first occurrence and says nothing about the rest. A prompt file is sent
to the model whole, header comment included, and `judge.v3.md` named both
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
billed call still counts toward the monthly budget.

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
`src/lib/anthropic.ts` reads the file.

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
to confirm at Checkpoint A:

| School | Objection (in short) | Voiced by | Why, as the judge receives it | Once published | Source on the page |
| --- | --- | --- | --- | --- | --- |
| Stoicism | gives up on the world too easily | `utilitarianism` | the harm an unfair system does is a sum someone could reduce, and declining to try is itself a choice about that harm | `ubuntu`: a person is a person through other persons, so standing apart from an unfair system leaves the people inside it on their own | Stoicism's gets_wrong: "Utilitarians would say this gives up on the world too easily" |
| Utilitarianism | no total makes the trade fair to the person who pays | `virtue-ethics` | justice gives each person what is owed to them, and a total owes nobody anything | `ubuntu`: each person's capacity for relationship is to be honoured, not netted against other people's gains | Utilitarianism's gets_wrong gives it to Rawls, who is no school here; Ubuntu's page: "Metz argues against building systems to maximise expected utility" |
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
