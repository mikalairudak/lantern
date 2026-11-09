import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The decision log is read from its Index, which lists every entry once under its area. An
 * entry added without its line, or a heading reworded under its link, would leave the Index
 * wrong without a word, so the Index is held by a test, as the maps' paths are
 * (`src/lib/doc-paths.test.ts`).
 */

const LOG = readFileSync(join(__dirname, "..", "..", "docs", "decisions.md"), "utf8");

/** An entry's heading, such as `## 2026-10-20 — Two-layer data contract`. */
const ENTRY_HEADING = /^## (?!Index$)(.+)$/gm;

/** A link to a heading of the same file, such as `(#2026-10-20--two-layer-data-contract)`. */
const ANCHOR_LINK = /\]\(#([^)\s]+)\)/g;

/** The anchor GitHub gives a heading: lower case, punctuation dropped, each space a hyphen. */
function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

function anchorsLinkedIn(markdown: string): string[] {
  return [...markdown.matchAll(ANCHOR_LINK)].map(([, anchor = ""]) => anchor);
}

const entryAnchors = [...LOG.matchAll(ENTRY_HEADING)].map(([, heading = ""]) => anchorOf(heading));
const index = LOG.slice(LOG.indexOf("\n## Index\n"), LOG.search(/^## (?!Index$)/m));
const byArea = index.slice(index.indexOf("\n### By area\n"));

function countsOf(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

describe("the decision log's Index", () => {
  it.each([
    ["2026-10-20 — Two-layer data contract", "2026-10-20--two-layer-data-contract"],
    [
      "2026-10-20 — The model describes light; code computes it",
      "2026-10-20--the-model-describes-light-code-computes-it",
    ],
    [
      "2026-10-30 — Lantern names no restaurant, café or bar",
      "2026-10-30--lantern-names-no-restaurant-café-or-bar",
    ],
    [
      "2026-11-06 — A paid eval round runs the routes' own code in its own process",
      "2026-11-06--a-paid-eval-round-runs-the-routes-own-code-in-its-own-process",
    ],
    // Two made-up headings, for an underscore, a version number and a trailing "!".
    [
      "2026-01-01 — A heading names `EVAL_CONFIRM_USD` and WCAG 2.5.8",
      "2026-01-01--a-heading-names-eval_confirm_usd-and-wcag-258",
    ],
    ['2026-01-01 — A heading ends on "!"', "2026-01-01--a-heading-ends-on-"],
  ])("reads %s as GitHub anchors it", (heading, anchor) => {
    expect(anchorOf(heading)).toBe(anchor);
  });

  it("reads the log's entries and the Index's areas, so the checks are not reading nothing", () => {
    expect(entryAnchors.length).toBeGreaterThan(30);
    expect(anchorsLinkedIn(byArea).length).toBeGreaterThan(30);
  });

  it("finds no two entries with one heading", () => {
    const repeated = [...countsOf(entryAnchors)].filter(([, count]) => count > 1);

    expect(repeated).toEqual([]);
  });

  it("lists every entry once under its area", () => {
    const listed = countsOf(anchorsLinkedIn(byArea));
    const notOnce = entryAnchors.filter((anchor) => listed.get(anchor) !== 1);

    expect(notOnce).toEqual([]);
  });

  it("links only to entries the log holds", () => {
    const entries = new Set(entryAnchors);
    const dangling = anchorsLinkedIn(index).filter((anchor) => !entries.has(anchor));

    expect(dangling).toEqual([]);
  });
});
