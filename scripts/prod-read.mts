/**
 * `pnpm prod:read <report>`: reads production as `lantern_reader` and prints only what the
 * report finds (`runProdRead`). The connection string comes from the owner's macOS Keychain
 * and nowhere else: this script is run without `--env-file`, and it reads no variable, so
 * neither `.env.local` nor the shell can point it at another database. `docs/ops.md` says how
 * the owner adds the item.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { redactCrashesOf } from "../src/lib/db/redacted-crash.ts";
import { KEYCHAIN_ITEM, runProdRead } from "../src/lib/ops/prod-read.ts";
import { connectToNeon } from "./neon-session.mts";

const run = promisify(execFile);

/**
 * By its full path: `pnpm run` puts `node_modules/.bin` first on PATH, where a package's bin
 * named `security` would otherwise be called in its place.
 */
const SECURITY = "/usr/bin/security";

/** The item's value, or `undefined` when there is none; the failure itself is not printed. */
async function readKeychain(): Promise<string | undefined> {
  try {
    const { stdout } = await run(SECURITY, [
      "find-generic-password",
      "-a",
      KEYCHAIN_ITEM.account,
      "-s",
      KEYCHAIN_ITEM.service,
      "-w",
    ]);
    const connectionString = stdout.trim();
    // Before the string reaches anything that could crash with it.
    if (connectionString !== "") redactCrashesOf(connectionString);
    return connectionString;
  } catch {
    return undefined;
  }
}

process.exitCode = await runProdRead({
  args: process.argv.slice(2),
  readConnectionString: readKeychain,
  connect: connectToNeon,
  now: new Date(),
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
