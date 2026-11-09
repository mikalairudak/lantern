import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The maps a cold reader starts from name the tree's files by path, and a move that forgets
 * them leaves a map wrong without a word. So every path they name must exist, held by a test
 * as the tokens are (`docs/decisions.md`, "Tokens are enforced, not documented").
 */

const ROOT = join(__dirname, "..", "..");

const MAPS = ["ARCHITECTURE.md", "README.md"] as const;

/** Where a repository path written in backticks starts. */
const REPO_PATH = /^(src|e2e|scripts|docs|db)\//;

/** A span in backticks with no space in it, such as `src/lib/site.ts`. */
const BACKTICKED = /`([^`\s]+)`/g;

/** A Markdown link's target, such as (docs/roadmap.md#scope). */
const LINK_TARGET = /\]\(([^)\s]+)\)/g;

/** A fenced block: a diagram or a shell example, which names no path in backticks. */
const FENCED_BLOCK = /^```[\s\S]*?^```/gm;

/** A placeholder, not a path: `src/features/<x>/`, `src/**`. */
const PLACEHOLDER = /[<>*{}]/;

/** A path as a file system reads it, without its anchor or a line number. */
function bareOf(path: string): string {
  return path.replace(/#.*$/, "").replace(/:\d+(-\d+)?$/, "");
}

function isRelativeLink(target: string): boolean {
  return !target.includes("://") && !target.startsWith("#") && !target.startsWith("mailto:");
}

/** Every path a Markdown text names: repository paths in backticks, and relative link targets. */
function pathsIn(markdown: string): string[] {
  const prose = markdown.replace(FENCED_BLOCK, "");
  const backticked = [...prose.matchAll(BACKTICKED)]
    .map(([, span = ""]) => bareOf(span))
    .filter((span) => REPO_PATH.test(span));
  const linked = [...prose.matchAll(LINK_TARGET)]
    .map(([, target = ""]) => target)
    .filter(isRelativeLink)
    .map(bareOf);
  return [...new Set([...backticked, ...linked])].filter(
    (path) => path !== "" && !PLACEHOLDER.test(path),
  );
}

describe("the paths the maps name", () => {
  it("reads paths in backticks and link targets, and skips anchors, lines and placeholders", () => {
    const markdown = [
      "See `src/lib/site.ts:12`, `docs/decisions.md`, [the roadmap](docs/roadmap.md#scope),",
      "[the site](https://www.lanternday.com), [below](#flows), `src/features/<x>/`,",
      "`pnpm check` and `day.tsx`.",
      "```bash",
      "EVAL_OUT=scripts/not-a-path pnpm eval:live",
      "```",
    ].join("\n");

    expect(pathsIn(markdown)).toEqual(["src/lib/site.ts", "docs/decisions.md", "docs/roadmap.md"]);
  });

  it.each(MAPS)("%s names only paths that exist", (map) => {
    const paths = pathsIn(readFileSync(join(ROOT, map), "utf8"));

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => !existsSync(join(ROOT, path)))).toEqual([]);
  });

  it("finds the contract in the architecture's map, so the scan is not reading nothing", () => {
    const paths = pathsIn(readFileSync(join(ROOT, "ARCHITECTURE.md"), "utf8"));

    expect(paths).toContain("src/lib/schema/itinerary.schema.ts");
  });
});
