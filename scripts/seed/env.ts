// Credentials and target guards for the seed tooling.
//
// Credentials come from one file per target and nowhere else:
// .env.seed.local and .env.seed.production, both git-ignored. Nothing here
// reads process.env, .env.local or .env.production, so a shell that happens
// to hold the app's service key cannot point a seed run anywhere.
//
// Every check here runs before any network request. A local target must be
// on this machine; a production target must be exactly
// https://<ref>.supabase.co for the ref given twice on the command line,
// with a service key issued for that ref. No error message includes a key.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class GuardError extends Error {}

const LOCAL_FILE = ".env.seed.local";
const PRODUCTION_FILE = ".env.seed.production";

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) throw new GuardError(`malformed line in credentials file (no KEY=VALUE)`);
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function readFile(root: string, name: string): Record<string, string> {
  const path = join(root, name);
  if (!existsSync(path)) throw new GuardError(`${name} not found in ${root}; see docs/sample-activity.md, "Credentials"`);
  return parseEnvFile(readFileSync(path, "utf8"));
}

export interface LocalTarget {
  kind: "local";
  databaseUrl: string;
  host: string;
  port: number;
  database: string;
  user: string;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function checkLocalUrl(databaseUrl: string): LocalTarget {
  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new GuardError("SEED_LOCAL_DATABASE_URL is not a URL");
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:")
    throw new GuardError("SEED_LOCAL_DATABASE_URL must be a postgres:// URL");
  if (!LOCAL_HOSTS.has(u.hostname))
    throw new GuardError(`the local target must be on this machine (127.0.0.1 or localhost), not ${u.hostname}`);
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!/^[a-z0-9_]+$/.test(database)) throw new GuardError("the local database name must be lower case letters, digits and _");
  if (u.search || u.hash) throw new GuardError("SEED_LOCAL_DATABASE_URL must have no query or fragment");
  return {
    kind: "local",
    databaseUrl,
    host: u.hostname === "localhost" ? "127.0.0.1" : u.hostname.replace(/^\[|\]$/g, ""),
    port: Number(u.port || 5432),
    database,
    user: decodeURIComponent(u.username || "postgres"),
  };
}

export function localTarget(root = process.cwd()): LocalTarget {
  const env = readFile(root, LOCAL_FILE);
  const url = env.SEED_LOCAL_DATABASE_URL;
  if (!url) throw new GuardError(`${LOCAL_FILE} has no SEED_LOCAL_DATABASE_URL`);
  return checkLocalUrl(url);
}

export interface ProductionTarget {
  kind: "production";
  url: string;
  ref: string;
  serviceKey: string;
}

const REF = /^[a-z]{20}$/;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/** Checks the URL and key against the ref without contacting anything. */
export function checkProduction(
  url: string | undefined,
  serviceKey: string | undefined,
  expectedRef: string | undefined,
  confirmRef: string | undefined
): ProductionTarget {
  if (!expectedRef || !REF.test(expectedRef)) throw new GuardError("--expected-project-ref must be a 20-letter project ref");
  if (confirmRef !== undefined && confirmRef !== expectedRef)
    throw new GuardError("--confirm-production does not match --expected-project-ref");
  if (!url) throw new GuardError("SEED_SUPABASE_URL is missing");
  if (!serviceKey) throw new GuardError("SEED_SUPABASE_SERVICE_ROLE_KEY is missing");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new GuardError("SEED_SUPABASE_URL is not a URL");
  }
  if (u.protocol !== "https:") throw new GuardError("SEED_SUPABASE_URL must be https");
  if (u.username || u.password) throw new GuardError("SEED_SUPABASE_URL must not carry credentials");
  if (u.port) throw new GuardError("SEED_SUPABASE_URL must not name a port");
  if ((u.pathname !== "/" && u.pathname !== "") || u.search || u.hash)
    throw new GuardError("SEED_SUPABASE_URL must be the bare project URL, with no path, query or fragment");
  if (u.hostname !== `${expectedRef}.supabase.co`)
    throw new GuardError(`SEED_SUPABASE_URL is for ${u.hostname}, not ${expectedRef}.supabase.co`);
  if (/\s/.test(serviceKey)) throw new GuardError("the service key contains whitespace");
  if (serviceKey.startsWith("sb_publishable_")) throw new GuardError("that is a publishable key; the seed needs the service key");
  if (!serviceKey.startsWith("sb_secret_")) {
    const payload = decodeJwtPayload(serviceKey);
    if (!payload) throw new GuardError("the service key is neither a JWT nor an sb_secret_ key");
    if (payload.role !== "service_role") throw new GuardError("the key is not a service_role key");
    if (payload.ref !== expectedRef) throw new GuardError("the key was issued for a different project");
  }
  return { kind: "production", url: `https://${expectedRef}.supabase.co`, ref: expectedRef, serviceKey };
}

export function productionTarget(
  expectedRef: string | undefined,
  confirmRef: string | undefined,
  root = process.cwd()
): ProductionTarget {
  // Checked before the file is even read, so a typo fails without touching it.
  if (!expectedRef || !REF.test(expectedRef)) throw new GuardError("--expected-project-ref must be a 20-letter project ref");
  const env = readFile(root, PRODUCTION_FILE);
  return checkProduction(env.SEED_SUPABASE_URL, env.SEED_SUPABASE_SERVICE_ROLE_KEY, expectedRef, confirmRef);
}

/** For logs: never the key, never a URL with credentials. */
export function describeTarget(t: LocalTarget | ProductionTarget): string {
  return t.kind === "local" ? `local ${t.host}:${t.port}/${t.database}` : `production ${t.ref}`;
}
