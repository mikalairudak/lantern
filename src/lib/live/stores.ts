import { neonSql, type Sql } from "@/lib/db/sql";
import { needsDatabase, type LiveEnv } from "./flag";
import { InMemoryGenerationLog, type DayArchive, type GenerationLog } from "./generation-log";
import {
  InMemoryAppSpend,
  InMemoryVisitorLimits,
  type AppSpend,
  type VisitorLimits,
} from "./limits";
import { PostgresAppSpend, PostgresGenerationLog, PostgresVisitorLimits } from "./postgres-stores";

/**
 * Where the live routes count, hold and log, and where a kept day is read back: the stores
 * alone, apart from the models and the place lookups `services.ts` adds, so a page that only
 * opens a kept day (`stored-days.ts`) loads neither the model's provider nor Geoapify's client.
 */

export interface Stores {
  visitorLimits: VisitorLimits;
  appSpend: AppSpend;
  generationLog: GenerationLog;
  /** The same log, read back for a day kept to be opened again. */
  dayArchive: DayArchive;
}

/** Where a record says it ran when Vercel does not say: a laptop. */
const LOCAL_ENVIRONMENT = "development";

/** A database that is not there: every statement fails, so every request answers 503. */
const NO_DATABASE: Sql = {
  query: () => Promise.reject(new Error("DATABASE_URL is not set, and this server needs it")),
  transaction: () => Promise.reject(new Error("DATABASE_URL is not set, and this server needs it")),
};

/**
 * In Postgres when `DATABASE_URL` is set, shared by every instance; otherwise in memory,
 * which only a laptop's single process holds as written. A server that needs the database
 * and has none never counts in memory: its config is refused (`flag.ts`), and its stores
 * refuse every call besides. Nothing connects here: the first query does, and a database
 * that fails it fails that request, which answers 503 before any model call.
 */
function storesOf(env: LiveEnv): Stores {
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (databaseUrl === "" && !needsDatabase(env)) {
    const log = new InMemoryGenerationLog();
    return {
      visitorLimits: new InMemoryVisitorLimits(),
      appSpend: new InMemoryAppSpend(),
      generationLog: log,
      dayArchive: log,
    };
  }
  const sql = databaseUrl === "" ? NO_DATABASE : neonSql(databaseUrl);
  const environment = env.VERCEL_ENV?.trim() || LOCAL_ENVIRONMENT;
  const log = new PostgresGenerationLog(sql, environment);
  return {
    visitorLimits: new PostgresVisitorLimits(sql),
    appSpend: new PostgresAppSpend(sql),
    generationLog: log,
    dayArchive: log,
  };
}

/**
 * Made once per process for each database and environment, on `globalThis` because Next
 * bundles each route on its own, and module-level stores would give the day and the intake
 * a count each (as `src/lib/places/server.ts` found).
 */
const STORES_GLOBAL = "__lanternLiveStoresByDatabase";
const processGlobal = globalThis as typeof globalThis & { [STORES_GLOBAL]?: Map<string, Stores> };
const STORES = (processGlobal[STORES_GLOBAL] ??= new Map<string, Stores>());

/** The stores the routes count and log in, the same for the day and the intake. */
export function storesFor(env: LiveEnv): Stores {
  const key = JSON.stringify([
    env.DATABASE_URL?.trim() ?? "",
    env.VERCEL_ENV ?? "",
    needsDatabase(env),
  ]);
  let stores = STORES.get(key);
  if (stores === undefined) {
    stores = storesOf(env);
    STORES.set(key, stores);
  }
  return stores;
}
