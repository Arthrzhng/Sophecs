// Rebuilds scripts/seed/arguments/<topic>.<school>.json from the passages in
// arguments/fragments/. Run after editing a passage: `npm run seed:banks`.
// Writes only those eighteen files; touches no database.
import { writeBanks } from "./banks";

for (const path of writeBanks()) console.log(`wrote ${path}`);
