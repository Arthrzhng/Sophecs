// Empty stand-in for the "server-only" package. Next.js aliases that
// package away at build time (it only throws inside a client bundle); a
// plain tsx/Node process has no such alias, so standalone scripts
// (seed-topics.ts, run-golden.ts) that import server-only app code need
// this preloaded instead. See docs/decisions.md.
module.exports = {};
