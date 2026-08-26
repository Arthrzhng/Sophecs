import type { School, SchoolId } from "./types";

// The canonical three. The UI reads schools from the data layer; this map is
// for places that need synchronous access (quiz scoring, colour lookup).
export const SCHOOLS: Record<SchoolId, School> = {
  stoicism: {
    id: "stoicism",
    name: "Stoicism",
    color_token: "--color-stoic",
  },
  utilitarianism: {
    id: "utilitarianism",
    name: "Utilitarianism",
    color_token: "--color-util",
  },
  "virtue-ethics": {
    id: "virtue-ethics",
    name: "Virtue Ethics",
    color_token: "--color-virtue",
  },
};

export const SCHOOL_IDS = Object.keys(SCHOOLS) as SchoolId[];

export function schoolColor(id: SchoolId): string {
  return `var(${SCHOOLS[id].color_token})`;
}

export function schoolName(id: SchoolId): string {
  return SCHOOLS[id].name;
}
