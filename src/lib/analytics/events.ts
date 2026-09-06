import type { SchoolId } from "../types";

// Discriminated union of every event, Phase 1 and Phase 2. A misspelt event
// name or a missing/extra prop fails typecheck rather than silently
// shipping a bad PostHog event.
export type AnalyticsEvent =
  // --- Phase 1 ---
  | {
      name: "page_viewed";
      props: {
        path: string;
        referrer: string;
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
      };
    }
  | {
      name: "quiz_started";
      props: {
        source: "landing" | "school_page" | "challenge" | "direct";
        challenge_id?: string;
      };
    }
  | {
      name: "quiz_question_answered";
      props: { question: number; option: string; ms_on_question: number };
    }
  | { name: "quiz_abandoned"; props: { last_question: number } }
  | {
      name: "quiz_completed";
      props: {
        school: SchoolId;
        secondary: SchoolId;
        duration_ms: number;
        result_id: string;
      };
    }
  | {
      name: "card_viewed";
      props: { result_id: string; school: SchoolId; is_owner: boolean; referrer: string };
    }
  | {
      name: "share_clicked";
      props: {
        result_id: string;
        school: SchoolId;
        channel: "native" | "x" | "whatsapp" | "instagram" | "copy" | "download";
        share_line: number;
      };
    }
  | {
      name: "share_page_viewed";
      props: { result_id: string; school: SchoolId; referrer: string };
    }
  | { name: "challenge_created"; props: { challenge_id: string; school: SchoolId } }
  | { name: "challenge_viewed"; props: { challenge_id: string } }
  | {
      name: "challenge_accepted";
      props: {
        challenge_id: string;
        challenger_school: SchoolId;
        challengee_school: SchoolId;
      };
    }
  | { name: "return_visit"; props: { days_since_first: number } }

  // --- Phase 2a: identity and claiming ---
  | { name: "signup_started"; props: { method: "magic" | "google"; next: string } }
  | { name: "signup_completed"; props: { method: "magic" | "google" } }
  | { name: "result_claimed"; props: { result_id: string; school: SchoolId } }
  | { name: "school_changed"; props: { from: SchoolId; to: SchoolId } } // wired in 2c
  | { name: "me_viewed"; props: { pending_challenges: number } }

  // --- Phase 2b: the debate ---
  | { name: "debate_list_viewed"; props: Record<string, never> }
  | { name: "micro_lesson_viewed"; props: { slug: string; position: "before" | "after" } }
  | { name: "debate_started"; props: { topic_slug: string; from_challenge: boolean } }
  | { name: "draft_restored"; props: { topic_slug: string; word_count: number } }
  | {
      name: "debate_submitted";
      props: { topic_slug: string; word_count: number; from_challenge: boolean };
    }
  | {
      name: "judge_paused";
      props: { reason: "kill_switch" | "budget" | "daily_cap" | "topic_lock" };
    }
  | {
      name: "verdict_viewed";
      props: { debate_id: string; score: number; is_owner: boolean; rejected: boolean };
    }
  | { name: "argument_published"; props: { debate_id: string } }
  | {
      name: "verdict_share_clicked";
      props: { debate_id: string; channel: "x" | "whatsapp" | "copy"; score: number };
    }
  | { name: "elo_changed"; props: { delta: number; elo_after: number; mode: "solo" | "pair" } }

  // --- Phase 2c: rating and return (typed now, wired with the challenge handoff) ---
  | { name: "streak_extended"; props: { streak: number } }
  | { name: "streak_reset"; props: { previous: number } }
  | { name: "challenge_debate_started"; props: { challenge_id: string } }
  | {
      name: "challenge_completed";
      props: { challenge_id: string; winner_school: SchoolId | "draw" };
    };

export type AnalyticsEventName = AnalyticsEvent["name"];
