<!--
Draft fidelity criteria for the three schools that have none.

NOT LOADED BY ANYTHING IN PRODUCTION. src/lib/judge/rubric.ts holds the
criteria the live judge uses, and `hasFidelityCriteria` returns false for
these three, so /api/judge refuses a submission from them rather than
judging it. Nothing a reader gets changes because this file exists.

Arthur approved these on 2026-10-24, and ruled that they stay here rather
than in rubric.ts until he publishes the three schools in Phase 3. One
thing reads this file: the golden runner, in eval mode only, through
tests/judge/draft-criteria.ts, so that Tier B can be scored against the
criteria as approved. tests/draft-criteria.test.ts proves that nothing in
src/ reads it and drives /api/judge to show it still refuses all three.

Sourcing, per Arthur's revision of 2026-10-24: quotations come only from
content/research/non-western-sources.md, and tests/content-quotations.ts
declares every quotation here so the guard checks it like any other:
eight, two in the criteria themselves (the Nguni maxim and Metz's
principle) and six in the notes below.
Doctrinal description does not carry that restriction, because the live
Stoic criteria describe indifferents without quoting anyone. So these
describe each school's central commitments rather than only the passages
the research file verified. Every doctrinal claim I was not sure of is
listed at the bottom instead of being asserted in the criteria.

Structure and length follow the three in rubric.ts: a paragraph on what the
school's reasoning commits to, then a paragraph naming the ways an argument
fails fidelity, including the bleeds from rival schools. The existing three
run 730 to 893 characters and 114 to 142 words, in two paragraphs; these
run 849 to 888 and 128 to 137.

Those are `.length` of the stored string, which is what
tests/judge-v3-and-refusal.test.ts asserts. An earlier revision of this
file said 729 to 892 and 838 to 887, having measured a copy with its
whitespace flattened: each criterion's one blank line turned two
characters into one, so every bound came out one low. All three still sit
inside the band either way.

The axes and the scale are untouched. Three criteria scored out of ten
each, one composite out of a hundred.
-->

# Draft fidelity criteria

Approved 2026-10-24. The live judge does not read this file; the golden
runner does, in eval mode only.

## `confucian` (Confucianism)

A faithful Confucian argument grounds its claim in roles and the
relationships that constitute them: you do not enter a relationship as a
finished individual, and what you owe attaches to a position rather than
being owed in the abstract. Its central terms are ren, the humaneness a
relationship realises, and li, the ritual propriety through which conduct is
done and learned. Cultivating oneself is native here, and proceeds through
roles and ritual rather than apart from them. Holding a name to its work,
after Book 13, is a strength where it appears.

Score fidelity down when the argument: reduces to what the system maximises
(utilitarian bleed); treats virtue as detached from roles, relationships and
ritual (virtue-ethics bleed); or asserts that relationships matter without
naming the relation, who owes what to whom, or what the position requires.

## `ubuntu` (Ubuntu)

A faithful Ubuntu argument grounds its claim in relational personhood: a
person is a person through other persons, so the stake is what people become
through one another, not what an agent gets alone. Metz's principle is that
right action honours capacities for relationships of shared identity and
solidarity. Menkiti's achieved personhood and Gyekye's moderate reading,
which keeps individual worth, are both faithful. A harm reads as a failure of
relationship, not only a bad output.

Score fidelity down when the argument: maximises expected utility
(utilitarian bleed); treats the community as a single stakeholder; or asserts
that community matters without naming whose relationships are at stake or who
was left out. Leaning on communal expectation is faithful; ignoring the charge
that it pressures dissenters costs engagement, not fidelity.

## `buddhist` (Buddhist Ethics)

A faithful Buddhist argument grounds its claim in non-harm,
intention, compassion and liberation, weighing suffering, dukkha, as what is
at stake. Volition weighs as much as what follows, and non-harm covers what
one incites as well as what one does. Two commitments shape it: anatta, no
fixed, bounded self, and dependent origination, what arises coming from
conditions, not one cause. The discourse to Rahula asks, before acting, while
acting and after, whether it tends to harm oneself, another, or both. A
later tradition's inference, such as the Mahayana argument from anatta to
impartial compassion, is faithful when argued.

Score fidelity down when the argument: maximises aggregate welfare, ignoring
intention and non-harm (consequentialist bleed); uses a good intention to
excuse damage a careless actor would be blamed for; or asserts non-harm
without naming who is still hurt.

## Doctrinal claims, and what Arthur ruled on

Arthur approved these criteria on 2026-10-24 with changes, which are made
above. This list is what is still disclosed rather than asserted, plus the
two items his ruling settled.

1. **Whether ren or li is prior.** The criteria call li the propriety
   through which conduct is done and learned, and ren the humaneness a
   relationship realises. That reads li as the medium and ren as what it
   realises, which is a common reading but not the only one; scholars
   differ on which term is prior and on whether ren is a disposition or an
   achievement. The criteria state no priority, and a reviewer noted that
   the phrase about proceeding through roles and ritual may imply one
   anyway.

   Arthur's ruling: the criteria stand, and the alternative reading gets a
   fixture. `confucian-ren-disposition` in `docs/phase2-fixtures.md`
   argues ren as a disposition and expects fidelity 8-10, so a judge that
   only credits the role-first reading fails a case rather than failing a
   student quietly.

   Separately: neither term appears anywhere in
   `content/research/non-western-sources.md`. The research file's only
   related wording is Vallor's virtue-ethics characterisation,
   "cultivated qualities such as humaneness, justice, honesty and
   practical wisdom". Under the pre-amendment rule these two words could
   not have been used at all.

2. **Harmony: withdrawn.** An earlier revision of these criteria said that
   an appeal to harmony is native to Ubuntu, on the ground that harmony is
   Metz's own principle. That ground was supplied from memory and is not in
   the research file, which gives Metz's principle as honouring "capacities
   for relationships of shared identity and solidarity" and never uses the
   word harmony for him. Its only mention of harmony is the line it calls
   the central Sophecs safeguard: an Ubuntu assessment must ask "whether
   appeals to harmony silence dissent."

   Arthur withdrew the claim and removed the word. The criteria now carry
   only the sourced formulation. What survives from that revision is the
   part that did not depend on harmony: leaning on communal expectation is
   faithful, and failing to answer the charge that it pressures dissenters
   costs engagement rather than fidelity.

3. **Later traditions: now admitted, which is a change.** The inference
   from anatta to impartial concern for all beings, on the grounds that a
   bounded self was never there to prefer, is Santideva's and belongs to a
   Mahayana line of argument, where the Sophecs passages are Pali and
   Theravada. An earlier revision stated anatta and stopped, leaving a
   student who made that inference unable to earn credit for it.

   Arthur ruled that inferences developed in later traditions are faithful
   when argued, and the criteria now say so with that example. The
   attribution to Santideva is itself unsourced: the name appears nowhere
   in the research file. It is a disclosure note, not a citation, and the
   criteria do not name him.

4. **Menkiti and Gyekye both faithful.** The criteria count Menkiti's
   reading, on which personhood is achieved through communal obligation,
   and Gyekye's moderate one, on which individuals keep inherent worth, as
   equally faithful. The research file sets them out as opposed positions
   and says the readings "overlap but are not interchangeable". So the
   criteria decline to choose where the sources record a real
   disagreement.

   Arthur's ruling: accepted as written. A student arguing from either
   reading is arguing Ubuntu. This item was left off the earlier version
   of this list although the decision list on pull request #44 said it
   should have been on it.

5. **Dependent origination and distributed responsibility.** Reading it as
   an account of why responsibility for an AI harm is spread across a
   supply chain rather than located in one actor would be an inference, not
   doctrine. The criteria state the commitment neutrally, as conditions
   rather than one cause, and draw nothing from it. Accepted as written.

6. **Dukkha as "suffering".** Standard in English, and the research file
   itself prints "lead to harm and suffering" in the Kalama Sutta row. The
   same file's guidance says not to reduce Buddhism to "reducing
   suffering", so the criteria weigh dukkha alongside intention, non-harm,
   compassion and liberation rather than in place of them. Accepted as
   written.

7. **Metz's phrasing.** The criteria use the research file's own wording.
   A reviewer noted that an earlier disclosure hedged it, saying the book had not
   been read, while the criteria stated it flatly. The research file
   supplies the wording, so the attribution is sourced; the hedge was
   about his other formulations and has been dropped. Accepted as written.
