---
id: virtue-ethics-rlhf-habituation
school: Virtue Ethics
title: Can training make an AI good?
quiz_excerpt: Aristotle thought you become just by doing just acts, the same way you become a builder by building. Modern AI systems are shaped by repeated rounds of human feedback on their outputs. Whether that counts as habituation in Aristotle's sense, or only produces something that behaves well without any of the character behind it, is genuinely contested.
debate_topics:
  - id: gradient-descent
    text: If an AI model reliably produces the outputs a virtuous person would produce, does it matter that it got there through gradient descent rather than lived practice?
  - id: harman-attack
    text: Does Harman's attack on character traits undercut Aristotle's habituation story for humans as much as it would for machines?
sources:
  - name: Aristotle, Nicomachean Ethics, Book II, chs. 1 and 4, trans. W. D. Ross (1908, public domain)
  - name: Stanford Encyclopedia of Philosophy, "Aristotle's Ethics" (Richard Kraut), https://plato.stanford.edu/entries/aristotle-ethics/
  - name: Ruth Groff and John Symons, "Is AI Capable of Aristotelian Full Moral Virtue?", in Artificial Dispositions, ed. Bauer and Marmodoro (Bloomsbury, 2024), pp. 219-232
  - name: 'Gilbert Harman, "Moral Philosophy Meets Social Psychology: Virtue Ethics and the Fundamental Attribution Error," Proceedings of the Aristotelian Society, vol. 99 (1999), pp. 315-331, quote at p. 316'
---

Aristotle's account of virtue in the Nicomachean Ethics runs through habituation rather than instruction. In Book II, chapter 1, in W. D. Ross's 1908 translation: "the things we have to learn before we can do them, we learn by doing them, e.g. men become builders by building and lyre-players by playing the lyre; so too we become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts." Virtue is not primarily a body of knowledge — it is a trained disposition, built the same way a skill is built, by repetition.

Book II, chapter 4 complicates this. Aristotle notes that a person can perform a just act without being just, the way someone can stumble into a grammatically correct sentence without knowing grammar. To act virtuously in the full sense, the agent must know what they are doing, choose the act for its own sake, and act "from a firm and unchangeable character." Habituation is supposed to produce that firm character, not merely the correct output on a given occasion. The Stanford Encyclopedia's entry on Aristotle's ethics (Richard Kraut) glosses this state as a hexis, a stable disposition to feel and act appropriately, not a one-off performance.

This raises an obvious question about AI training. Large language models are shaped after pretraining by rounds of human judgment on their outputs, rejecting some responses and reinforcing others until the model reliably produces the preferred kind of answer. Ruth Groff and John Symons take this question on directly in a 2024 chapter discussing DeepMind's Sparrow and ChatGPT specifically. They argue a model trained this way might achieve what they call "nice teenager level morality": consistently acceptable behavior in familiar situations. But full Aristotelian virtue requires phronesis — the rational power to judge correctly in a genuinely novel case where no training example applies and competing principles conflict. Groff and Symons argue phronesis cannot be reduced to a probability distribution over training data, however large, because it is not a regularity at all. Their paper does not use the acronym RLHF, but the mechanism it examines, tuning a model's behavior through accumulated human judgments on its outputs, is the same thing under a different name. Their conclusion: this produces reliable good behavior, not virtue.

Gilbert Harman challenges the premise on the human side, which undercuts the whole comparison. In his 1999 paper for the Aristotelian Society, he argues that decades of social psychology, particularly the Milgram experiments and related work, show that behavior is driven far more by situational pressure than by anything resembling a stable character trait. His claim is blunt: "there is no empirical basis for the existence of character traits." If Harman is right, then Aristotle's model of a firm, situation-independent hexis was never accurate even for humans, and the entire debate about whether AI training can replicate habituation is aimed at a target that does not exist in the form virtue ethics assumes. Either the AI-training question is premature, since the human case it is modeled on is itself unsettled, or Aristotle's ethics needs the same defense against Harman that any application to machines would also need.
