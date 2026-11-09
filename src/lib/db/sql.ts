import { neon } from "@neondatabase/serverless";
import { redacted, secretsOf } from "./redact";

/** One statement with numbered parameters. */
export interface Statement {
  text: string;
  params?: readonly unknown[];
}

/**
 * What the stores ask of Postgres: a statement and its rows, or several statements as one
 * transaction and each one's rows. Neon's HTTP driver serves it in production and PGlite in
 * tests, so every statement is written to run unchanged on both: integers rather than
 * `bigint` or `numeric`, which the two drivers return differently; JSON stringified by the
 * caller and cast with `::jsonb`; and `RETURNING`, so whether a statement applied is a row
 * count.
 */
export interface Sql {
  query<Row extends object>(text: string, params?: readonly unknown[]): Promise<Row[]>;
  /**
   * Runs the statements in order as one READ COMMITTED transaction, in one round trip.
   * Each statement reads the database as it stands when that statement starts, so one that
   * follows a `FOR UPDATE` sees everything committed by whoever held the lock before.
   */
  transaction(statements: readonly Statement[]): Promise<object[][]>;
}

if (typeof window !== "undefined") {
  throw new Error("src/lib/db/sql.ts holds the database's password and runs only on the server");
}

/**
 * A backstop for a request to Neon that never answers, as for `after()`'s writes. The
 * routes give everything they ask before a model call one shorter deadline of their own
 * (`PRE_CALL_DEADLINE_MS`).
 */
const REQUEST_TIMEOUT_MS = 10_000;

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Postgres on Neon over HTTP: each request is one transaction, with no connection to hold
 * between a function's invocations. Nothing connects until the first query, and a string
 * that is not a URL fails there, as a query does, so the routes' own failure paths handle
 * it. The driver's messages can quote the connection string, password included, so errors
 * leave here with the string and the password, raw or decoded, taken out.
 */
export function neonSql(connectionString: string): Sql {
  const sql = neon(connectionString);
  const secrets = secretsOf(connectionString);
  const fail = (cause: unknown): never => {
    throw new Error(redacted(messageOf(cause), secrets));
  };
  const fetchOptions = (): { signal: AbortSignal } => ({
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return {
    async query<Row extends object>(text: string, params: readonly unknown[] = []) {
      try {
        return (await sql.query(text, [...params], { fetchOptions: fetchOptions() })) as Row[];
      } catch (cause) {
        return fail(cause);
      }
    },
    async transaction(statements) {
      try {
        return await sql.transaction(
          statements.map(({ text, params = [] }) => sql.query(text, [...params])),
          { isolationLevel: "ReadCommitted", fetchOptions: fetchOptions() },
        );
      } catch (cause) {
        return fail(cause);
      }
    },
  };
}
