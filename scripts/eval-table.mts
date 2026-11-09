/**
 * `pnpm eval:table <dir> [note]`: writes a recorded day round's table into README.md, between
 * its `eval-table` markers (`src/eval/readme-table.ts`). `<dir>` is the round's
 * `EVAL_OUT`: it reads `day-runs.jsonl`, and `place-checks.jsonl` when the places were checked.
 * The golden set's file tells whether the round sent it; a note, when given, closes the line
 * under the table. It calls nothing: the round's records are all it reads.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import {
  dayRunsOf,
  goldenRequestsOf,
  placeChecksOf,
  roundTableMarkdown,
  roundTableOf,
  withTableIn,
} from "../src/eval/readme-table.ts";

const README_PATH = fileURLToPath(new URL("../README.md", import.meta.url));
const GOLDEN_PATH = new URL("../src/lib/fixtures/live/golden-days.jsonl", import.meta.url);

function textIfThere(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

const [dir, note = ""] = process.argv.slice(2);
if (dir === undefined) {
  process.stderr.write("Usage: pnpm eval:table <round directory> [note]\n");
  process.exitCode = 1;
} else {
  const runs = dayRunsOf(readFileSync(join(dir, "day-runs.jsonl"), "utf8"));
  const placesText = textIfThere(join(dir, "place-checks.jsonl"));
  const places = placesText === null ? null : placeChecksOf(placesText);
  const golden = goldenRequestsOf(readFileSync(GOLDEN_PATH, "utf8"));
  const lines = roundTableMarkdown(roundTableOf(runs, places, golden), note);
  const readme = withTableIn(readFileSync(README_PATH, "utf8"), lines);
  const config = await resolveConfig(README_PATH);
  writeFileSync(README_PATH, await format(readme, { ...config, filepath: README_PATH }));
  process.stdout.write(`${lines.join("\n")}\n\nWritten into ${README_PATH}\n`);
}
