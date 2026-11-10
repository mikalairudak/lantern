/**
 * Everything Lantern keeps in a browser, by its key in `localStorage`: the one place a key is
 * named. A visitor's keys carry what the privacy page says of them, so the page says every one,
 * and says true which leaves the browser; the owner's mark stands apart, since no visitor's
 * browser holds it. A test reads every storage call in `src` against the catalog.
 */

/** One thing kept in the browser. */
export interface StoredInBrowser {
  /** Its key in `localStorage`. */
  key: string;
  /** What it keeps, as the privacy page says it, in the list after "Your browser keeps". */
  keeps: string;
  /** When it leaves the browser and what of it, as the privacy page says it; null for never. */
  sent: string | null;
}

/** The most of the visitor's own days the browser keeps, newest first. */
export const YOUR_DAYS_KEPT = 12;

/** The most days whose picked places the browser keeps, the one changed last first. */
export const PICKED_DAYS_KEPT = 50;

export const BROWSER_STORAGE = {
  theme: {
    key: "lantern-theme",
    keeps: "your light or dark choice",
    sent: null,
  },
  view: {
    key: "lantern-day-view",
    keeps: "whether you read a day on the chart or as a list",
    sent: "with its notes on how the page is used, the page tells Lantern whether you are reading the day on the chart or as a list",
  },
  days: {
    key: "lantern.days.v1",
    keeps: `a list of up to ${YOUR_DAYS_KEPT} days Lantern wrote for you, to show them again on the start screen`,
    sent: null,
  },
  seen: {
    key: "lantern.seen.v1",
    keeps:
      "which days you watched to the end, Lantern's own and the ones you asked for or opened by their link, so they open whole next time",
    sent: "when you open one of Lantern's own days again, the page tells Lantern which version you saw, and nothing else",
  },
  picks: {
    key: "lantern.picks.v1",
    keeps: `the places you chose over Lantern's picks on up to ${PICKED_DAYS_KEPT} days, so a day opens as you left it`,
    sent: "when you change when a day starts, has dinner or ends, the page tells Lantern which of its places you chose, by Lantern's own references to them, so the part written again fits around them",
  },
  caveats: {
    key: "lantern.caveats.v1",
    keeps:
      "the words you typed that Lantern could not plan a day around, beside each of your days, so the day says them again when it opens",
    sent: null,
  },
  dragged: {
    key: "lantern.dragged.v1",
    keeps: "whether you have dragged a day's curve, so the chart stops showing how",
    sent: null,
  },
} as const satisfies Record<string, StoredInBrowser>;

/**
 * What Lantern keeps in its owner's browsers alone, set only behind the owner's password and
 * never for a visitor, so the privacy page, which says what a visitor's browser keeps, does not
 * list it (`docs/decisions.md`, "Product events are kept under a visitor key that lives one day").
 */
export const OWNER_BROWSER_STORAGE = {
  /** The browser is the owner's: it counts no page view and sends no product event. */
  uncounted: { key: "lantern.uncounted.v1" },
} as const satisfies Record<string, Pick<StoredInBrowser, "key">>;

/** Every key Lantern keeps in a browser, a visitor's and the owner's. */
export const BROWSER_STORAGE_KEYS: readonly string[] = [
  ...Object.values(BROWSER_STORAGE),
  ...Object.values(OWNER_BROWSER_STORAGE),
].map(({ key }) => key);

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What the privacy page says the browser keeps, every key in its list, and which of them
 * leaves it and when.
 */
export function browserStorageLine(): string {
  const stored: readonly StoredInBrowser[] = Object.values(BROWSER_STORAGE);
  const kept = stored.map(({ keeps }) => keeps);
  const list =
    kept.length > 1 ? `${kept.slice(0, -1).join("; ")}; and ${kept.at(-1)}` : (kept[0] ?? "");
  const sent = stored.flatMap(({ sent: when }) => (when === null ? [] : [capitalized(when)]));
  const rest = sent.length === 0 ? "None of it" : "The rest";
  return [
    `Your browser keeps ${list}.`,
    ...sent.map((line) => `${line}.`),
    `${rest} never leaves your browser.`,
  ].join(" ");
}
