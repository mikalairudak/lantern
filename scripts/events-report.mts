/**
 * `pnpm events:report [--environment production] [--days 30]`: prints the product's counts
 * (`runEventsReport`). It reads `DATABASE_URL_UNPOOLED`, or else `DATABASE_URL`, from the
 * shell or from `.env.local`, a value set in the shell winning, as `pnpm db:migrate` does,
 * and connects as it does; it only reads, inside a read-only transaction. To read
 * production, follow `docs/harness.md`, "Production is migrated by hand", with this script
 * in place of `scripts/db-migrate.mts`.
 */
import { runEventsReport } from "../src/lib/events/report.ts";
import { connectToNeon } from "./neon-session.mts";

process.exitCode = await runEventsReport({
  env: process.env,
  args: process.argv.slice(2),
  connect: connectToNeon,
  now: new Date(),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
