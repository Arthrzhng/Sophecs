import type { SchoolVector } from "@/lib/types";

export interface QuizOption {
  id: string;
  label: string;
  vector: SchoolVector;
}

export interface QuizQuestion {
  id: number;
  prompt: string;
  options: QuizOption[];
}

// Ten scenarios (kept from the ten already written and approved earlier in
// this build, rather than cut to nine — see docs/decisions.md). Each option
// is a position a real school has actually held, weighted across all three
// schools rather than one-hot: a Utilitarian answer still carries a little
// Stoic or Virtue in it, because that's how people actually reason. Q10 is
// written with the sharpest, least-ambiguous options and doubles as the
// tie-break discriminator in lib/scoring.ts.
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    prompt:
      "A colleague takes credit for your work in a meeting. Before you say anything, what do you check first?",
    options: [
      {
        id: "1a",
        label: "Whether the outcome is even within my control.",
        vector: { stoicism: 0.72, utilitarianism: 0.1, "virtue-ethics": 0.18 },
      },
      {
        id: "1b",
        label: "Which response leaves the whole team best off.",
        vector: { stoicism: 0.1, utilitarianism: 0.75, "virtue-ethics": 0.15 },
      },
      {
        id: "1c",
        label: "What kind of person I want to be in this room.",
        vector: { stoicism: 0.2, utilitarianism: 0.1, "virtue-ethics": 0.7 },
      },
    ],
  },
  {
    id: 2,
    prompt:
      "An algorithm denies you something — a loan, a job screen — and you suspect it's wrong. What matters most?",
    options: [
      {
        id: "2a",
        label: "How I respond, since whether the system was fair isn't up to me.",
        vector: { stoicism: 0.75, utilitarianism: 0.1, "virtue-ethics": 0.15 },
      },
      {
        id: "2b",
        label: "Pushing for an appeals process that minimizes wrongful denials overall.",
        vector: { stoicism: 0.1, utilitarianism: 0.78, "virtue-ethics": 0.12 },
      },
      {
        id: "2c",
        label: "What a person of good character does when facing an unjust system.",
        vector: { stoicism: 0.18, utilitarianism: 0.1, "virtue-ethics": 0.72 },
      },
    ],
  },
  {
    id: 3,
    prompt: "A friend asks for harsh, honest feedback on work they're proud of.",
    options: [
      {
        id: "3a",
        label: "Give it calmly regardless of their reaction — that reaction isn't mine to control.",
        vector: { stoicism: 0.75, utilitarianism: 0.1, "virtue-ethics": 0.15 },
      },
      {
        id: "3b",
        label: "Weigh how the feedback affects them against the value of them improving.",
        vector: { stoicism: 0.15, utilitarianism: 0.72, "virtue-ethics": 0.13 },
      },
      {
        id: "3c",
        label: "Ask what an honest friend would actually say, and say that.",
        vector: { stoicism: 0.15, utilitarianism: 0.1, "virtue-ethics": 0.75 },
      },
    ],
  },
  {
    id: 4,
    prompt: "You find a wallet with cash on the street.",
    options: [
      {
        id: "4a",
        label: "Recognize that what I do says something about my judgment, not my luck.",
        vector: { stoicism: 0.7, utilitarianism: 0.1, "virtue-ethics": 0.2 },
      },
      {
        id: "4b",
        label: "Consider who needs it most and act for the best overall outcome.",
        vector: { stoicism: 0.1, utilitarianism: 0.78, "virtue-ethics": 0.12 },
      },
      {
        id: "4c",
        label: "Return it, because that's simply what an honest person does.",
        vector: { stoicism: 0.15, utilitarianism: 0.1, "virtue-ethics": 0.75 },
      },
    ],
  },
  {
    id: 5,
    prompt: "An AI tool could finish your assignment for you, undetected.",
    options: [
      {
        id: "5a",
        label: "My obligation is about what I assent to, not whether I'd get caught.",
        vector: { stoicism: 0.78, utilitarianism: 0.08, "virtue-ethics": 0.14 },
      },
      {
        id: "5b",
        label: "Consider whether using it produces better learning outcomes than not.",
        vector: { stoicism: 0.1, utilitarianism: 0.75, "virtue-ethics": 0.15 },
      },
      {
        id: "5c",
        label: "Ask what kind of person I'm training myself to become by using it.",
        vector: { stoicism: 0.17, utilitarianism: 0.08, "virtue-ethics": 0.75 },
      },
    ],
  },
  {
    id: 6,
    prompt: "A family member is seriously ill.",
    options: [
      {
        id: "6a",
        label: "Separate what I can actually change from what I can't, and act only on the former.",
        vector: { stoicism: 0.78, utilitarianism: 0.12, "virtue-ethics": 0.1 },
      },
      {
        id: "6b",
        label: "Focus resources and attention where they'll do the most good.",
        vector: { stoicism: 0.1, utilitarianism: 0.75, "virtue-ethics": 0.15 },
      },
      {
        id: "6c",
        label: "Show up the way a loving, present person would, regardless of outcome.",
        vector: { stoicism: 0.15, utilitarianism: 0.1, "virtue-ethics": 0.75 },
      },
    ],
  },
  {
    id: 7,
    prompt: "You're asked to review a friend's business plan you think will fail.",
    options: [
      {
        id: "7a",
        label: "Give my honest judgment — their reaction to it isn't something I control.",
        vector: { stoicism: 0.75, utilitarianism: 0.09, "virtue-ethics": 0.16 },
      },
      {
        id: "7b",
        label: "Consider whether honesty here does more good than a kind lie would.",
        vector: { stoicism: 0.12, utilitarianism: 0.72, "virtue-ethics": 0.16 },
      },
      {
        id: "7c",
        label: "Trust that a good friend tells the truth, and let that guide me.",
        vector: { stoicism: 0.16, utilitarianism: 0.12, "virtue-ethics": 0.72 },
      },
    ],
  },
  {
    id: 8,
    prompt:
      "You're a passenger in a self-driving car; its software will decide in an unavoidable crash.",
    options: [
      {
        id: "8a",
        label: "What matters is whether I assented to the risk, not what the algorithm computes.",
        vector: { stoicism: 0.75, utilitarianism: 0.11, "virtue-ethics": 0.14 },
      },
      {
        id: "8b",
        label: "The car should minimize total harm across everyone involved.",
        vector: { stoicism: 0.1, utilitarianism: 0.8, "virtue-ethics": 0.1 },
      },
      {
        id: "8c",
        label:
          "The real test is whether the people who built it acted with integrity, not just correct math.",
        vector: { stoicism: 0.13, utilitarianism: 0.12, "virtue-ethics": 0.75 },
      },
    ],
  },
  {
    id: 9,
    prompt: "You receive an award you don't think you fully earned.",
    options: [
      {
        id: "9a",
        label: "My standing rests on my own judgment of the work, not on external recognition.",
        vector: { stoicism: 0.78, utilitarianism: 0.08, "virtue-ethics": 0.14 },
      },
      {
        id: "9b",
        label: "Consider whether accepting it does more good (funding, visibility) than declining.",
        vector: { stoicism: 0.12, utilitarianism: 0.75, "virtue-ethics": 0.13 },
      },
      {
        id: "9c",
        label: "Ask whether accepting it honestly reflects who I am.",
        vector: { stoicism: 0.15, utilitarianism: 0.1, "virtue-ethics": 0.75 },
      },
    ],
  },
  {
    id: 10,
    prompt: "A small ethical compromise at work has become a habit.",
    options: [
      {
        id: "10a",
        label: "Whether I'd get caught is irrelevant; only my own judgment about the act matters.",
        vector: { stoicism: 0.85, utilitarianism: 0.05, "virtue-ethics": 0.1 },
      },
      {
        id: "10b",
        label: "Weigh the actual harm caused against what it would cost me to stop.",
        vector: { stoicism: 0.07, utilitarianism: 0.85, "virtue-ethics": 0.08 },
      },
      {
        id: "10c",
        label: "Ask whether this is shaping who I'm becoming, and whether I want that.",
        vector: { stoicism: 0.1, utilitarianism: 0.05, "virtue-ethics": 0.85 },
      },
    ],
  },
];
