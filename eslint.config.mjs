import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Next's recommended set plus its TypeScript rules, and nothing invented on
// top of it. The design rules this project actually cares about — one type
// scale, no hardcoded colours, no ad-hoc radii — are not lint rules; they
// are greps, and they live in the phase reports rather than in a config
// that would need a custom plugin to express them.
const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "tsconfig.tsbuildinfo"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `any` is already impossible to write accidentally here: the project
      // is strict-mode TypeScript and tsc runs in CI. Leaving this as an
      // error would only fire on deliberate escapes, which are commented
      // where they exist.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Test files and one-off scripts are not application code; an unused
    // binding in a fixture is not a defect worth failing a build over.
    files: ["tests/**", "scripts/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  {
    // A .cjs file is CommonJS by extension. require() is the only thing it
    // can do, so the rule against it is noise here.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // /api/judge is frozen for the presentation rebuild. The unused binding
    // there is a deliberate destructure-to-drop, and rewriting it would be
    // a change to a file this phase is not allowed to touch.
    files: ["src/app/api/judge/route.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default config;
