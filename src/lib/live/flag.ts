/**
 * Live generation runs behind a flag: on in production, off wherever `LIVE_GENERATION` is not
 * set, a laptop with no `.env.local` included. Off, the intake and day routes answer from the
 * written days and the written intake alone, with no call to a model or to Geoapify.
 */

/** The variable names live generation reads. Only names: values never enter the repository. */
export type LiveVariable =
  "LIVE_GENERATION" | "ANTHROPIC_API_KEY" | "VISITOR_HASH_SALT" | "DATABASE_URL";

/** The server's environment, as `process.env` gives it. */
export type LiveEnv = Readonly<Record<string, string | undefined>>;

/** The one value that turns live generation on. Anything else, unset included, is off. */
const LIVE_GENERATION_ON = "1";

/** Read per request, so a changed variable never needs a new build to take effect. */
export function isLiveGeneration(env: LiveEnv): boolean {
  return env.LIVE_GENERATION === LIVE_GENERATION_ON;
}

/** What a live call needs once the flag is on. */
export interface LiveConfig {
  /** Salts the visitor's hash, so a hash cannot be reversed by hashing every address. */
  visitorHashSalt: string;
}

export type LiveConfigResult =
  { kind: "ready"; config: LiveConfig } | { kind: "misconfigured"; missing: LiveVariable[] };

const REQUIRED: readonly LiveVariable[] = ["ANTHROPIC_API_KEY", "VISITOR_HASH_SALT"];

const DEPLOYED_ENVIRONMENTS: readonly (string | undefined)[] = ["production", "preview"];

/**
 * A deploy runs as many instances as traffic asks for, so its limits must be counted in the
 * one database they share: in memory each instance would keep its own counts, and the caps
 * would multiply by the instances warm. That is Vercel's preview and production, and any
 * production server elsewhere; only a laptop's development server counts in memory.
 */
export function needsDatabase(env: LiveEnv): boolean {
  return DEPLOYED_ENVIRONMENTS.includes(env.VERCEL_ENV) || env.NODE_ENV === "production";
}

function requiredIn(env: LiveEnv): readonly LiveVariable[] {
  return needsDatabase(env) ? [...REQUIRED, "DATABASE_URL"] : REQUIRED;
}

/**
 * The flag on without a key or a salt, or on a deploy without its database, is a deploy's
 * mistake, not the visitor's: the route refuses to call a model and says which names are
 * missing, rather than hash an address with an empty salt, count in one instance's memory,
 * or let every call fail at the provider.
 */
export function liveConfigOf(env: LiveEnv): LiveConfigResult {
  const missing = requiredIn(env).filter((name) => (env[name] ?? "").trim() === "");
  if (missing.length > 0) return { kind: "misconfigured", missing };
  return { kind: "ready", config: { visitorHashSalt: env.VISITOR_HASH_SALT ?? "" } };
}
