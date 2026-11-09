// With its extension, since the database scripts run this file through Node directly.
import { redacted, secretsOf } from "./redact.ts";

/**
 * Node's own report of a crash prints the error whole, and a database driver's error carries
 * its client, connection string and password included. Once a script holds a connection
 * string, `redactCrashesOf` makes any crash print one line, its message with every such string
 * taken out, and exit 1. The scripts call it where the string meets the driver
 * (`scripts/neon-session.mts`), so `db:migrate` with the owner's string, both reports and
 * `prod:read` all have it.
 */

/** The part of `process` this needs, so a test can pass its own. */
export interface CrashingProcess {
  on(event: string, listener: (cause: unknown) => void): unknown;
  exit(code: number): void;
  stderr: { write(text: string): unknown };
}

const secretsByProcess = new WeakMap<CrashingProcess, Set<string>>();

/** The one line a crash prints: never the error's other fields, where a driver keeps its client. */
export function crashLineOf(cause: unknown, secrets: Iterable<string>): string {
  const message = cause instanceof Error ? cause.message : "an error with no message";
  // Longest first, so a whole string goes before the password inside it.
  const longestFirst = [...secrets].sort((a, b) => b.length - a.length);
  return `Stopped: ${redacted(message, longestFirst)}`;
}

/** From the first call on, a crash prints `crashLineOf` with every string passed so far. */
export function redactCrashesOf(connectionString: string, target: CrashingProcess = process): void {
  let secrets = secretsByProcess.get(target);
  if (secrets === undefined) {
    const known = new Set<string>();
    secrets = known;
    secretsByProcess.set(target, known);
    const stop = (cause: unknown): void => {
      target.stderr.write(`${crashLineOf(cause, known)}\n`);
      target.exit(1);
    };
    target.on("uncaughtException", stop);
    target.on("unhandledRejection", stop);
  }
  for (const secret of secretsOf(connectionString)) secrets.add(secret);
}
