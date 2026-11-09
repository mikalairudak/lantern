/**
 * One session on a Neon database over a WebSocket, as the database scripts hold it
 * (`pnpm db:migrate`, `pnpm events:report`, `pnpm log:report`): a session rather than queries
 * over HTTP, so a migration and the row that records it are one transaction, and a report's
 * read-only transaction holds across its queries.
 */
import { Pool } from "@neondatabase/serverless";
import type { MigrationConnection } from "../src/lib/db/migrate.ts";
import { redactCrashesOf } from "../src/lib/db/redacted-crash.ts";

export async function connectToNeon(connectionString: string): Promise<MigrationConnection> {
  // From here on, a crash of any database script prints its message alone, redacted.
  redactCrashesOf(connectionString);
  const pool = new Pool({ connectionString });
  // A client that fails after it was handed out (a database that does not exist, a dropped
  // socket) reaches the pool as an "error" event. Unheard, Node throws it and prints the
  // client whole, its connection string and password included. The query that failed has
  // already reported the failure, redacted, so the event is dropped here.
  pool.on("error", () => undefined);
  try {
    const client = await pool.connect();
    return {
      session: {
        exec: async (text) => {
          await client.query(text);
        },
        query: async (text, params = []) => (await client.query(text, [...params])).rows,
      },
      close: async () => {
        client.release();
        await pool.end();
      },
    };
  } catch (cause) {
    await pool.end();
    throw cause;
  }
}
