import { CPU_RATE, expect, waitMs, type Page } from "./fixtures";

/** A status as a screen reader meets it: put on the page holding words, or its words changed. */
interface StatusEntry {
  t: number;
  /** Which status, in the order each came onto the page. */
  id: number;
  kind: "added" | "changed";
  text: string;
}

declare global {
  interface Window {
    statusLog: StatusEntry[];
  }
}

/**
 * Logs every status on the page from its first byte, by `performance.now()`: each as it comes
 * onto the page, with the words it holds then, and each change of its words after. Run as an
 * init script, so it has no outside names.
 */
export function logStatuses(): void {
  const log: StatusEntry[] = [];
  window.statusLog = log;
  const ids = new Map<Element, number>();
  const said = new Map<Element, string>();
  const note = () => {
    const t = performance.now();
    for (const status of document.querySelectorAll('[role="status"]')) {
      const text = status.textContent ?? "";
      if (!ids.has(status)) {
        ids.set(status, ids.size);
        log.push({ t, id: ids.get(status)!, kind: "added", text });
      } else if (said.get(status) !== text) {
        log.push({ t, id: ids.get(status)!, kind: "changed", text });
      }
      said.set(status, text);
    }
  };
  new MutationObserver(note).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

/**
 * The page said `line` once, as a change of a status that was on the page before, held it at
 * least `heldMs`, then fell quiet and did not say it again: since `since` on the page's clock,
 * or since it was opened.
 */
export async function expectSaidOnceAsChange(
  page: Page,
  line: string,
  heldMs: number,
  since = 0,
): Promise<void> {
  const logOf = () =>
    page.evaluate((since) => window.statusLog.filter((entry) => entry.t >= since), since);
  const saying = (log: StatusEntry[]) => log.filter((entry) => entry.text.includes(line));
  const quietAfter = (log: StatusEntry[], said: StatusEntry) =>
    log.find((entry) => entry.id === said.id && entry.t > said.t) ?? null;
  await expect
    .poll(
      async () => {
        const log = await logOf();
        const said = saying(log)[0];
        return said !== undefined && quietAfter(log, said) !== null;
      },
      { timeout: waitMs(heldMs * 3) },
    )
    .toBe(true);

  const log = await logOf();
  const [said, ...again] = saying(log);
  expect(said!.kind, "a status put on the page already holding the line").toBe("changed");
  // It stood before the line: on the page, empty, at an earlier moment than the line's.
  const born = (await page.evaluate(() => window.statusLog)).find(
    (entry) => entry.id === said!.id && entry.kind === "added",
  );
  expect(born?.text, "the status as it came onto the page").toBe("");
  expect(born!.t, "the status came onto the page before the line").toBeLessThan(said!.t);
  expect(again, "said again").toEqual([]);
  const quiet = quietAfter(log, said!)!;
  expect(quiet.text).toBe("");
  expect(quiet.t - said!.t).toBeGreaterThanOrEqual(heldMs - waitMs(LOGGED_LATE_MS) * CPU_RATE);
}

/**
 * The log notes a change after the task that made it is done, which may already have started
 * the timer that ends what it says; on a page whose CPU is slowed, that task is as much longer.
 */
const LOGGED_LATE_MS = 50;
