/**
 * `node scripts/check-commit-message.mts <message file>`: the `commit-msg` hook's check. It
 * holds the message git hands the hook to the rules in `src/lib/repo-hygiene.ts`, prints each
 * line that breaks one, and exits 1 so git keeps the commit back (`runCommitMessageCheck`).
 * It runs at every commit, so it reads one file and imports one module that imports nothing.
 */
import { readFileSync } from "node:fs";
import { runCommitMessageCheck } from "../src/lib/repo-hygiene.ts";

const [messageFile] = process.argv.slice(2);
if (messageFile === undefined) {
  process.stderr.write("Usage: node scripts/check-commit-message.mts <commit message file>\n");
  process.exit(1);
}

process.exitCode = runCommitMessageCheck(readFileSync(messageFile, "utf8"), (line) =>
  process.stderr.write(`${line}\n`),
);
