import axe, { type AxeResults, type NodeResult, type Result, type RunOptions } from "axe-core";
import type { Page } from "./fixtures";

/**
 * The rules of WCAG 2.0, 2.1 and 2.2 at levels A and AA, as axe tags them: the level Lantern
 * aims at (`docs/decisions.md`, "axe checks the pages a visitor reaches against WCAG's A and AA
 * rules, in the e2e").
 */
export const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

/**
 * What axe never reads: the dev server's own overlay, which the e2e's `next dev` draws over
 * every page and production never serves.
 */
const NOT_THE_PAGE = [["nextjs-portal"]];

/**
 * Runs axe over the page as it stands. axe's own script is read from the version pinned in
 * package.json and put in the page through the debugger, which no page policy refuses, so a
 * page whose axe could not run fails here rather than reads as one with nothing wrong.
 */
export async function axeResultsOf(page: Page, options: RunOptions = {}): Promise<AxeResults> {
  await page.evaluate(axe.source);
  return page.evaluate(
    ([exclude, runOptions]) =>
      (window as unknown as { axe: typeof axe }).axe.run({ exclude }, runOptions),
    [NOT_THE_PAGE, options] as const,
  );
}

/**
 * A violation axe reports that is no failure of the criterion it cites: the rule, the nodes it
 * covers, and why it is not one.
 */
export interface Exemption {
  rule: string;
  /** A CSS selector every exempted node matches. */
  selector: string;
  why: string;
}

/** One line for each node a rule failed on, for a failure message a reader can act on. */
function lineOf(result: Result, node: NodeResult): string {
  return `${result.id} (${result.impact ?? "no impact"}): ${node.target.join(" ")}`;
}

/**
 * Every violation's nodes as lines, apart into those no exemption covers and those one does.
 * Each node is matched in the page, by the selector axe gives for it.
 */
export async function violationsOf(
  page: Page,
  results: readonly Result[],
  exemptions: readonly Exemption[] = [],
): Promise<{ failures: string[]; exempted: string[] }> {
  const failures: string[] = [];
  const exempted: string[] = [];
  for (const result of results) {
    for (const node of result.nodes) {
      const target = String(node.target.at(-1));
      const covers = exemptions.filter((exemption) => exemption.rule === result.id);
      const isExempt = await page.evaluate(
        ([selector, selectors]) =>
          selectors.some((each) => document.querySelector(selector)?.matches(each) ?? false),
        [target, covers.map((exemption) => exemption.selector)] as const,
      );
      (isExempt ? exempted : failures).push(lineOf(result, node));
    }
  }
  return { failures, exempted };
}
