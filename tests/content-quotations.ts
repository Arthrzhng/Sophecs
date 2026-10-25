import type { FileQuotes } from "../src/lib/quote-check";

/**
 * What each non-Western content file claims to be quoting.
 *
 * Every `source` here has to appear word for word in
 * content/research/non-western-sources.md, and every way the content
 * differs from it has to be named. A paraphrase is listed separately and
 * not checked: the point of listing one is that somebody had to decide
 * which of the two it was.
 */
export const DECLARED: Record<string, FileQuotes> = {
  "content/schools/confucian.md": {
    quotes: [
      {
        source:
          "There is government, when the prince is prince, and the minister is minister; when the father is father, and the son is son.",
        exceptions: [
          { kind: "omit", text: "There is government," },
          { kind: "capitalise-first" },
        ],
        note: "the one_line; the card needs a sentence, so the clause opens it",
      },
      {
        source:
          "There is government, when the prince is prince, and the minister is minister; when the father is father, and the son is son.",
        exceptions: [{ kind: "lowercase-first" }, { kind: "drop-full-stop" }],
        note: "the read, which runs the sentence on after a colon",
      },
    ],
    paraphrases: [
      {
        text: "if names are not correct, language does not accord with the truth of things",
        why: "13.3 modernised. Legge has 'If names be not correct, language is not in accordance with the truth of things.'",
      },
    ],
  },

  // Not content a reader sees: the draft fidelity criteria, approved by
  // Arthur on 2026-10-24 and read by the golden runner only, never by
  // anything in src/. Declared anyway, because the claim made for them is
  // that their quotations come only from the research file, and this is
  // what makes that checkable.
  "content/prompts/fidelity-criteria.draft.md": {
    quotes: [
      {
        source: "a person is a person through other persons.",
        exceptions: [{ kind: "lowercase-first" }, { kind: "drop-full-stop" }],
        note: "the Ubuntu criteria, which run the maxim on after a colon",
      },
      // Five of the entries below were found undeclared by a reviewer,
      // which is the whole point of a manifest: the file claimed to be
      // checkable and was not, for these. All were verbatim; none was
      // fabricated. The two after them were added as the disclosure list
      // grew. The first below is the one that matters, because it is in
      // the criteria the judge reads rather than in the notes under them.
      {
        source:
          "Right action honours capacities for relationships of shared identity and solidarity",
        exceptions: [{ kind: "lowercase-first" }],
        note: "the Ubuntu criteria, which run Metz's principle on after \"is that\"",
      },
      {
        source:
          "Right action honours capacities for relationships of shared identity and solidarity",
        exceptions: [{ kind: "omit", text: "Right action honours " }],
        note: "the disclosure list, quoting the row's wording after 'honouring'",
      },
      {
        source: "overlap but are not interchangeable",
        note: "the disclosure list, on the research file setting Menkiti and Gyekye apart",
      },
      {
        source: "whether appeals to harmony silence dissent.",
        note:
          "the disclosure list, quoting the safeguard the withdrawn harmony " +
          "claim ran against",
      },
      {
        source:
          "cultivated qualities such as humaneness, justice, honesty and practical wisdom",
        note: "the disclosure list, on ren and li being absent from the research file",
      },
      {
        source: "lead to harm and suffering",
        note: "the disclosure list, on dukkha as suffering",
      },
      {
        source: "reducing suffering",
        note: "the disclosure list, quoting the research file's own caution",
      },
    ],
  },

  "content/schools/ubuntu.md": {
    quotes: [
      {
        source: "a person is a person through other persons.",
        exceptions: [{ kind: "capitalise-first" }],
        note: "the one_line; Metz prints it mid-sentence",
      },
    ],
  },

  "content/schools/buddhist.md": {
    quotes: [
      {
        source: "Treating others like oneself, neither kill nor incite to kill",
        exceptions: [{ kind: "add-full-stop" }],
        note: "the one_line; Sujato's line has no terminal stop in the research file",
      },
    ],
  },

  "content/micro/borrowed-judgement-elsewhere.md": {
    quotes: [
      { source: "there are sure to be subtle doings" },
      {
        source: "when there is a scheming mind in the breast, its pure simplicity is impaired",
      },
    ],
    paraphrases: [
      {
        text: "Where there are ingenious contrivances",
        why: "the source has it capitalised at the head of its sentence; the content runs it on, and names the omission the source's own ellipsis stands for",
      },
    ],
  },

  "content/micro/careful-builder-elsewhere.md": {
    quotes: [
      {
        source: "Treating others like oneself, neither kill nor incite to kill",
        exceptions: [{ kind: "lowercase-first" }],
        note: "quoted whole after a colon",
      },
    ],
  },

  "content/micro/crash-arithmetic-elsewhere.md": {
    quotes: [
      {
        source:
          "moral value fundamentally lies not in the individual, but rather in a relationship between individuals",
      },
    ],
  },

  "content/micro/moral-training-elsewhere.md": {
    quotes: [],
    paraphrases: [
      {
        text: "whether it would conduce to your harm, or to another's, or to both",
        why: "Chalmers has 'You must reflect whether it would conduce to your or others' harm or to both.' The content restates it as the reader's own reflection.",
      },
    ],
  },

  "content/micro/no-decision-elsewhere.md": {
    quotes: [
      {
        source:
          "If names be not correct, language is not in accordance with the truth of things. If language be not in accordance with the truth of things, affairs cannot be carried on to success.",
        exceptions: [{ kind: "interpolate", text: "the passage says," }],
        note: "both sentences, with the attribution inside the first",
      },
    ],
  },

  "content/micro/opaque-benefit-elsewhere.md": {
    quotes: [
      {
        source:
          "sufficiency of food, sufficiency of military equipment, and the confidence of the people in their ruler",
      },
      {
        source: "Part with the food.",
        exceptions: [{ kind: "lowercase-first" }, { kind: "drop-full-stop" }],
        note: "the Master's answer, run into the content's own sentence",
      },
      {
        source:
          "From of old, death has been the lot of all men; but if the people have no faith in their rulers, there is no standing for the state.",
      },
    ],
  },

  "content/modules/relational-data.md": {
    quotes: [
      {
        source: "Personhood is fundamentally relational.",
        exceptions: [{ kind: "interpolate", text: ", he writes," }],
      },
      {
        source:
          "the notion that truths, and perhaps all truths, about an individual can be rationally computed destroys the core idea of privacy",
      },
      {
        source:
          "moral value fundamentally lies not in the individual, but rather in a relationship between individuals",
      },
    ],
  },

  "content/modules/roles-and-carers.md": {
    quotes: [
      {
        source:
          "There is government, when the prince is prince, and the minister is minister; when the father is father, and the son is son.",
        exceptions: [{ kind: "interpolate", text: "the passage runs," }],
      },
      {
        source:
          "if, indeed, the prince be not prince, the minister not minister, the father not father, and the son not son, although I have my revenue, can I enjoy it?",
      },
    ],
    paraphrases: [
      {
        text: "If names are not correct, it says, language does not accord with the truth of things.",
        why: "13.3 modernised, the same restatement the school file uses",
      },
    ],
  },

  "content/modules/no-self-machine-minds.md": {
    quotes: [
      {
        source: "The body (Rûpa), O Bhikkhus, is not the self.",
        exceptions: [
          { kind: "omit", text: "(Rûpa), O Bhikkhus," },
          { kind: "interpolate", text: ", it says," },
        ],
        note: "the vocative and the Pali gloss are dropped; the attribution sits where they were",
      },
      {
        source:
          "if the body were self, it would not be subject to disease and could be controlled at will",
        exceptions: [{ kind: "capitalise-first" }],
      },
    ],
  },
};

/**
 * Files whose sources predate the research file and are not in it. The
 * test reports on these and changes nothing, because their quotations
 * were checked against editions nobody recorded.
 */
export const REPORT_ONLY = [
  "content/schools/stoicism.md",
  "content/schools/utilitarianism.md",
  "content/schools/virtue-ethics.md",
];
