/**
 * `pnpm db:migrate [--yes]`: says which database it would change and what it would apply,
 * and applies the migrations in `db/migrations/` only with `--yes` (`runMigrateCommand`).
 * It reads `DATABASE_URL_UNPOOLED`, or else `DATABASE_URL`, from the shell or from
 * `.env.local`; a value set in the shell wins. It holds a session over a WebSocket rather
 * than querying over HTTP, so each migration and the row that records it are one
 * transaction.
 */
import { fileURLToPath } from "node:url";
import { runMigrateCommand } from "../src/lib/db/migrate.ts";
import { connectToNeon } from "./neon-session.mts";

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL("../db/migrations/", import.meta.url));

process.exitCode = await runMigrateCommand({
  env: process.env,
  args: process.argv.slice(2),
  directory: MIGRATIONS_DIRECTORY,
  connect: connectToNeon,
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
