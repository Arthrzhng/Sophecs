import type { SchoolId } from "../types";

// Discriminated union of every Phase 1 event. A misspelt event name or a
// missing/extra prop fails typecheck rather than silently shipping a bad
// PostHog event.
export type AnalyticsEvent =
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
  | { name: "return_visit"; props: { days_since_first: number } };

export type AnalyticsEventName = AnalyticsEvent["name"];
