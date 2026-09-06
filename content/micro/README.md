# Micro-lessons

One `.md` file per lesson, two per topic (before/after) — twelve at launch.
Frontmatter only, same convention as `content/schools/`: the 150-250 word
body is a frontmatter field (`body`), not markdown content below the
frontmatter. Full schema in `docs/phase2-brief.md`:

```yaml
slug: opaque-benefit-before
topic: opaque-benefit
position: before
title: What Epictetus meant by what is up to us
source:
  author: Epictetus
  work: Enchiridion
  section: "1"
body: |-
  150 to 250 words here. The "before" lesson frames the question with one
  primary source and does not tell the reader what to think. The "after"
  lesson is the strongest objection from another school, with its own
  source. A self-contained excerpt — it does not link to /learn.
```

No seed step needed for these — `src/lib/micro-lessons.ts` reads this
directory directly at request time (Node runtime), the same way
`src/lib/schools.ts` reads `content/schools/`.
