// Redirects any `require("server-only")` to the empty shim, for standalone
// scripts run outside Next's bundler. See server-only-shim.cjs.
const Module = require("module");
const path = require("path");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "server-only") {
    return path.join(__dirname, "server-only-shim.cjs");
  }
  return originalResolve.call(this, request, ...args);
};
