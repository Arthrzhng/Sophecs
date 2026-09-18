# Modules

Longer teaching units, one `.md` file each. Empty at launch — the lessons
index ships complete without them and grows a "Modules" section the moment
the first file lands here.

Frontmatter only, same convention as `content/schools/` and
`content/micro/`: the body is a frontmatter field, not markdown below the
frontmatter.

```yaml
id: what-is-up-to-us
school: stoicism
title: What is up to us
quiz_excerpt: >-
  One or two sentences shown beside the quiz result for this school. Plain
  prose, no markdown.
debate_topics:
  - opaque-benefit
  - borrowed-judgement
sources:
  - author: Epictetus
    work: Enchiridion
    section: "1"
  - author: Cicero
    work: De Fato
    section: "39-43"
body: |-
  The module text. Paragraphs separated by a blank line, the same as a
  micro-lesson body.

  Footnote markers are written `[^1]`, `[^2]` and so on, and number into
  the `sources` list above in order: `[^1]` is the first source. A marker
  with no matching source is left as written rather than silently dropped.
```

Every field above is required except `body`, which may be omitted while a
module is being drafted — `src/lib/modules.ts` skips any file missing a
required field rather than rendering half a module, and says which file and
which field on the build log.

`school` must be one of `stoicism`, `utilitarianism`, `virtue-ethics`.
`debate_topics` must be slugs that exist in `content/topics/`.

No seed step: `src/lib/modules.ts` reads this directory at build time, the
same way `src/lib/micro-lessons.ts` reads `content/micro/`.
