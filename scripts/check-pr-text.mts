/**
 * `node scripts/check-pr-text.mts --branch <name> --title <title> --body-file <path>`: the pull
 * request check, which `.github/workflows/pr-text.yml` runs on every pull request. It holds the
 * branch's name, the title and the body to the rules in `src/lib/repo-hygiene.ts`, prints each
 * fault, and exits 1 on any (`runPullRequestTextCheck`). It runs on plain Node, with no install,
 * so it imports one module that imports nothing.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { runPullRequestTextCheck } from "../src/lib/repo-hygiene.ts";

const USAGE =
  "Usage: node scripts/check-pr-text.mts --branch <name> --title <title> --body-file <path>\n" +
  "A value that starts with a dash is passed as --title=<title>.\n";

function readOptions(): { branch: string; title: string; bodyFile: string } | null {
  try {
    const { values } = parseArgs({
      options: {
        branch: { type: "string" },
        title: { type: "string" },
        "body-file": { type: "string" },
      },
    });
    const { branch, title, "body-file": bodyFile } = values;
    if (branch === undefined || title === undefined || bodyFile === undefined) return null;
    return { branch, title, bodyFile };
  } catch {
    return null;
  }
}

const options = readOptions();
if (options === null) {
  process.stderr.write(USAGE);
  process.exit(1);
}

process.exitCode = runPullRequestTextCheck(
  {
    branch: options.branch,
    title: options.title,
    body: readFileSync(options.bodyFile, "utf8"),
  },
  (line) => process.stderr.write(`${line}\n`),
);
