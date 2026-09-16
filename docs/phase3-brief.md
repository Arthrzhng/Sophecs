Do everything: Sophecs — Phase 3 build instructions for Claude Code
Read this whole document, then `docs/phase2-brief.md` and `docs/decisions.md`, before writing code. Those two files are the source of truth for everything already built; this document tells you what to change and why. Log every deviation and every trade-off you resolve in `docs/decisions.md`, as before. Restate the scope of each numbered task in one paragraph and wait for a yes before starting it.
1. Context
Sophecs is a philosophy × AI product for 15–18-year-olds. A ten-question, no-login quiz sorts a visitor into one of three schools (Stoicism, Utilitarianism, Virtue Ethics); a saturated result card is the one shareable object; an async arena asks you to defend your school on six AI-related motions, judged by an AI on fidelity to the school; micro-lessons (a primary-source excerpt before each debate, the strongest rival objection after) carry the reading.

* Stack: Next.js 15 App Router, React 19, Tailwind v4 (`@theme` tokens in `src/app/globals.css`), Supabase (EU, free tier, RLS), Vercel Hobby, PostHog EU, Anthropic `claude-sonnet-5` for judging (`temperature` is rejected by this model; extended thinking is disabled explicitly).
* Routes that exist: `/`, `/quiz`, `/quiz/result`, `/r/[id]` (+ `card.png`, `opengraph-image`), `/c/[id]`, `/s/[school]`, `/login`, `/auth/callback`, `/me`, `/me/settings`, `/debate`, `/debate/[slug]`, `/debate/[slug]/[debateId]` (+ `opengraph-image`), `/lessons`, `/lessons/[slug]`, `/api/judge`, `/api/track`.
* Content is files: `content/topics/*.md` (six motions with three stance lines each), `content/micro/*-before.md` / `*-after.md` (twelve, 150–250 words, `body` is a frontmatter field), `content/schools/*.md`, `content/prompts/judge.v1.md`, `content/quiz/questions.ts`. Seeded into `debate_topics` by `scripts/seed-topics.ts`.
* Key code: `src/lib/anthropic.ts` (single client, `// COST:` comments, logs every call to `ai_calls`), `src/lib/judge/schema.ts` (zod `VerdictSchema`, `PROMPT_VERSION`), `src/lib/judge/rubric.ts`, `src/lib/elo.ts` (K=32, par_elo), `src/lib/streak.ts`, `src/lib/claim.ts`, `src/lib/challenge.ts`, `src/lib/budget.ts`, `src/lib/micro-lessons.ts`, `src/lib/topics.ts`, `src/lib/analytics/events.ts` (typed union), `src/components/debate/{DebateFlow,ArgumentEditor,MicroLesson,Verdict,VerdictCard,ShareRow,PublishToggle,TopicList}.tsx`, `src/components/me/{EloBlock,StreakBlock,PendingChallenges}.tsx`, `src/components/card/{CardLayout,ResultCard}.tsx`, `src/components/quiz/QuizResultClient.tsx`, `src/components/share/{ChallengeButton,DebateThemButton,ShareRow}.tsx`.
* Schema: `quiz_results`, `challenges`, `profiles` (owner-read only; `profiles_public` view via admin client), `debate_topics`, `debates` (owner read/insert; `debates_public` view; no update policy — server actions use the admin client with explicit ownership checks), `ai_calls` (admin only). Migrations `0001`–`0007` in `supabase/migrations/`.
* Design system: paper and ink; colour is allegiance. School colours appear only as a dot, stripe, hairline or eyebrow. The quiz result card is the single fully-saturated surface. Spectral for anything that is an argument or excerpt, IBM Plex Sans for interface, IBM Plex Mono for anything measured. `oxblood` for warnings and destructive actions only. No dark mode.
* Audience is minors. The UK Age Appropriate Design Code applies: high-privacy defaults, data minimisation, no nudge techniques, no geolocation.

2. Non-negotiables and hard constraints
Product (do not remove, hide or weaken):

* The three-school framework, keyed by `school_id`.
* The ten-question, no-login quiz.
* The shareable result card as the single saturated surface.
* Primary-source material in every lesson.
* Judged philosophical debates scored fidelity-first with the breakdown visible.
* Courses and person-to-person discussion remain committed directions (Task 5 and Task 8 respectively).

Technical:

* `/`, `/quiz`, `/r/[id]`, `/c/[id]` gain no network request, no script and no client JS. `/` and `/quiz` stay `○` static, `/s/[school]` stays `●` SSG. Verify with `next build` output after every task and paste it.
* Vercel Hobby: serverless functions only (edge functions already failed the 1 MB limit); cron jobs run at most once per day; treat the function timeout conservatively — the judge route already targets p50 < 8 s, p95 < 20 s, keep it that way.
* Supabase free tier pauses a project after one week of inactivity. Task 7 addresses this.
* Every Anthropic call lives in `/api/judge`, `/api/counterpart/turn` (Task 8) or `tests/judge/run-golden.ts`, carries a `// COST:` comment, and is logged to `ai_calls`. Budget `AI_MONTHLY_BUDGET_USD=50`, five judged calls per user per day, `KILL_SWITCH_JUDGE` and `JUDGE_ALLOWLIST_USER_IDS` behave exactly as documented.
* The judge prompt is versioned content. Any change to prompt or schema bumps `PROMPT_VERSION`, re-runs the golden set before and after, and pastes both tables.
* `claude-sonnet-5` rejects `temperature`. Do not add it back. Determinism is checked by running the golden set twice and confirming every score lands in the same band.
* RLS: no new table ships without policies; no public read of argument text unless `argument_public = true`; `ai_calls` stays admin-only.
* AADC: no push or email nudges, no streak-loss messaging, no public counts that invite comparison, no new personal data fields.

3. Decisions already made (do not re-litigate)
Each line: decision — basis (EVIDENCE / EXTRAPOLATION / TASTE / MIXED) — confidence.

1. The seven-day return mechanism is an unanswered rival objection held open on `/me`. After a verdict, the judge names the one objection the argument left standing; it sits on `/me` until the user answers it with a revision. — MIXED (Ovsiankina resumption effect replicates; retrieval practice + feedback + revision has medium-to-large effects on durable learning) — Medium-High.
2. Revision after a verdict is now allowed, once per debate. This deliberately reverses the Phase 2 exclusion "editing an argument after submission." Guardrails preserve the reason for that exclusion: a revision never moves ELO or streak, is a separate `debates` row linked to its parent, counts toward the daily cap, and is limited to one per original. — EVIDENCE for the learning value; TASTE for the guardrails — Medium.
3. ELO and the streak stay exactly as built. Arthur's decision after review: `EloBlock`, `StreakBlock`, the 40-point threshold, UTC rule text, `elo_changed` / `streak_*` events all unchanged. No leaderboard (already decided). The research case for demoting them is recorded in `docs/decisions.md` for a later revisit, not acted on. — settled.
4. (merged into 3)
5. "This week's motion" is added alongside the streak, not instead of it. Deterministic, forgiving, no penalty for missing. Shown on `/debate` and `/me` only; `/` is untouched. — TASTE — Medium.
6. Courses = "cases", not modules. A case is a motion-within-a-school with the sequence Read + retrieve → Argue → Verdict + named objection → Revise → Close. The existing `/debate/[slug]` flow already is 80 % of a case; Task 6 completes it. No new `/courses` routes in this phase. No video, no MCQ, no certificates. — EXTRAPOLATION (interspersed retrieval prompts in text raise motivation, comprehension and self-reported retention; retrieval beats rereading) — Medium.
7. The "read" step becomes interactive. Each before-lesson gets at most two ungraded free-text retrieval prompts placed between paragraphs, stored without any model call, and shown back to the user above the editor as their own scaffolding. — EVIDENCE — Medium-High.
8. Discussion = "Counterpart": a private, paired, claim-anchored, two-turn rebuttal exchange. Invite- or match-gated, private by default, mutual opt-in to read-only publication, one Haiku safety pre-screen per turn. Built as Task 8, after the return loop has shipped. — EXTRAPOLATION (Kialo's invite-gating; structured peer critique) — Medium.
9. The result card loses its percentages. School name, one-line quote with attribution, the question "Which school do you think in?" and the domain. Percentages remain on `/r/[id]` in the comparison columns only. — MIXED (identity artefacts spread on recognition, not data; percentages imply false precision on a ten-question instrument) — Medium.
10. `/quiz/result` stops navigating away from the card. The card is rendered from sessionStorage and then the page redirects to `/r/[id]` on insert success; that transition is the recognition-destroying moment named in the research prompt. Replace the navigation with an in-place URL swap and inline CTAs. — TASTE — High.
11. Sign-in is prompted at the debate CTA only. Unchanged from Phase 2. Comparison on `/r/[id]` is already pre-auth; keep it that way. — settled.
12. The judge already exists and is not a stub. Extend its schema (Task 1); do not rewrite `src/lib/anthropic.ts`.

4. Ordered implementation tasks
Task 1 — Judge v2: name the objection left standing
Goal. Every judged, non-rejected verdict names one specific objection from a rival school that the argument failed to answer, in a form a user can revise against. Publish the rubric.
Files.

* `content/prompts/judge.v2.md` (copy of v1 with the additions below; v1 stays for history).
* `src/lib/judge/schema.ts` — bump `PROMPT_VERSION = "v2"`; extend the non-rejected branch.
* `src/lib/anthropic.ts` — load v2; raise `max_tokens` from 700 to 850; update the `// COST:` comment (`est_out=650`, `est_usd_per_call≈0.0098` at $2/$10 per 1M).
* `src/components/debate/Verdict.tsx` — new block (below).
* `src/app/debate/[slug]/[debateId]/page.tsx` — pass the new fields.
* `src/app/debate/rubric/page.tsx` (new, static) — renders the fidelity criteria from `src/lib/judge/rubric.ts` and the three-criterion weighting in plain language. Linked from every verdict page as "How this was judged".
* `tests/judge/golden/*.json` — add expected `unanswered_objection.school` to each case (must be a school other than the argued one); `tests/judge/run-golden.ts` prints it.

Schema addition (non-rejected branch).

```ts
unanswered_objection: z.object({
  school: z.enum(["stoicism", "utilitarianism", "virtue-ethics"]),   // must differ from the argued school; validate in the route
  claim: z.string().min(1).refine(maxWords(45)),                       // one objection, stated as a rival would state it
  why_it_stands: z.string().min(1).refine(maxWords(35)),               // what the argument did not do
}),

```

For revision verdicts (Task 2) add, optional:

```ts
objection_answered: z.boolean().optional(),
improvement_note: z.string().refine(maxWords(40)).optional(),

```

Prompt additions (v2, system section).
After scoring, identify the single strongest objection a rival school would raise that this argument does not answer. State it as that school would, in one sentence a sixteen-year-old could argue back against. Do not choose an objection the argument already addressed. Return it as `unanswered_objection` with the rival school's id. Word caps are hard limits: `strongest_move` ≤ 40 words, `a_stronger_version_would` ≤ 60, `verdict_line` ≤ 20, `unanswered_objection.claim` ≤ 45, `why_it_stands` ≤ 35. If a field would exceed its cap, shorten it before responding.
When the user turn includes `<original_argument>` and `<objection>` (a revision, Task 2), the prompt adds:
This is a revision of an earlier argument written to answer the objection in `<objection>`. Score it on the same three criteria as a fresh argument. Additionally set `objection_answered` to true only if the revision engages the objection directly and gives a reason a member of the rival school would have to concede or rebut, and write `improvement_note` (≤ 40 words) naming the one thing that changed most.
Verdict page block (insert after the three hairline bars, before `verdict_line`):

* Eyebrow, Plex Sans, rival-school colour as text only: `Objection · Utilitarianism`
* Label: `The objection you left standing`
* `claim` in Spectral, `why_it_stands` beneath in Plex Sans at `text-ink-mid`.
* Owner only: primary button `Answer it` → `/debate/[slug]/[debateId]/revise`; secondary text link `Later — it will wait on your profile`.
* Non-owner: no buttons.
* If the debate already has a revision: replace buttons with `Answered — read the revision` → the revision's verdict page.

Events (add to `src/lib/analytics/events.ts`): `objection_viewed { debate_id, rival_school, is_owner }`, `objection_answer_started { debate_id }`, `rubric_viewed {}`.
Acceptance.

* [ ] Golden set run before (v1) and after (v2) pasted; every case inside its score and fidelity bands; every `unanswered_objection.school` ≠ argued school.
* [ ] Golden set run twice on v2; no case changes band between runs.
* [ ] Zod rejects a v2 response missing `unanswered_objection`; the debates row stays `verdict null` with the argument intact.
* [ ] `/debate/rubric` is static (`○`) and reachable from every verdict page.
* [ ] Verdict page renders the block for owner and non-owner correctly on a 375 px viewport.
* [ ] `ai_calls` rows show `prompt_version = 'v2'` and a cost within 20 % of the estimate.

Effort. 2–3 days. Regression risk. Word-cap validation failures rise with more fields; the "shorten before responding" instruction mitigates, and the existing fenced-JSON stripping stays. Do not: add a second model call, change the scoring weights, or let the objection be drawn from the argued school.
Task 2 — The revision loop and open objections on `/me`
Goal. A user can answer the named objection once, get a second verdict, and see what changed. `/me` leads with objections awaiting an answer.
Migration `0008_revisions.sql`.

```sql
alter table debates
  add column kind text not null default 'original' check (kind in ('original','revision')),
  add column parent_debate_id text references debates (id);
create index on debates (parent_debate_id);
create unique index debates_one_revision_per_parent on debates (parent_debate_id) where parent_debate_id is not null;
-- RLS unchanged: insert own / read own; debates_public view gains kind, parent_debate_id.

```

An "open objection" is: a judged (`verdict is not null`), non-rejected, `kind='original'` debate owned by the user with `verdict->'unanswered_objection'` present and no child row. Compute with one query in `src/lib/objections.ts#getOpenObjections(admin, userId)`; no denormalised status column.
Route `/debate/[slug]/[debateId]/revise/page.tsx` (dynamic, auth required, owner only; 404 otherwise; 409-style message if a revision exists):

* Top: motion in Spectral; under it the objection block from Task 1 pinned, non-dismissable.
* `ArgumentEditor` in `mode="revision"`: prefilled with the original argument; same 80–400 word rule; word counter; autosave under `draft:revision:[debateId]:[userId]`.
* Above the textarea, Plex Sans: `Answer the objection inside your argument. Cut what no longer earns its place.`
* Submit label: `Submit revision`. Waiting state copy unchanged (`Reading your argument.`).

`/api/judge` changes. Accept `parentDebateId`. In order after the session check: load parent; verify ownership and that it is an original, judged, non-rejected debate; refuse if a child exists (`{ paused: "already_revised" }`, UI copy: `You've already revised this argument. Start a new motion instead.`); apply daily cap and budget as normal; skip the seven-day topic lock; insert `debates` row with `kind='revision'`, `parent_debate_id`, same `topic_slug`, `school`, `challenge_id null`; call the model with `<original_argument>` and `<objection>` added; on success do not compute ELO or streak — set `elo_before = elo_after = parent.elo_after`. Log to `ai_calls` with `kind='judge'`.
Revision verdict page = the normal verdict page for the revision's id, plus one section above the share row, label `Compared with your first attempt`: four mono rows (score, fidelity, rigor, engagement) showing first → revised with a signed delta; then `objection_answered` rendered as `Objection answered` / `Objection still standing` in Plex Sans (never in colour); then `improvement_note` in Spectral. Link `Read the first attempt`. The share line for a revision reads: `Revised my defence of the [school] line on [topic]. Went from [a] to [b]. sophecs.com/debate/…`.
`/me` changes (`src/app/me/page.tsx`).

* New first block `src/components/me/OpenObjections.tsx`: eyebrow `Awaiting your answer` and a mono count. Each row: topic title (Spectral), rival-school eyebrow in colour, the `claim`, button `Answer it`. Sorted oldest first. Max 5 shown; the rest behind `Show all`.
* Empty state (zero open objections, ≥1 debate): `Every objection answered.` plus one row for the next motion: `This week's motion: [title]` with button `Defend your school` → `/debate/[slug]` (see Task 4 for the pick). Never list all six.
* Empty state (zero debates): `You haven't defended [school] yet.` plus the same single weekly-motion row.
* Order of `/me` top-to-bottom becomes: OpenObjections → EloBlock and StreakBlock (unchanged, side by side as today) → PendingChallenges → Debate history (rows now show `kind`, and a revision is nested under its original with the delta).

Events. `revision_submitted { debate_id, parent_debate_id, word_count }`, `revision_judged { debate_id, objection_answered, score_delta, fidelity_delta }`, `objection_resolved { parent_debate_id, days_open }`, `me_viewed` gains `open_objections: number`.
Acceptance.

* [ ] Owner submits a revision from a phone; receives a verdict with the comparison section; ELO on `/me` unchanged; `debates.kind='revision'` with `parent_debate_id` set; `ai_calls` logged.
* [ ] Second revision attempt refused server-side (`already_revised`); unique index holds under a concurrent double-submit.
* [ ] Non-owner opening `/revise` gets 404. Signed-out gets `/login?next=`.
* [ ] `/me` shows the objection immediately after the first verdict and removes it after the revision is judged.
* [ ] Revision does not count toward or reset the seven-day topic lock; does count toward the five-per-day cap.
* [ ] PostHog: the "Second debate within 7 days" funnel is duplicated as "Second debate or revision within 7 days" and both URLs are added to `docs/decisions.md`.

Effort. 4–5 days. Regression risk. The topic-lock query currently counts judged rows; it must now filter `kind='original'` or a revision will lock the topic. Test this explicitly. Do not: allow editing in place, move ELO on revisions, or send any email.
Task 3 — Share loop: `/quiz/result`, the card, `/r/[id]`, `/c/[id]`
Goal. The card is recognised before anything moves; it carries identity, not data; recipients understand what this is in one line.
3a. `/quiz/result` (`src/components/quiz/QuizResultClient.tsx`).

* On insert success: `window.history.replaceState(null, "", "/r/" + id)` — no `router.replace`. The card does not re-render.
* Below the card, render inline once `id` is known: `ShareRow` (from `components/share`), `ChallengeButton`, and a text link `Defend your school in a debate` → `/debate`. Until `id` is known, render a single non-interactive line `Saving your result…` in `text-ink-soft`; never a spinner.
* The failure path is unchanged.
* Any full navigation to `/r/[id]` happens only when the user taps a link. Back button behaviour must land on `/quiz`, not loop.

3b. Card (`src/components/card/CardLayout.tsx`, used by the on-page card, `card.png` and both OG images). Remove the three percentage lines. Final hierarchy top-to-bottom: eyebrow `Sophecs · Your school`; school name (the only large element); the school's `one_line` in Spectral with attribution in mono; bottom line in Plex Sans `Which school do you think in? sophecs.com`. Keep the `unit` prop system and `boxSizing: border-box`. Re-render all four image routes locally and paste dimensions and a visual check.
3c. `/r/[id]` (`src/app/r/[id]/page.tsx`).

* Keep the `VectorColumn` comparison (percentages stay here — this is the one place they help) but only when `otherResult` exists.
* Reorder below the card: `Debate them` (when both sides present) → `ChallengeButton` → `ShareRow` (download and copy link) → `Debate a motion`. One primary button style per screen: `Debate them` if present, else `ChallengeButton`.
* Confirm the `card.png` download control is present and enabled in `ShareRow`; if it is still disabled from Phase 1, enable it (the route already returns a 1080×1350 PNG).
* No new client JS beyond what is already there.

3d. `/c/[id]` (`src/app/c/[id]/page.tsx`). Keep everything. Add one paragraph in `text-ink-mid` between the heading and the button: `Sophecs sorts you into one of three schools of ethics — Stoic, Utilitarian or Virtue Ethicist — in ten questions, then asks you to argue for it. No account needed.` Static, no JS. The button stays `Take the quiz`.
Events. `card_downloaded { result_id }` if not already present; `share_page_viewed` unchanged.
Acceptance.

* [ ] On a 375 px viewport, finishing the quiz shows the card with no navigation, flash or scroll jump; the URL becomes `/r/[id]` within 2 s on a throttled 3G profile; back returns to `/quiz`.
* [ ] OG images and `card.png` show no percentages; iMessage, WhatsApp and X previews render the school name legibly.
* [ ] `/c/[id]` reaches quiz question 1 in one tap; `next build` shows `/`, `/quiz` unchanged; shared JS unchanged at ~103 kB.
* [ ] Five moderated tests: after finishing the quiz, each participant can say their school unprompted 30 s later.

Effort. 2 days. Regression risk. `replaceState` on a client route can confuse Next's router cache; test forward/back and refresh on iOS Safari. Do not: gate anything on sign-in, add a second saturated surface, or put the debate CTA above the share row on `/r/[id]` for a recipient who has not yet compared.
Task 4 — First-run escalation and the weekly motion
Goal. The step from an 80-second quiz to a written defence feels earned. The first argument is scaffolded; the arena presents one motion, not six.
4a. First-argument scaffold (`src/components/debate/ArgumentEditor.tsx`, `src/app/debate/[slug]/page.tsx`). When the user has zero judged debates (pass `isFirstArgument` from the page):

* Above the textarea, three numbered lines in Plex Sans, `text-ink-mid`:
   1. `State what a [school] would say about this motion.`
   2. `Give the reason your school gives — the excerpt you just read is the one to use.`
   3. `Name the strongest objection and say why it doesn't win.`
* Placeholder: `Eighty words is enough for all three. Most first arguments take about ten minutes.`
* The 80-word minimum and 400 maximum are unchanged.
* Fire `first_argument_scaffold_shown { topic_slug }`.

4b. Weekly motion (`src/lib/topics.ts#getWeeklyMotion`). Pure: `activeTopics[isoWeekNumber(nowUTC) % activeTopics.length]`, ordered by `sort`. No column, no cron.

* `/debate` (`TopicList.tsx`): the weekly motion renders first with eyebrow `This week's motion`; the other five follow under `All motions`. Nothing else changes.
* `/me`: used by Task 2's empty states.
* `/` is untouched.
* Copy under the eyebrow on `/debate`, Plex Sans: `A new motion each week. Miss one and nothing happens.`

Events. `weekly_motion_clicked { topic_slug }`.
Acceptance.

* [ ] A new account sees the scaffold once; after the first judged debate it disappears.
* [ ] `getWeeklyMotion` has a unit test with fixed dates crossing a year boundary.
* [ ] `/debate` on 375 px shows the weekly motion above the fold with one button.

Effort. 1 day. Regression risk. `isFirstArgument` requires a debates count on `/debate/[slug]`; batch it with the existing queries so no extra round trip is added. Do not: add countdowns or "days left" to the weekly motion; the streak keeps its existing rule text and nothing more.
Task 5 — Cases: the interactive read step and case progress
Goal. Turn each topic into a complete case without new top-level routes: read with retrieval prompts → argue (scaffolded by your own retrieval answers) → verdict + objection → revise → close.
Content schema change (`content/micro/README.md`, all six `*-before.md`). Add an optional frontmatter field:

```yaml
retrieval_prompts:
  - after_paragraph: 1          # 0-based index of the paragraph the prompt follows
    prompt: "In one sentence: what does Epictetus say is actually up to us?"
  - after_paragraph: 3
    prompt: "What would he say about a decision an algorithm made for you?"

```

Rules: maximum two per lesson; each prompt is a question answerable from the paragraphs above it, not below; answers are free text ≤ 300 characters. Draft the twelve prompts (two per before-lesson) for Arthur's approval before installing; validate through `src/lib/micro-lessons.ts` (extend the loader and its types) and fail the build on more than two or an out-of-range paragraph index.
Migration `0009_reading_responses.sql`.

```sql
create table reading_responses (
  id text primary key,                          -- nanoid(10)
  user_id uuid not null references auth.users,
  topic_slug text not null references debate_topics (slug),
  chunk_index int not null check (chunk_index between 0 and 1),
  response text not null check (char_length(response) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, topic_slug, chunk_index)
);
alter table reading_responses enable row level security;
create policy "reading insert own" on reading_responses for insert with check (auth.uid() = user_id);
create policy "reading update own" on reading_responses for update using (auth.uid() = user_id);
create policy "reading read own"   on reading_responses for select using (auth.uid() = user_id);

```

Account deletion on `/me/settings` cascades this table.
Component `src/components/debate/RetrievalPrompt.tsx` (client, small): a single-line Spectral textarea (auto-grow to 3 lines), mono character count, a `Keep going` button that is enabled once the field is non-empty. Saves via a server action `saveReadingResponse` (upsert) and reveals the next paragraphs. No grading, no model call, no "correct" state. Reduced motion respected (no reveal animation when `prefers-reduced-motion`).
`MicroLesson.tsx` in the debate flow only (`/lessons/[slug]` renders the lesson without prompts, unchanged): paragraphs render up to the first prompt; the prompt; then the next paragraphs, and so on; `Begin` appears after the last paragraph. If the user is signed out (cannot happen on `/debate/[slug]`, which requires auth) render without prompts.
Editor scaffolding (`ArgumentEditor.tsx`). Above the textarea, under the Task 4 scaffold when present: eyebrow `Your notes from the reading`, then each stored response in Spectral at `text-ink-mid`, quoted. Copy: `You wrote these a minute ago. Use them.`
Case state, computed not stored (`src/lib/cases.ts#getCaseState(admin, userId, topicSlug)`):

* `read`: both retrieval prompts answered (or the lesson has none).
* `argued`: an original judged, non-rejected debate exists.
* `objection_open` / `revised`: from Task 2.
* `closed`: revision judged. Represented on `/debate` (`TopicList.tsx`) as four small hairline ticks under each topic row in ink only (labelled with `aria-label`, never colour-only): `Read · Argued · Answered · Closed`. On `/me`, the history row for a topic shows the same four ticks.

Completion and unlocking. A case is complete when `closed`. Nothing is locked: all six motions stay available (the seven-day lock is the only gate). Completing all six motions in your school shows one line on `/me`: `You've closed every motion as a [school]. Retake the quiz to argue from another school, or wait for the next motion.` No badge, no certificate.
Events. `retrieval_prompt_answered { topic_slug, chunk_index, chars }`, `retrieval_prompt_skipped` is not possible (there is no skip), `case_closed { topic_slug }`.
Acceptance.

* [ ] Twelve prompts installed and validated by the loader; the build fails on a bad index.
* [ ] On 375 px the reading flow needs no horizontal scroll; the textarea uses the native keyboard; `Keep going` is ≥ 24 × 24 CSS px with visible focus.
* [ ] Responses persist across a tab discard and appear above the editor.
* [ ] RLS: user A cannot read user B's responses (paste the failing query).
* [ ] `/lessons/[slug]` output is byte-identical to before this task.
* [ ] `/debate/[slug]` route bundle stays under 60 kB gzipped above the framework baseline.

Effort. 4–5 days. Regression risk. The before-lesson currently renders full-width in one pass; splitting it must not change the `micro_lesson_viewed` timing or the `Begin` button's position for lessons without prompts. Do not: add a `/courses` route, a per-case score, multiple-choice questions, a progress bar with percentages, or any "level".
Task 6 — Accessibility and performance pass
Standards, all routes:

* WCAG 2.2 AA: every interactive target ≥ 24 × 24 CSS px (2.5.8); visible focus on every control, not obscured (2.4.7, 2.4.11); no information conveyed by colour alone — every school-coloured dot, stripe or eyebrow has a text label; the four case ticks and the vector columns are readable by a screen reader; `prefers-reduced-motion` disables all transitions and the retrieval-prompt reveal; the magic-link flow has no cognitive test (3.3.8).
* Core Web Vitals, mobile, p75: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on `/`, `/quiz`, `/r/[id]`, `/debate/[slug]`, verdict page. Paste Lighthouse mobile for all five after every deploy; `/debate/[slug]` and the verdict page ≥ 85.
* Fonts: confirm Latin subset, `display: swap`, and that no route loads a weight it does not use.
* Error and offline states: the editor's localStorage draft survives a failed submit, a tab discard and a sign-in round trip (already true — re-verify after Tasks 2 and 5); the revision editor and the retrieval prompt get the same guarantee; a failed `saveReadingResponse` keeps the text in the field with the line `Couldn't save that. Your words are still here — try again.`
* Result card colour contrast: school-colour surfaces with ink text ≥ 4.5:1; paste the ratios.

Optional (do not block on): 44 px targets, enhanced focus appearance.
Acceptance. Checklist above with pasted numbers. Effort. 1–2 days. Do not: add an accessibility overlay library or any new dependency.
Task 7 — Keep-alive cron
`src/app/api/cron/keepalive/route.ts`, protected by `CRON_SECRET`, scheduled once per day in `vercel.json` (Hobby maximum). It runs `select 1` through the admin client and logs nothing else. Purpose: Supabase free-tier projects pause after one week without activity, which would take down the product exactly when a seven-day returner arrives. Alternative if Arthur prefers: upgrade the Supabase project to Pro and skip this task; record the choice.
Acceptance. Cron visible in the Vercel dashboard; a manual invocation returns 200; an unauthenticated invocation returns 401. Effort. One hour.
Task 8 — Counterpart: private paired rebuttals
Goal. Two people who defended different schools on the same motion exchange two rebuttals each, anchored to specific claims, in private. Nobody else can post; nobody can see it unless both agree.
Migration `0010_counterpart.sql`.

```sql
create table exchanges (
  id text primary key,                                   -- nanoid(10)
  topic_slug text not null references debate_topics (slug),
  debate_a text not null references debates (id),        -- opener's original debate
  debate_b text not null references debates (id),
  user_a uuid not null references auth.users,
  user_b uuid not null references auth.users,
  school_a text not null, school_b text not null,
  status text not null default 'open' check (status in ('open','complete','lapsed','blocked')),
  publish_a boolean not null default false,
  publish_b boolean not null default false,
  next_turn uuid references auth.users,                  -- whose turn it is; null when not open
  last_turn_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a <> user_b), check (school_a <> school_b)
);
create index on exchanges (user_a); create index on exchanges (user_b); create index on exchanges (topic_slug, status);

create table turns (
  id text primary key,
  exchange_id text not null references exchanges (id) on delete cascade,
  author_id uuid not null references auth.users,
  seq int not null check (seq between 1 and 4),
  quoted_claim text not null check (char_length(quoted_claim) between 10 and 300),
  body text not null check (char_length(body) between 150 and 1200),
  screen_result text not null default 'pending' check (screen_result in ('pending','ok','flagged','removed')),
  screen_reason text,
  created_at timestamptz not null default now(),
  unique (exchange_id, seq)
);

alter table debates add column seeking_counterpart_at timestamptz;   -- set by opt-in, cleared on pairing

create table blocks (blocker_id uuid references auth.users, blocked_id uuid references auth.users, created_at timestamptz default now(), primary key (blocker_id, blocked_id));
create table reports (id text primary key, turn_id text references turns (id), reporter_id uuid references auth.users, reason text check (reason in ('harassment','personal_info','off_topic','spam','other')), note text check (char_length(note) <= 300), created_at timestamptz default now(), resolved_at timestamptz);

alter table exchanges enable row level security;
alter table turns enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
create policy "exchange read party" on exchanges for select using (auth.uid() in (user_a, user_b));
create policy "turn read party"     on turns for select using (screen_result = 'ok' and exists (select 1 from exchanges e where e.id = exchange_id and auth.uid() in (e.user_a, e.user_b)));
create policy "turn read own"       on turns for select using (auth.uid() = author_id);
create policy "blocks own"          on blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "reports insert own"  on reports for insert with check (auth.uid() = reporter_id);
-- exchanges and turns are written only by server routes with the admin client. No update policies.
-- Public read-only view, admin client only, rows where publish_a and publish_b and status = 'complete':
create view exchanges_public as select e.id, e.topic_slug, e.school_a, e.school_b, e.debate_a, e.debate_b, e.created_at from exchanges e where e.publish_a and e.publish_b and e.status = 'complete';

```

Account deletion cascades `exchanges`, `turns`, `blocks`, `reports` where the user is a party; the other party's exchange shows `Your counterpart has left.` and closes as `lapsed`.
Opt-in and pairing (`src/app/debate/actions.ts#seekCounterpart`, called from a button on the owner's verdict page, original debates only, not rejected, not revisions):

* Button label: `Find a counterpart`. Under it, Plex Sans, `text-ink-mid`: `Someone who argued this motion from another school will see your argument and answer one claim in it. Nobody else sees it. Two replies each, then it closes.` The action sets `seeking_counterpart_at`. The button becomes `Waiting for a counterpart` (no count, no ETA).
* Pairing is attempted inside the same action: find the oldest debate on the same `topic_slug` with `seeking_counterpart_at` set, a different school, a different user, no `blocks` row in either direction, and no open exchange between the pair. If found: create the exchange, clear both `seeking_counterpart_at`, set `next_turn` to the newer seeker (they just arrived and have context). If not found: return. No cron, no queue, no notification — the next opt-in on that topic completes the pair.
* Consent is the opt-in itself; the argument becomes visible to the counterpart only, via the exchange page, regardless of `argument_public`.

Turn rules (`src/app/api/counterpart/turn/route.ts`, POST, auth):

* Order is strictly alternating, `seq` 1–4. Turn 1 and 3 by the opener, 2 and 4 by the other. `next_turn` enforced server-side.
* Every turn must quote 10–300 characters from the counterpart's argument (turns 1–2) or their previous turn (turns 3–4). Verify the quote is a substring, ignoring whitespace; refuse otherwise with `Quote the sentence you're answering.`
* Body 150–1,200 characters, enforced server-side.
* Screening before delivery: one `claude-haiku-4-5` call, `max_tokens: 60`, system prompt in `content/prompts/screen.v1.md`: classify the turn as `ok` or one of `harassment | personal_info | off_topic | spam`, where `personal_info` covers any name, school name, location, handle, phone or link; `off_topic` means it does not address the quoted claim. Returns `{"result": "...", "reason": "≤ 20 words"}`. `// COST: model=claude-haiku-4-5 | trigger=counterpart turn | est_in=450 est_out=30 | est_usd_per_call=0.0006 | cap=8/user/day | kill_switch=KILL_SWITCH_SCREEN | logged_to=ai_calls kind='screen'`. Widen `ai_calls_kind_check` to allow `'screen'` in the migration. Budget check via `lib/budget.ts` applies. If the screen is paused or errors, the turn is stored as `pending` and not delivered; the author sees `Your reply is saved and will be delivered once it has been checked.` Never deliver an unscreened turn.
* `ok` → `screen_result='ok'`, `next_turn` flips, `last_turn_at` updated; after `seq = 4`, `status='complete'`. `flagged` → held; author sees `This reply was held for review.` and cannot post another turn in that exchange until it is resolved. Flagged turns and reports are reviewed with `scripts/review-turns.ts` (same shape as `review-verdicts.ts`): approve → `ok`; remove → `removed`, author gets one line on the exchange page `A reply was removed for breaking the rules.`
* Lapse: an exchange with `status='open'` and `last_turn_at` older than 14 days is shown as lapsed on `/me` and closed on next view. No reminder, no email.

Route `/counterpart/[id]/page.tsx` (dynamic, participants only, 404 otherwise). Layout top to bottom: motion in Spectral; two eyebrows in school colours as text, `You · Stoicism` and `Counterpart · Utilitarianism`; the two original arguments side by side on desktop, stacked on 375 px, each in Spectral with a Plex Sans label; then the turns in order, each showing the quoted claim as an indented Spectral quote and the body beneath; then, if it is your turn, `TurnComposer` (client component, small): a quote picker (select text in the counterpart's argument or last turn; the selection fills a read-only `quoted_claim` field — on mobile, a fallback textarea where they paste the sentence), the body textarea with a mono character count, and `Send reply`. If it is not your turn: `Waiting for your counterpart.` Every turn carries `Report` and `Block` as text links in `text-ink-soft`; `Block` confirms once (`Blocking ends this exchange and you won't be paired again. Continue?`) and sets `status='blocked'`. After `complete`: a toggle for each party, `Let others read this exchange`, default off; the exchange is published only when both are on, and it then renders read-only beneath both verdict pages with display names or `A Stoic` etc.
`/me`. New component `src/components/me/OpenExchanges.tsx` directly under `OpenObjections`: eyebrow `Your counterpart is waiting` (rows where `next_turn = me`) and `Waiting on your counterpart` (rows where not). Each row: topic title, the other school as an eyebrow, `Reply` button or plain text. Lapsed and complete exchanges appear in debate history under their motion.
Rules page. Add a short section to `/debate/rubric` titled `Counterpart rules`: quote the sentence you're answering; 150–1,200 characters; two replies each; no names, schools, locations or links; replies are checked before delivery; report or block from any reply.
Events. `counterpart_sought { debate_id }`, `counterpart_paired { exchange_id, topic_slug }`, `turn_submitted { exchange_id, seq, chars }`, `turn_held { exchange_id, reason }`, `exchange_completed { exchange_id }`, `exchange_published { exchange_id }`, `exchange_blocked { exchange_id }`, `turn_reported { turn_id, reason }`.
Acceptance.

* [ ] Two accounts on the same motion, different schools, both opt in; an exchange is created; four turns complete in strict alternation; a fifth is refused.
* [ ] A turn without a valid quote is refused; a 149-character body is refused; a 1,201-character body is refused.
* [ ] A turn containing a phone number is held (`personal_info`); `review-turns.ts` can approve or remove it; the counterpart never sees a held turn.
* [ ] RLS: a third account cannot read the exchange or any turn (paste the failing queries); `ai_calls` rows with `kind='screen'` exist for every turn including refused-by-screen ones.
* [ ] Block closes the exchange and prevents re-pairing; report inserts a row and the turn stays visible until reviewed.
* [ ] Publishing requires both toggles; the public render shows no handles beyond `display_name` / `A Stoic`.
* [ ] `/counterpart/[id]` on 375 px: no horizontal scroll; composer under 15 kB gzipped; `next build` shows Phase 1 routes unchanged.
* [ ] `KILL_SWITCH_SCREEN=true` stops delivery of every new turn with the saved-and-waiting message.

Effort. 6–8 days. Regression risk. The verdict page gains a second owner-only action (`Find a counterpart`) beside `Answer it`; keep `Answer it` primary and `Find a counterpart` a secondary text button so the revision loop stays the main path. Do not: show queue sizes, add a browse-exchanges page, allow more than four turns, deliver anything unscreened, or send email.
Task 9 — Teacher class link
Goal. A teacher can see which of their students have read, argued, answered and closed each motion. Nothing else.
Migration `0011_classes.sql`.

```sql
create table classes (id text primary key, code text unique not null, owner_id uuid not null references auth.users, name text not null check (char_length(name) <= 60), created_at timestamptz default now());
create table class_members (class_id text references classes (id) on delete cascade, user_id uuid references auth.users on delete cascade, joined_at timestamptz default now(), primary key (class_id, user_id));
alter table classes enable row level security; alter table class_members enable row level security;
create policy "class read owner or member" on classes for select using (auth.uid() = owner_id or exists (select 1 from class_members m where m.class_id = id and m.user_id = auth.uid()));
create policy "class insert own" on classes for insert with check (auth.uid() = owner_id);
create policy "member read own or owner" on class_members for select using (auth.uid() = user_id or exists (select 1 from classes c where c.id = class_id and c.owner_id = auth.uid()));
create policy "member join self" on class_members for insert with check (auth.uid() = user_id);
create policy "member leave self" on class_members for delete using (auth.uid() = user_id);

```

Codes are 8 lowercase letters/digits, unguessable, generated server-side. One user may own up to 5 classes and join up to 5.
UI.

* `/me/settings`: section `Classes`. `Create a class link` (name field, then shows the code and a copyable link `/me/settings?join=CODE`). `Join a class` (code field). Each joined class lists with `Leave`. Copy under the join field: `Your teacher will see which motions you've read, argued and answered — not your arguments, scores or rating.`
* `/class/[code]/page.tsx` (dynamic, owner only, 404 otherwise): class name; one row per member showing `display_name` or `A Stoic` etc., their school as an eyebrow, and the four case ticks per motion from Task 5's `getCaseState`. No scores, no ELO, no streak, no argument text, no sort by performance. Members listed by join date.
* A member can see the class name and member count on `/me/settings`, nothing about other members.

Events. `class_created`, `class_joined { class_id }`, `class_left { class_id }`, `class_viewed { class_id, members }`.
Acceptance.

* [ ] A teacher account creates a class; two student accounts join by code; `/class/[code]` shows both with correct ticks after one of them closes a case.
* [ ] A member cannot open `/class/[code]`; a non-member cannot join without the code; RLS failing queries pasted.
* [ ] No score, ELO, streak or argument text appears anywhere on `/class/[code]` (grep the rendered HTML).

Effort. 2 days. Regression risk. `getCaseState` per member per motion is 6 × N queries; batch it into one query per class. Do not: add assignments, deadlines, grades, messaging, or a teacher role flag — ownership of a class is the only distinction.
LATER — build only when the trigger is met
Deferred, with the trigger that unlocks each

* Exemplary-arguments gallery (`/debate/[slug]/read`): trigger = ≥ 50 arguments with `argument_public = true` across the six motions. Design: per motion, up to three arguments per school chosen by Arthur with `scripts/feature-arguments.ts` (sets `debates.featured_at`), rendered read-only in Spectral with school eyebrow and display name or `A Stoic`; no scores shown, no ordering by score, no voting. Purpose is to show what a faithful argument looks like before someone writes their first.
* Weekly digest email: trigger = Phase 4 per the Phase 2 brief, and only if the "second debate or revision within 7 days" funnel is below target after four weeks. One email, once a week, only to users with an open objection or a waiting counterpart, listing those two things and nothing else. Unsubscribe in one tap. Never a streak or loss message.
* `/courses/[school]` sequence page: trigger = case-closers return within seven days at a meaningfully higher rate than non-closers over four weeks. Design: the six motions in `sort` order for that school with the four ticks each, the weekly motion marked, and one button on the first unclosed case. No other content.

5. Explicitly forbidden
Refuse to build these even if asked mid-task; point back here.

* Streak-loss nudges, reminders or emails about a streak; any change to the existing streak rule without a new decision.
* A global or school leaderboard; any public ranking.
* Public feed, comments, open replies on debates, likes, followers, DMs. (Counterpart is not a comment section: paired, quoted, two turns, private.)
* Video lessons; long expository modules; LMS features (gradebooks, rosters, certificates).
* Multiple-choice quizzes as a learning mechanism; graded reading prompts.
* Push notifications; email nudges before Phase 4.
* Percentages on the result card or OG images.
* Any sign-in prompt on `/quiz`, `/quiz/result`, `/r/[id]` or `/c/[id]`.
* New client-side dependencies; any JS on the four protected routes; dark mode.
* A second model call per judgement; a cheaper model substituted silently; `temperature` on `claude-sonnet-5`.
* Editing an original argument in place; revisions that move ELO; more than one revision per original.

6. Verification and instrumentation
Funnels (PostHog project 264751, EU):

1. Quiz completed → signed in (`quiz_completed` → `signup_completed`).
2. Signed in → first debate submitted (`signup_completed` → `debate_submitted`).
3. First debate submitted → second debate within 7 days (`debate_submitted` → `debate_submitted`, 7-day window).
4. New: first debate submitted → second debate or revision within 7 days (`debate_submitted` → `debate_submitted | revision_submitted`).
5. New: objection opened → objection resolved within 7 days (`objection_viewed{is_owner}` → `objection_resolved`).
6. New: counterpart sought → exchange completed (`counterpart_sought` → `exchange_completed`), and paired → first reply within 7 days (`counterpart_paired` → `turn_submitted{seq:1}`). Put all URLs in `docs/decisions.md`.

Before marking any task done:

* `next build` output pasted; `/`, `/quiz` `○`; `/s/[school]` `●`; shared JS unchanged.
* Lighthouse mobile for the five routes in Task 6.
* RLS: paste the failing cross-user queries for `debates`, `reading_responses`, `ai_calls`.
* Golden set: two consecutive runs on the current prompt version, both tables pasted.
* A 375 px walkthrough of the changed screens, described in one paragraph each.
* `grep -rn "anthropic" --include=*.ts src tests` shows exactly the documented call sites: `/api/judge`, `/api/counterpart/turn`, `run-golden.ts`.

7. Sources appendix
Empirical claims behind Section 3. Consult if a decision needs re-justifying; do not put citations in UI copy.

* Resumption of interrupted tasks (Ovsiankina effect) replicates while the Zeigarnik memory effect does not — 2025 meta-analysis summary: https://spacedaily.com/j-v-the-zeigarnik-effect-helps-explain-why-unfinished-goals-can-feel-louder-than-completed-ones-but-modern-research-suggests-the-minds-pull-toward-open-loops-is-far-more-conditional-than-the/
* Retrieval practice beats rereading for durable retention: Roediger & Karpicke 2006, https://doi.org/10.1111/j.1467-9280.2006.01693.x ; meta-analysis Adesope, Trevisan & Sundararajan 2017, https://doi.org/10.3102/0034654316689306
* Questions embedded in a text raise motivation, comprehension and self-reported retention (ReaderQuizzer, 16-participant study): https://arxiv.org/pdf/2308.07988
* Giving and receiving structured peer feedback both improve writing (systematic review): https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1506725/full
* Gamification raises intrinsic-motivation measures but has minimal effect on competence (meta-analysis): https://link.springer.com/article/10.1007/s11423-023-10337-7
* Duolingo's own streak evidence (daily-reps product; not transferable as-is): https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/
* LLM-as-judge reliability and biases: https://arxiv.org/html/2506.13639v1
* Kialo's invite-gated model and teacher use: https://www.techlearning.com/how-to/what-is-kialo-best-tips-and-tricks
* WCAG 2.2: https://www.w3.org/TR/WCAG22/ (2.5.8 Target Size, 2.4.11 Focus Not Obscured, 3.3.8 Accessible Authentication)
* Core Web Vitals thresholds: https://web.dev/articles/vitals
* Anthropic model pricing: https://www.anthropic.com/pricing
* Supabase free-tier inactivity pause: https://supabase.com/pricing
* Vercel Hobby limits (cron once per day, function limits): https://vercel.com/docs/limits
* UK Age Appropriate Design Code: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/