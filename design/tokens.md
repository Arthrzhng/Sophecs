# Sophecs design tokens — plan

Status: **proposed, awaiting approval.** This is a plan document. No code
implements it yet; Phase 1 encodes it.

Paths in this document are the real ones: routes live under `src/app/`,
components under `src/components/`.

---

## 1. Palette

Every value below is a literal hex. Phase 1 encodes these once in
`src/app/globals.css` under Tailwind v4's `@theme` and nothing else declares
a colour.

### Base

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--paper` | `#F8F8F6` | Page background, every route | — |
| `--surface` | `#FDFDFC` | Raised fields: inputs, textareas, secondary buttons, table stripes | 1.05:1 on paper — a hairline does the separating, not the fill |
| `--ink` | `#141413` | Body text, headings, primary button fill | **15.9:1** on paper |
| `--ink-mid` | `#54544C` | Secondary prose, labels, inactive nav | **6.1:1** on paper |
| `--ink-soft` | `#63635B` | Metadata, counts, captions, placeholders | **4.8:1** on paper |
| `--border` | `#DEDEDA` | The only structural line in the product | 1.4:1 — decorative, never carries meaning alone |
| `--border-strong` | `#C4C4BE` | Hover state on interactive borders; table header rule | 1.9:1 |

Paper moved from `#E9E9E3` to `#F8F8F6` and ink from `#191917` to `#141413`.
The brief asks for near-white and slightly cool; the current paper is a full
shade darker and reads warm-grey next to white UI chrome. The new pair is
inside the brief's `#FAFAF8`–`#F7F7F4` range at the lighter end.

There is exactly one grey ramp (`ink-mid`, `ink-soft`, `border`,
`border-strong`). Four steps, all derived from the same hue as ink so
nothing looks blue or green against it.

### Semantic

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--error` | `#8A1C1C` | Destructive confirmations, over-limit counts, failed saves | **8.4:1** on paper |
| `--success` | `#141413` | Saved, sent, copied, complete | = ink |

Success is ink, per the brief: a confirmation is a statement of fact, not a
reward. A green tick is the single most common way a learning product starts
feeling like a game. The only differentiator for a success state is weight
and an explicit word ("Saved", "Copied"), never hue.

`--error` is the existing oxblood moved two steps darker and renamed. It is
deliberately *not* a school colour and deliberately not adjacent to the
Virtue Ethics oxblood in use — see the collision note in §7.

### School markers — frozen values, restricted use

| Token | Value | Contrast on paper |
| --- | --- | --- |
| `--stoic` | `#3E5C4B` | 6.4:1 |
| `--utilitarian` | `#8A6320` | 5.1:1 |
| `--virtue` | `#7A3540` | 7.5:1 |

The brief freezes these three hex values. **Corrected after measuring
against the final paper:** `#8A6320` measures **5.08:1** on `#F8F8F6` and
passes WCAG AA for body text. The earlier draft of this document said it
failed at 4.3:1 — that figure was against the old darker paper `#E9E9E3`.
Lightening paper fixed the contrast problem by itself.

The usage rule below therefore is not an accessibility workaround; it is a
design rule, and it stands on its own. A school colour may only be used as:

1. A 2px left rule or a 1px underline on a school-specific surface.
2. A filled card background, paired with `--on-saturated` (see below).
3. Large text only — 24px/1.5rem or above, where the 3:1 threshold applies
   and `#8A6320` passes at 4.3:1 with room to spare.

A school colour is **never** used for text below 24px, never for a link,
never for a button, never for an icon, never for a focus ring. This is a
stricter rule than "tribal markers only", and it is what makes the frozen
palette compliant rather than requiring me to alter a value you froze.

(This reverts a change made earlier in the project, which darkened
utilitarian to `#87611F` to clear AA at eyebrow size against the old paper.
The frozen `#8A6320` is restored and passes on its own merits now.)

### Saturated card surfaces — the one exception

| Token | Value | Paired ink | Contrast |
| --- | --- | --- | --- |
| `--stoic-surface` | `#33503F` | `--on-saturated` | 8.4:1 |
| `--utilitarian-surface` | `#7A5518` | `--on-saturated` | 6.3:1 |
| `--virtue-surface` | `#6B2C37` | `--on-saturated` | 9.7:1 |
| `--on-saturated` | `#FAF8F2` | — | — |

These four exist for the quiz result card and its OG/PNG renders, and for
nothing else. Any other component that references them is a bug.

---

## 2. Type scale

Six steps. Every text element uses one. No `text-[17px]`, no
`text-[clamp(...)]`.

| Step | Size | Sans (interface) | Serif (reading) | Mono (measured) |
| --- | --- | --- | --- | --- |
| `--text-xs` | 12px | 1.4, 400 | — | 1.4, 400 |
| `--text-sm` | 14px | 1.45, 400 | — | 1.4, 400/500 |
| `--text-base` | 16px | 1.5, 400 | 1.65, 400 | 1.4, 500 |
| `--text-md` | 19px | — | 1.65, 400 | — |
| `--text-lg` | 24px | 1.3, 500 | 1.4, 500 | 1.3, 500 |
| `--text-xl` | 34px | — | 1.2, 500 | 1.2, 500 |

Rules that fall out of this table:

- **Serif never appears below 16px.** Spectral at 14px is illegible on a
  phone and is the single thing that most makes a reading site look styled
  rather than read.
- **Sans never appears above 24px.** A large sans heading is interface
  language used at display size; headings that big are always content.
- **Mono appears at three sizes and only ever holds a number.** Never a
  label, never an eyebrow, never a date, never a slug. If it is not a value
  you could plot, it is not mono.
- `--text-md` (19px) exists solely for serif reading body. It is the only
  step with one family.
- Line-height per the brief: serif 1.65, interface sans 1.4–1.5.

### Weights

Two per family, hard limit.

- Spectral: 400 (body), 500 (headings). The 400-italic face stays for block
  quotations only.
- IBM Plex Sans: 400 (body), 500 (buttons, labels, nav-active). Shipped as
  one variable file; the 600 axis is never requested.
- IBM Plex Mono: 400 (secondary values), 500 (primary values).

`spectral-600.woff2` was already deleted. `plex-sans-var.woff2` covers
400–600; Phase 1 must confirm no call site asks for 600.

### Measure

- Reading content: `max-width: 66ch`. The brief says 60–72; 66ch at 19px
  Spectral is ~640px, which sits well inside the 720px reading container.
- Interface prose (labels, helper text, empty states): `max-width: 54ch`.
- Both are tokens (`--measure-read`, `--measure-ui`), not per-component
  `max-w-[54ch]` arbitraries. There are 44 of those today.

---

## 3. Spacing

One 4px scale, eight steps. Nothing else.

| Token | px |
| --- | --- |
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 24 |
| `--space-6` | 32 |
| `--space-7` | 48 |
| `--space-8` | 80 |

The jump from 48 to 80 is deliberate. Section breaks in a reading document
should be unmistakable; a 64px gap next to a 48px gap is a distinction
nobody perceives, so the scale skips it. Tailwind's default `space-16`
(64px) is not available.

Vertical rhythm: a section is separated from the next by `--space-7` plus a
1px `--border` rule. Content inside a section uses `--space-4` and
`--space-5`. Nothing uses `--space-8` except the page's top and bottom
gutters.

### Containers

| Token | Width | Used by |
| --- | --- | --- |
| `--container-ui` | 960px | Arena index, profile, settings, class view, styleguide |
| `--container-read` | 720px | Lesson, verdict, write-argument, school page, rubric |
| `--container-narrow` | 560px | Quiz question, login, share landing, 404 |

Three containers, not the five max-widths (`max-w-2xl`, `3xl`, `xl`, `sm`,
plus arbitraries) in use today. Horizontal page gutter is `--space-5` (24px)
at every breakpoint including mobile — the brief's 16px minimum with room.

---

## 4. Radius

Two values, applied by kind, per the brief's "not the same radius on
everything".

| Token | Value | Applies to |
| --- | --- | --- |
| `--radius-control` | 6px | Buttons, inputs, textareas, selects, the share sheet's tap targets |
| `--radius-container` | 0 | Content containers, table cells, the result card, quoted blocks, dialogs |

Content containers are square. This is the choice that most separates the
result from the default look: rounded content boxes on a cream background
is the shape of every AI-generated landing page, and a squared content edge
against a 6px control reads as a document with controls on it rather than a
UI with text in it.

The one deliberate exception: the **result card** is square. It is a poster,
and posters have corners.

Today 43 of 44 radius usages are `rounded-md` — one value on everything.

---

## 5. Shadows

Two definitions. Both reserved for elements that genuinely float above the
page and could be dismissed.

| Token | Value | Applies to |
| --- | --- | --- |
| `--shadow-raised` | `0 1px 2px rgb(20 20 19 / 0.06), 0 2px 6px rgb(20 20 19 / 0.06)` | Dropdown menus, the mobile section-nav dropdown |
| `--shadow-overlay` | `0 4px 12px rgb(20 20 19 / 0.10), 0 16px 40px rgb(20 20 19 / 0.12)` | Dialogs, the share sheet |

**The result card loses its shadow.** It currently carries
`shadow-[0_1px_2px…,0_8px_24px…]`, which is the only shadow in the codebase
and is on a content element. A saturated card on near-white paper already
separates by 8:1 of luminance; a drop shadow on top of that is the detail
that makes it read as a "card component" instead of a printed object.

Nothing else in the product has a shadow. Structure is hairlines.

---

## 6. Motion

| Token | Value |
| --- | --- |
| `--duration-fast` | 120ms |
| `--duration-base` | 180ms |
| `--easing` | `cubic-bezier(0.2, 0, 0, 1)` |

Permitted, and this is the complete list:

1. Disclosure open/close (micro-lesson collapse, footnote reveal, section
   nav dropdown) — height and opacity, `--duration-base`.
2. Dialog and share-sheet entry — opacity only, `--duration-fast`.
3. The verdict reveal — the one deliberate moment in the product.
4. Focus ring appearance — instantaneous, no transition.

Forbidden: hover transitions on colour or opacity, entrance animations on
scroll, any transform, any transition on a page or section mount.

The existing `transition-colors` (2) and `transition-opacity` (4) all go.
A button that fades its background on hover is a 180ms delay between the
user's intent and the product's acknowledgement, for no information.

`prefers-reduced-motion: reduce` zeroes all four durations globally. That
rule already exists and stays.

---

## 7. Notes on collisions and constraints

**Utilitarian ochre vs. error red.** `#8A6320` and `#8A1C1C` share a
lightness. They never appear on the same surface: school colour is confined
to school-specific surfaces (§1), error to form and confirmation states.
Neither ever carries meaning by hue alone — a school is always named in
text, an error always has an error message.

**`--success` is ink, so there is no green.** The Stoic marker `#3E5C4B` is
the only green in the product and it means Stoicism, nowhere else. A green
"saved" state would collide with it semantically, which is the second reason
success is ink rather than the first.

**No dark mode.** The spec forbids it. `:root { color-scheme: light }` stays
and no token gets a dark counterpart. The existing comment in `globals.css`
saying dark mode is a Phase 1 non-goal remains accurate.

**Tailwind v4, not `tailwind.config`.** The brief says "map them into
`tailwind.config`". This project is on Tailwind v4, where the idiomatic
mechanism is CSS-first `@theme` in `globals.css` and a `tailwind.config.ts`
is not read for theme values. Phase 1 will use `@theme`; the contract the
brief asks for (utilities reference variables, not literals) is identical.
Flagging rather than silently substituting.
