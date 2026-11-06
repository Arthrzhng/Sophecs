# Quiz v2

Stage 3 of the brief of 2026-11-03. **Built on SIX_SCHOOLS builds only**,
in Stage 5, step 4 (`docs/decisions.md`, "Stage 5, step 4"); production
still runs v1. Every choice below is a philosophy or content judgement and
is Arthur's (CLAUDE.md item (e)).

**Ruled on 2026-11-05** (Checkpoint A, item 15; `docs/decisions.md`,
"Arthur's rulings of 2026-11-05 on Checkpoint A"): the axes, their plain
names and the six positions are accepted as drafted, Ubuntu at 0 degrees
and Buddhist Ethics at 310 included; the weighted options (section 5) are
accepted; five options are reworded, keeping their schools and vectors
(section 3, "The rulings' option edits"), and the simulation
re-run, with the same results; 1a, 10b, 3d, 5b, 6d, 9a and 8c stay as
written; and there is no rule-based school. Quiz v2 ships at launch.
The copy's AI framing is reworded now (section 8).

- The questions, options, school positions and weights are in
  `docs/quiz-v2.json`.
- `scripts/simulate-quiz-v2.mjs` reads that file, scores every possible
  answer pattern and reports where they land. Run it with
  `node scripts/simulate-quiz-v2.mjs`. It exits non-zero if a school is
  unreachable, lands outside 8% to 30%, or a school's persona misses its
  school, and also if a school has no weight or an option's vector does
  not match its school's angle and weight.

Quotations from the school pages are from `content/schools/*.md`, and
those from the research file are from `content/research/non-western-sources.md`.

## 1. The two axes

The brief's starting proposal: **individual to relational** (where moral
concern sits) and **outcomes to character or role** (what makes an act
right).

**Recommendation: use this pair**, under these plain names:

| Axis | One end | Other end |
| --- | --- | --- |
| Who it is about | each person on their own | people through each other |
| What makes it right | how it turns out | who you are and what you owe |

The first axis needs one gloss, given in the argument against below: it
measures whether relationships carry moral weight in themselves, not
whether you think about yourself or about others.

### For

- **It separates the pairs that most need separating, the way the pages
  themselves separate them.** Virtue Ethics and Confucianism both answer
  "what makes it right" with something other than results. The Confucian
  page draws the line itself: "Sophecs reads it as role ethics, after Roger
  Ames and Henry Rosemont, not as the virtue ethics of cultivated qualities
  Shannon Vallor sees." The first axis is what carries that line. One page
  says "You do not enter relationships as a finished individual; the
  relationships constitute you"; the other says "Real virtue needs the act
  to come from a firm, settled character".
- **Stoicism and Ubuntu sit at opposite ends of the first axis on their own
  pages' terms.** On one side is "the one act nothing external can reach";
  on the other, "A person is a person through other persons". The Ubuntu
  page's own objection makes the point from the other side: "Stoics would
  add that a self defined through others has handed away the one thing
  that was its own."
- **A fifteen-year-old can recognise each end in their own answers.**
  "Does this depend on how it turns out, or on who I am and what I owe?"
  needs no philosophy word.

### Against

- **Character and role share an end of the second axis**, though the
  Confucian page sets them apart. The first axis carries the difference,
  so the map still separates the two schools. A reader told "who you are
  and what you owe" may still hear one thing, not two.
- **Utilitarianism is not "individual" in the sense of being about
  yourself.** It is impartial: "A unit is a unit, whoever feels it." It
  sits on the "each person on their own" side only because each person's
  good is counted on its own and relationships carry no weight in
  themselves. Its own page's objection, from Rawls, runs the other way: it
  "treats a whole society's welfare the way one person treats trade-offs
  across their own life". So the first axis has to be read as "do
  relationships themselves matter", which is the gloss above.
- **Buddhist ethics resists both axes.** The research file records four
  classifications: virtue ethics (Keown), character consequentialism
  (Goodman), different answers for Theravada and Mahayana, and Hallisey and
  Garfield's refusal of the Western categories altogether. The Buddhist
  page follows the last. Any point on this map is a choice the page itself
  declines to make. Section 2 says how it is placed anyway.

### Two alternatives, and why not

- **What you meant to how it went (inner to outer).** This runs together
  with the first axis: Stoicism is both inner and individual, Ubuntu both
  outer and relational. The six schools would fall along one diagonal,
  which is a single axis in two dimensions.
- **Rules to results.** None of the six pages presents its school as a
  rule-based ethics, so one end would be close to empty. That is a reading
  I am not certain of, and it is on Arthur's list: Buddhist Ethics' page
  leads with a precept ("neither kill nor incite to kill"), and the
  research file lists deontology among the Western categories Hallisey and
  Garfield decline to fit Buddhist ethics into.

## 2. The six positions

**Every school sits at the same distance from the middle, so the map is
read by direction.** A reader who answers at random lands near the middle:
in the simulation, half of all answer patterns land within 0.23 of it, on
a map whose schools sit at 1. A school placed nearer the middle than the
others would collect most of those readers. So each school's position is
an angle, and the angles are chosen so that the order of the schools along
each axis matches the pages.

x runs from each person on their own (-1) to people through each other
(+1); y runs from how it turns out (-1) to who you are and what you owe
(+1).

| School | Angle | x | y | Why, from the page | Contested? |
| --- | --- | --- | --- | --- | --- |
| Confucianism | 50° | 0.64 | 0.77 | "You do not enter relationships as a finished individual; the relationships constitute you", and "What you owe is never owed in the abstract." | Yes, on x. Vallor's virtue reading (research file, "Classification dispute") would move it towards Virtue Ethics, which section 1 says is the line the first axis carries. The page rejects that reading by name. |
| Virtue Ethics | 110° | -0.34 | 0.94 | "Real virtue needs the act to come from a firm, settled character, not a one-off correct output." It is the furthest towards character. | A judgement on x, not a dispute in Sophecs's sources. It is left of middle because the character is the person's own. It is not further left because the objection the Stoicism page gives Virtue Ethics is that character is "something built by acting well among other people". |
| Stoicism | 165° | -0.97 | 0.26 | What is in our power holds almost nothing "except one act: giving or withholding assent", and your standing lives "not in outcomes you never controlled, but in the one act nothing external can reach." | Possibly, on x. The page reads the school through Epictetus on what is in our power. Stoic cosmopolitanism, concern widening to all people, would pull it towards the middle. It is not in Sophecs's research file, so it is named here and not cited. |
| Utilitarianism | 245° | -0.42 | -0.91 | "the right act is whichever produces the largest net sum of good over harm, added across everyone it touches. A unit is a unit, whoever feels it." It is the furthest towards outcomes. | On x, as the argument against in section 1 says: it is impartial rather than self-regarding. |
| Buddhist Ethics | 310° | 0.64 | -0.77 | The method on its page is to reflect "on whether it tends toward your own harm, another's, or both", and the line it leads with is "Treating others like oneself". | **The most contested of the six**, on both axes (research file, four positions). It is on the outcomes side because the page's method weighs what an act does, to oneself and to others. It is short of Utilitarianism on y because "an act is weighed by the volition behind it as much as by what follows". |
| Ubuntu | 0° | 1.00 | 0.00 | "A person is a person through other persons". It sits in the middle of y because its page's test is whether people "flourish through one another", while "Metz argues against building systems to maximise expected utility." | Yes, on y. The research file summarises Menkiti's view as "normative personhood is achieved through morally fulfilling communal obligations", which would move it towards role. The Ubuntu page places Gyekye's "moderate version" between Metz and Menkiti, which would move it the same way, less far; but its gloss, "insisting individuals keep their own worth and rights", points towards the individual end of x. Both readings are Arthur's to weigh. Sophecs "takes Thaddeus Metz's relational reading" (the Ubuntu page). |

Order along x, from each person on their own: Stoicism, Utilitarianism,
Virtue Ethics, then Confucianism and Buddhist Ethics (level), then Ubuntu.
Order along y, from how it turns out: Utilitarianism, Buddhist Ethics,
Ubuntu, Stoicism, Confucianism, Virtue Ethics.

## 3. The ten questions

Everyday situations: school, friends, family, a phone, a team. The brief
asked for no philosophy vocabulary and no option that is obviously the
nice one.

Each question has four options, each leaning towards a different school.
Across the forty options:
- Confucianism, Virtue Ethics, Stoicism and Utilitarianism have seven
  options each;
- Buddhist Ethics and Ubuntu have six each.

**How an option's vector is set.** It is its school's direction times a
weight. The weights are what section 5 tunes: 1.0 for Stoicism and
Utilitarianism, 0.95 for Buddhist Ethics, 0.9 for Ubuntu, and 0.8 for
Confucianism and Virtue Ethics. The quiz would show neither the
"Leans" column nor the vectors. Option order would be fixed as written.

**The rulings' option edits (2026-11-05).** Arthur reworded five of the
options below, each keeping its school and its vector: 2c no longer
shades the truth; 5c and 7a now speak up once and let the outcome go,
rather than stepping back; 7c no longer calls staying quiet cowardly;
and 6b gives the older sibling a duty as well as a claim. He kept 1a,
10b, 3d, 5b, 6d, 9a and 8c as written. The two lists that follow are the
review notes he ruled on, kept as they were.

**Options I am least sure pass the "obviously nice" test**, for Arthur's
eye:
- 3d, "decided together";
- 5b, "Do what an honest person would do here, even if it costs me friends";
- 6d, "Be patient with him";
- 7c, "Keeping quiet would be cowardly", which also casts 7a, the one
  option that stays quiet, as cowardly;
- 9a, "Being someone people can trust".

Each is a real position, but it may read as the answer a teacher wants.

**Options that may undersell their school**, the opposite risk, also for
Arthur, from review:
- Utilitarianism, 2c: "even if that is not quite what I think" makes it
  the option that shades the truth.
- Stoicism, 1a, 5c, 7a and 10b: all four read as stepping back, where the
  Stoicism page says "That isn't resignation."
- Confucianism, 6b: the older sibling sets the rules with no duty in
  return, where the page asks whether people "can still hold each other
  to what they owe".

Two were redrafted after review. 3b had read as a head count ("fewer
people upset"), indistinguishable from Utilitarianism, with nothing of the
intention the Buddhist page weighs; it now asks both why you want each
choice and who it would hurt, which is the page's "as much as". 8c had
led with using the AI unseen, which encoded the textbook objection to
Utilitarianism rather than its reasoning; it now weighs good and harm to
everyone, the reader's own learning included. It is still the only
option under which using the tool could come out right, because only a
sum can favour it; Arthur may want that kept or changed (he kept it, on
2026-11-05). Neither change
moves an option's school, so the simulation is unchanged.

**1. Your group project is due tomorrow and one person has done almost nothing. What do you do?**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Do my own part properly and stop worrying about theirs. Their effort was never mine to control. | Stoicism | -0.97, 0.26 |
| b | Share out what is left in whatever way gets the group the best mark, even if I end up doing most of it. | Utilitarianism | -0.42, -0.91 |
| c | Message them directly. Being in a group means owing the others your share, and someone has to say so. | Confucianism | 0.51, 0.61 |
| d | Find out whether pushing them now would make things worse for them or for us, and only push if it would not. | Buddhist Ethics | 0.61, -0.73 |

**2. A friend asks what you think of an essay they are proud of. It is weak.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Tell them it is weak. A friend who only flatters is not the kind of friend I want to be. | Virtue Ethics | -0.27, 0.75 |
| b | Offer to go through it together. When one of us does badly, the rest of us have let it happen. | Ubuntu | 0.90, 0.00 |
| c | Say whatever is most likely to get the essay improved before it is handed in. | Utilitarianism | -0.42, -0.91 |
| d | Give my honest view once and leave it there. What they do with it is up to them. | Stoicism | -0.97, 0.26 |

**3. Your gran wants you at a family lunch on the day of a match you really want to play in.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Go to the lunch. Being a grandchild comes with days you turn up for, whether or not you feel like it. | Confucianism | 0.51, 0.61 |
| b | Ask why I want each one and who it would hurt, me included. Going for a bad reason, like just wanting to win, would make it the wrong choice. | Buddhist Ethics | 0.61, -0.73 |
| c | Ask myself what someone I really look up to would do, and do that. | Virtue Ethics | -0.27, 0.75 |
| d | Ask the family. It is their day as much as mine, so it should be decided together. | Ubuntu | 0.90, 0.00 |

**4. A new app shows which of your classmates are nearby and when. Your friends all use it.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Use it if it makes more people's lives easier than harder overall. | Utilitarianism | -0.42, -0.91 |
| b | Whether I use it is my call. How everyone else uses it was never up to me. | Stoicism | -0.97, 0.26 |
| c | Not unless everyone it shows has agreed. It is not only my information to give away. | Ubuntu | 0.90, 0.00 |
| d | Leave it if it turns friends into people who check up on each other. That is not what friends are for. | Confucianism | 0.51, 0.61 |

**5. You see a classmate copying in an exam.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Think about who this is going to hurt, them included, before I decide whether to say anything. | Buddhist Ethics | 0.61, -0.73 |
| b | Do what an honest person would do here, even if it costs me friends. | Virtue Ethics | -0.27, 0.75 |
| c | Tell them once, privately, what I saw. What they do next is theirs to answer for; what I say is mine. | Stoicism | -0.97, 0.26 |
| d | Report it if that makes the results fairer for everyone else in the year. | Utilitarianism | -0.42, -0.91 |

**6. Your younger brother keeps using your phone without asking.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Raise it with the whole family. People who live together sort things out together. | Ubuntu | 0.90, 0.00 |
| b | I am the older one, so it is on me to show him how we treat each other's things, and on him to learn to ask. | Confucianism | 0.51, 0.61 |
| c | Say no without making a scene. Getting angry would do more damage than a borrowed phone. | Buddhist Ethics | 0.61, -0.73 |
| d | Be patient with him. I would rather be generous with my things than someone who keeps score. | Virtue Ethics | -0.27, 0.75 |

**7. Your team captain keeps picking friends over better players.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Tell the captain once, calmly, what I think is fair, then play as well as I can wherever I am put. Whether they listen is not up to me. | Stoicism | -0.97, 0.26 |
| b | Push for picks based on results, because that wins the most games for all of us. | Utilitarianism | -0.42, -0.91 |
| c | Tell the captain to their face that it is unfair. Going along with it would make me someone I don't want to be. | Virtue Ethics | -0.27, 0.75 |
| d | Get the whole team to agree how picks should work, so nobody is left out of deciding. | Ubuntu | 0.90, 0.00 |

**8. An AI tool could write your whole history essay, and nobody would ever know.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Write it myself. A student owes the teacher their own work, the way the teacher owes them honest marking. | Confucianism | 0.51, 0.61 |
| b | Ask what using it would do to my own learning and to everyone else's marks, and if it harms either, do not use it. | Buddhist Ethics | 0.61, -0.73 |
| c | Weigh the good and harm to everyone it touches, my own learning included, and do whatever comes out best overall. | Utilitarianism | -0.42, -0.91 |
| d | Whether anyone finds out is not the point. What I do with my own mind is the one thing that is mine. | Stoicism | -0.97, 0.26 |

**9. A friend tells you a secret. Passing it on would stop another friend making a big mistake.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Keep it. Being someone people can trust matters more than getting this one situation right. | Virtue Ethics | -0.27, 0.75 |
| b | Bring the two of them together. A problem between my friends belongs to all of us. | Ubuntu | 0.90, 0.00 |
| c | Weigh what I owe each of them. The friendship that goes back further comes first. | Confucianism | 0.51, 0.61 |
| d | Pass on only as much as stops the harm, and tell the first friend that I did. | Buddhist Ethics | 0.61, -0.73 |

**10. Your class votes on whether an app should rank everyone's attendance where all can see it.**

| | Option | Leans | x, y |
| --- | --- | --- | --- |
| a | Vote yes if it raises attendance overall, even if a few people are embarrassed. | Utilitarianism | -0.42, -0.91 |
| b | Vote for whatever I think is right and not worry about how the vote goes. | Stoicism | -0.97, 0.26 |
| c | Vote no. It trains people to turn up for the ranking rather than because they mean to. | Virtue Ethics | -0.27, 0.75 |
| d | Vote no. A tutor should know why a student is missing, not read it off a chart. | Confucianism | 0.51, 0.61 |

## 4. The result logic

- **Position.** A reader's position is the mean of the ten options'
  vectors: a point on the map.
- **Primary school.** The school nearest that point, by straight-line
  distance, wins. Every school is the same distance from the middle, so
  this is the school whose direction the reader leans towards. It is also
  what the eye reads off the map: the nearest dot.
- **Secondary school.** The second nearest.
- **Tie-break.** If two schools are exactly the same distance away (the
  squared distances within 1e-9 of each other), the one nearer the
  reader's answer to question 10 wins. If
  that ties too, the order of the table in section 2 decides, from
  Confucianism to Ubuntu. Question 10 is v1's tie-breaker as well
  (`src/lib/scoring.ts`). A reader at the exact middle is a tie between
  all six and goes the same way.

In the simulation no answer pattern out of 1,048,576 produced a tie, so
the rule is there for completeness rather than because it does work. v1
is different: `src/lib/scoring.ts` treats scores within 0.005 as a tie,
so its question-10 rule does fire.

## 5. The simulated distribution

**Method.** Ten questions of four options give 4^10 = 1,048,576 answer
patterns, few enough to score every one. Under random answering each is
equally likely, so the shares below are exact, not sampled. To repeat:
`node scripts/simulate-quiz-v2.mjs`.

**Final distribution, random answering:**

| School | Options leaning to it | Lands as primary |
| --- | --- | --- |
| Confucianism | 7 | 16.6% |
| Virtue Ethics | 7 | 17.7% |
| Stoicism | 7 | 16.2% |
| Utilitarianism | 7 | 16.5% |
| Buddhist Ethics | 6 | 16.8% |
| Ubuntu | 6 | 16.3% |

Every school is reachable. The range is 16.2% to 17.7%, inside the
brief's 8% to 30%.

**Personas.** A reader who always takes the option nearest one school:

| Always leans to | Lands on | Then | At |
| --- | --- | --- | --- |
| Confucianism | Confucianism | Ubuntu | 0.51, 0.50 |
| Virtue Ethics | Virtue Ethics | Confucianism | -0.04, 0.71 |
| Stoicism | Stoicism | Virtue Ethics | -0.76, 0.41 |
| Utilitarianism | Utilitarianism | Buddhist Ethics | -0.11, -0.86 |
| Buddhist Ethics | Buddhist Ethics | Ubuntu | 0.59, -0.53 |
| Ubuntu | Ubuntu | Confucianism | 0.75, 0.11 |

A reader who always takes the same letter lands near the middle and on
four different schools (a: Stoicism, b: Buddhist Ethics, c: Virtue Ethics,
d: Ubuntu). So the order options are shown in is not a shortcut to a
school.

**How the weights got here.**
1. **First draft, every weight 0.9.** Angles were Confucianism 45°, Virtue
   Ethics 100°, Stoicism 160°, Utilitarianism 225°, Buddhist Ethics 290°
   and Ubuntu 350°. Shares were 12.8% to 22.4%: inside the brief's range,
   but uneven. It also put Buddhist Ethics further towards outcomes than
   Utilitarianism (y -0.94 against -0.71), which misstates both pages, so
   the angles were redrawn to those in section 2.
2. **Redrawn angles, with Buddhist Ethics at 300°.** With every weight
   0.9, shares were 12.8% to 21.8%; tuned weights narrowed them, but
   those weights were not recorded, so that figure is not given here. At
   300° Buddhist Ethics sat only 0.04 short of
   Utilitarianism on y (-0.87 against -0.91). That understates its page's
   "as much as by what follows", so it moved to 310°.
3. **The final angles in section 2.** With every weight 0.9, shares were
   10.9% (Utilitarianism) to 23.0% (Confucianism). Three schools sit above
   the middle and carry 21 of the 40 options between them, so random
   answers drift upwards. With the final weights in section 3, shares are
   16.2% to 17.7%.

**The cost of the weights.** A Confucian or Virtue Ethics answer moves a
reader 80% as far as a Stoic or Utilitarian one. The quiz is not meant to
favour any school, and without the weights it would favour the two above
the middle. If Arthur would rather every answer weigh the same, the result is
the step 3 distribution with every weight 0.9: 10.9% to 23.0%, still
inside the brief's range.

## 6. Readers who took v1

**Their school stands.**
- A v1 result keeps its school, secondary school and three-school vector.
- A profile keeps its school.
- Nothing is rescored, because v2 cannot rescore a v1 answer set: the
  questions are different.

**Retaking uses v2.** A reader who takes the quiz again gets the six-school
quiz and a new result. Retaking while signed in already replaces the
profile's school and records the change in `school_history`
(`retakeQuizSchool` in `src/lib/claim.ts`), and a v2 retake will do the
same from launch. Until then a v2 result on a SIX_SCHOOLS preview moves no
school (Gate 2, option (i); `docs/decisions.md`, "Stage 5, step 4"). A
reader who never retakes keeps their v1 school.

**What the build needed** (Stage 5; built in steps 3 and 4, see
`docs/decisions.md`):
- **A version on each result.** v1 stores three school weights in
  `quiz_results.vector`; v2 would store a point. On a result page the
  stored vector is read only by the share page's comparison columns
  (`src/components/share/SharePage.tsx`, `VectorColumn`), which print
  each school's weight as a percentage, and only when there is a second
  result to compare; a v2 point there would print "NaN%". The triangle
  (`src/lib/quiz-position.ts`) is drawn only by the quiz itself, from the
  answers in progress. Either way a v2 row must not reach code written
  for v1 rows. The recommendation is an
  additive `quiz_version` column, defaulting to 1 so every existing row is
  v1 without being rewritten. That is a migration, and it is Arthur's yes
  before it is applied.
- **v1 links keep working.** A v1 result shared before the switch still
  opens on its triangle; a v2 result opens on the map.
- **Challenges across versions.** A friend answering a v1 challenge after
  the switch takes v2. The challenge page reads only the challenger's
  school, so it still works. But the result page (`src/app/r/[id]/page.tsx`)
  passes the other person's `vector` to the share page, which draws it as
  "Whoever sent it": a v1 and a v2 result side by side would put a v2
  point into code written for v1. That page has to check both versions.
  The two people answered different questions, and a comparison page
  should not imply otherwise.

## 7. For Checkpoint A

Ruled on 2026-11-05; see the note at the top. Kept as it was put:

1. The axes and their plain names (section 1).
2. The six positions, and especially Buddhist Ethics' and Ubuntu's
   (section 2).
3. The ten questions and forty options: the five flagged as possibly too
   nice, the three groups flagged as possibly underselling their school,
   and the two redrafted after review, 3b and 8c (section 3).
4. Weighted options (16.2% to 17.7%) or equal ones (10.9% to 23.0%)
   (section 5).
5. The share lines on all six school pages say "Ten questions about AI".
   One of v2's questions is about AI (8), two more are about apps (4 and
   10), and seven are about neither, so the lines would need rewording if
   v2 ships as drafted.
   They live in `content/schools/*.md`, under `share_lines`. The same
   "how AI should decide things" framing is also in `src/app/layout.tsx`
   (the site description), `src/components/share/SharePage.tsx` and
   `src/components/share/ChallengeInvite.tsx`.
6. Whether none of the six is a rule-based ethics (section 1, "Rules to
   results"), which is my reading and not certain.
7. Ubuntu's alternatives: Menkiti's reading would move it towards role.
   The Ubuntu page places Gyekye between Metz and Menkiti, which points
   the same way, but its gloss on him, individuals keeping "their own
   worth and rights", points towards the individual end (section 2).

## 8. The quiz's copy

Arthur, 2026-11-05: "Reword the share lines, site description, SharePage
and ChallengeInvite away from 'ten questions about AI', to something true
of v2 (e.g. ten questions about how you decide what's right)."

**Done now, on the live site.** "Ten questions on how AI should decide
things" is not true of v1 either: three of v1's ten questions involve AI
(an algorithm and a loan, an AI tool, a self-driving car) and seven do
not. v2 has one (8), and two more about apps (4 and 10). "Ten questions
about how you decide what's right" is true of both, so the AI framing
goes now rather than waiting for launch:

| Where | Was | Now |
| --- | --- | --- |
| Site description, `src/app/layout.tsx` | Ten questions on how AI should decide things. Find out which school of ethics you actually argue from. | Ten questions about how you decide what's right. Find out which school of ethics you actually argue from. |
| `src/components/share/SharePage.tsx` | Ten questions on how AI should decide things. No account needed, about eighty seconds. | Ten questions about how you decide what's right. No account needed, about eighty seconds. |
| `src/components/share/ChallengeInvite.tsx` | Sophecs asks ten questions about how AI should decide things and places you in one of three schools of ethics, ... | Sophecs asks ten questions about how you decide what's right and places you in one of three schools of ethics, ... |
| The share line that opened "Ten questions about AI", in each of the six `content/schools/*.md` | Ten questions about AI and ... | Ten questions about how I decide what's right, and ... |

Only those words change; the rest of each line is as it was. The three
draft schools' lines are not shown to readers until they are published.

**At launch, with the six schools.** These lines are true of v1 and
become untrue only when v2 and the six schools ship, so they change in
the launch work (Stage 5, behind `SIX_SCHOOLS`; front matter such as the
share lines cannot be switched by a runtime flag, so those edits go in
the launch merge itself):

- **The time.** v2's prompts and options run to 879 words against v1's
  483, so at v1's claimed pace v2 takes about two and a half minutes.
  "About eighty seconds" (`SharePage.tsx`, `ChallengeInvite.tsx`) and
  "About 80 seconds" (`src/app/page.tsx`) become, as proposed, "a few
  minutes".
- **Three schools become six.** `ChallengeInvite.tsx` ("one of three
  schools"); the quiz page's description (`src/app/quiz/page.tsx`,
  "Stoicism, Utilitarianism or Virtue Ethics"); the landing page
  (`src/app/page.tsx`, "the Stoics, the Utilitarians or the Virtue
  Ethicists", the heading "The three schools", and "Every answer moves
  you across the triangle", which v2's two-axis map replaces); the
  site's sharing image (`src/app/opengraph-image.tsx`, "Ten scenarios.
  Three schools."); and, outside the site, `README.md` ("one of three
  schools").

**For Arthur, on the phase's decision list (e).** Share lines are the
text a reader posts when they share a result (to X, WhatsApp, the
clipboard), so they describe the quiz, and many describe it as about AI
or name v1's questions. None is changed here beyond its opening words.
By file, with each line's index in `share_lines`:

- `stoicism.md`: [0] "the only thing an AI can't take from me"; [2]
  "including the algorithm's verdict".
- `utilitarianism.md`: [1] "My verdict on the self-driving car problem",
  v1's question 8, which v2 does not ask; [2], edited here, "count
  everyone it touches", where "it" meant the AI the line no longer
  names.
- `virtue-ethics.md`: [1] "I judge an algorithm the same way I judge a
  person".
- `confucian.md`: [0] "I judge an AI by what it does to the relationships
  around it"; [1], edited here, "does this system let them pay it"
  (proposed: "can they still pay it"); [2] "a word that flatters a
  system".
- `buddhist.md`: [0] "what a system was built to do, not just what it
  scored"; [1], edited here, "are we still checking", which means
  watching an AI after release; [2] "keep looking after it ships".
- `ubuntu.md`: [0] "my answer to every AI question"; [1], edited here,
  "the data was only mine" (proposed: "the choice was only mine"); [2]
  "judge a system by the relationships it leaves behind".
- The time wording above, "a few minutes".

**Ruled at Checkpoint B, 2026-11-05 ((e) 3 and 4).** The two proposed
rewordings are used: `confucian.md` [1] "can they still pay it" and
`ubuntu.md` [1] "the choice was only mine". The other lines listed above
are unchanged. "A few minutes" is accepted, and goes in where v2 runs: on
flag-on builds with step 4, and everywhere at launch.
