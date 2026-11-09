import { neonSql, type Sql } from "@/lib/db/sql";
import { needsDatabase, type LiveEnv } from "@/lib/live/flag";
import { logToConsole } from "@/lib/live/provider-error";
import type { EventDeps } from "./answer-event-request";
import { InMemoryEventStore, type EventStore } from "./event-store";
import { PostgresEventStore } from "./postgres-event-store";

/**
 * What `POST /api/events` runs on in a deployment. It reads `DATABASE_URL` and `VERCEL_ENV`
 * and nothing of live generation, so production counts while `LIVE_GENERATION` is off.
 */

/** Where an event says it arrived when Vercel does not say: a laptop, as the log says. */
const LOCAL_ENVIRONMENT = "development";

/** A database that is not there: every statement fails, so every event answers 503. */
const NO_DATABASE: Sql = {
  query: () => Promise.reject(new Error("DATABASE_URL is not set, and this server needs it")),
  transaction: () => Promise.reject(new Error("DATABASE_URL is not set, and this server needs it")),
};

/**
 * In Postgres when `DATABASE_URL` is set; otherwise in memory on a laptop, and nowhere on a
 * deploy, whose instances would each count their own. Nothing connects here: the first
 * event does.
 */
function eventStoreOf(env: LiveEnv): EventStore {
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (databaseUrl === "" && !needsDatabase(env)) return new InMemoryEventStore();
  const sql = databaseUrl === "" ? NO_DATABASE : neonSql(databaseUrl);
  return new PostgresEventStore(sql, env.VERCEL_ENV?.trim() || LOCAL_ENVIRONMENT);
}

/**
 * Made once per process for each database and environment, on `globalThis` as the live
 * stores are, so a day's salt is read once per process rather than once per module copy.
 */
const STORES_GLOBAL = "__lanternEventStoresByDatabase";
const processGlobal = globalThis as typeof globalThis & {
  [STORES_GLOBAL]?: Map<string, EventStore>;
};
const STORES = (processGlobal[STORES_GLOBAL] ??= new Map<string, EventStore>());

export function eventStoreFor(env: LiveEnv): EventStore {
  const key = JSON.stringify([
    env.DATABASE_URL?.trim() ?? "",
    env.VERCEL_ENV ?? "",
    needsDatabase(env),
  ]);
  let store = STORES.get(key);
  if (store === undefined) {
    store = eventStoreOf(env);
    STORES.set(key, store);
  }
  return store;
}

/** The route's dependencies, read per request. */
export function eventDepsOf(env: LiveEnv): EventDeps {
  return {
    store: eventStoreFor(env),
    log: logToConsole,
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
  };
}
