---
id: stoicism-determinism
school: Stoicism
title: Does an AI choose anything?
quiz_excerpt: Epictetus opens the Enchiridion by splitting everything into what is "in our power" and what isn't. For him, only a specific mental act, giving or withholding assent, counts as truly ours. Calling an AI's output a "decision" without that act underneath it may be the same kind of category confusion the Stoics warned against, just approached from the opposite direction.
debate_topics:
  - id: category-error
    text: Is calling a language model's output a "decision" a category error, or is it a harmless shorthand?
  - id: williams-blame
    text: If outcomes affect how much blame a builder deserves (per Bernard Williams), does it matter whether an AI's output was "chosen" in any real sense?
sources:
  - name: Epictetus, Enchiridion, chapter 1, trans. George Long (1877, public domain)
  - name: Cicero, De Fato, 42-43, trans. H. Rackham, Loeb Classical Library (1942)
  - name: Stanford Encyclopedia of Philosophy, "Stoicism" (Durand, Shogry, Baltzly), https://plato.stanford.edu/entries/stoicism/
  - name: Murray Shanahan, "Talking About Large Language Models," arXiv:2212.03551 (2022); Communications of the ACM, vol. 67 (2024), pp. 68-79
  - name: Bernard Williams, "Moral Luck," Proceedings of the Aristotelian Society, Supplementary Volume 50 (1976), pp. 115-135
  - name: Stanford Encyclopedia of Philosophy, "Moral Luck," https://plato.stanford.edu/entries/moral-luck/
---

Epictetus opens the Enchiridion with a division, in George Long's 1877 translation: "Of things some are in our power, and others are not. In our power are opinion, movement towards a thing, desire, aversion, and, in a word, whatever are our own acts: not in our power are the body, property, reputation, offices, and, in a word, whatever are not our own acts." That's the whole doctrine in one paragraph — everything in Stoic ethics works out from this line.

The Stoics were determinists. Every event, including a human action, follows from a chain of prior causes; nothing happens uncaused. So how can anything be "in our power" if it's all caused? Chrysippus's own writings are lost, but Cicero preserves his answer in De Fato 42-43, in H. Rackham's translation: Chrysippus compares the mind to "his roller and spinning-top, which cannot begin to move unless they are pushed or struck, but which when this has happened, he thinks, continue to move of their own nature, the roller rolling forward and the top spinning round." A push starts both objects moving, but their shape determines how they move afterward. In a person, the push is an external impression — a sight, an insult, a slice of cake. What happens next depends on the agent's own nature, specifically on assent: the act of judging that impression true or worth acting on. Two people can see the same cake and respond differently because one assents to "this is worth eating now" and the other doesn't. Assent is caused, but it is still the agent's own act, and for the Stoics that is what "in our power" means. It isn't a claim that nothing is determined, only that one link in the chain, judgment, is properly called ours.

Murray Shanahan's 2022 paper "Talking About Large Language Models" makes a related move from the other side. He argues that describing a language model as something that "knows," "believes," or "thinks" invites people to treat the system as more human-like than the mechanism supports, and recommends stepping back to the actual process, next-token prediction over a training distribution, before reaching for that vocabulary. Shanahan is not writing about Stoicism, and his target is anthropomorphic description, not moral responsibility. But the concern matches: the Stoics locate genuine agency in one narrow act and refuse to extend it to everything that merely produces behavior. Applying that standard to a model, the question isn't whether the output looks like a decision. It's whether there's an act of assent anywhere in the pipeline. If there isn't, calling the output a "choice" is the same category slip Epictetus spent his teaching correcting, aimed at a system instead of an emotion.

Bernard Williams pushes back on the underlying premise. In "Moral Luck" (1976), he argues that what's "in our power" isn't actually what determines moral standing. His example is a lorry driver who, through no fault of his own, kills a child who steps into the road. Williams says the driver will feel agent-regret, which a driver who made the identical error but hit no one won't feel, though both acted identically. The outcome, not the antecedent judgment, does the moral work. If Williams is right, the Stoic move of putting everything that matters inside the act of assent doesn't match how responsibility actually gets assigned. Applied to AI: if a deployed model causes harm, people will hold the engineers responsible in proportion to what happened, not to what they assented to when they shipped it. A purely Stoic framing, where only the judgment counts, sits uneasily with that.
