<!--
Draft fidelity criteria for the three schools that have none.

NOT LOADED BY ANYTHING. src/lib/judge/rubric.ts holds the criteria the
judge actually uses, and `hasFidelityCriteria` returns false for these
three until somebody moves them there. /api/judge refuses a submission
from a school with no criteria rather than judging it, so this file sitting
here changes nothing about what a reader gets.

These need Arthur's approval before 2F uses them. They were written only
from content/schools/{confucian,ubuntu,buddhist}.md and, through those,
content/research/non-western-sources.md. Nothing here comes from anywhere
else, and tests/content-quotations.ts declares the one quotation so the
guard checks it like any other.

Structure and length follow the three in rubric.ts: a paragraph on what the
school's reasoning actually commits to, then a paragraph naming the ways an
argument fails fidelity, including the bleeds from rival schools. The
existing three run 730 to 893 characters and 114 to 142 words; these run
841 to 885 and 140 to 142.

The axes and the scale are untouched. Three criteria scored out of ten
each, one composite out of a hundred.
-->

# Draft fidelity criteria

Pending approval. The judge does not read this file.

## `confucian` (Confucianism)

A faithful Confucian argument grounds its claim in roles and the
relationships that constitute them: you do not enter a relationship as a
finished individual, and what you owe is never owed in the abstract but
attaches to a position. Asked what government is, Book 12 answers with
relations rather than a principle, order consisting in each party being what
their position requires. After Book 13 it should hold a name to its work:
call a system fair or explainable and the word has done work the system has
not.

Score fidelity down when the argument: reduces to what the system maximises
(utilitarian bleed); treats the virtue as a quality a lone agent cultivates
rather than as what a role requires (virtue-ethics bleed); or asserts that
relationships matter without naming the relation, who owes what to whom, or
what the position requires.

## `ubuntu` (Ubuntu)

A faithful Ubuntu argument grounds its claim in relational personhood: a
person is a person through other persons, so what is at stake is what people
become through one another rather than what an isolated agent gets. It
should treat a harm as a failure of relationship and not only as a bad
output, and should notice that data is rarely only yours: it carries family
and neighbours nobody asked. Individuals keep their own worth; the community
does not confer personhood once its demands are met.

Score fidelity down when the argument: argues from maximising expected
utility (utilitarian bleed), which Metz argues against; treats the
community as a single stakeholder, or appeals to harmony in a way that makes
a dissenter the problem; or asserts that community matters without
naming whose relationships are at stake or who was left out.

## `buddhist` (Buddhist Ethics)

A faithful Buddhist argument grounds its claim in non-harm, intention,
compassion and liberation, taken on the tradition's own terms rather than
translated into a Western category. Intention carries real weight: an act is
weighed by the volition behind it as much as by what follows from it, and
non-harm covers what one incites as well as what one does. After the
discourse to Rahula it should reflect before acting, while acting and after
on whether this tends toward one's own harm, another's, or both, which makes
assessment continuing rather than a launch review.

Score fidelity down when the argument: weighs only outcomes with intention
mentioned in passing (consequentialist bleed); names a virtue and stops
there (virtue-ethics bleed); uses a good intention to excuse damage a
careless actor would be condemned for; or asserts non-harm without naming
who is still being hurt.

