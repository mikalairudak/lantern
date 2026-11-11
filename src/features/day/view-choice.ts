/**
 * How the visitor reads a day: on the chart, or as a list (`docs/decisions.md`, "A day can be read
 * as a list, written as the chart is"). Kept in this browser's storage, as the theme is, and noted
 * on `<html>` as `data-day-view` before the first paint, so a visitor who chose the list never sees
 * the chart flash first. The view on show goes with the product's events about the day on screen
 * (`use-day-events.ts`), as the privacy page says; nothing else of it leaves the browser. Where
 * nothing set the attribute, as where no script runs, the styles show the list (`globals.css`),
 * and the switch the server draws says so. The day itself is not yet in a written day's first
 * HTML, which streams it in a part only the script shows, so a page read without its script has no
 * list to show until it is. The server never reads the choice, so a written day's page stays one
 * page for everyone, served from the cache.
 */

import { BROWSER_STORAGE } from "@/lib/browser-storage";
import type { DAY_VIEWS } from "@/lib/events/event.schema";

/** The events' words for the views, so what an event says of the view is the page's own. */
export type DayView = (typeof DAY_VIEWS)[number];

/** Where the choice is kept, in `localStorage`. */
export const DAY_VIEW_STORAGE_KEY = BROWSER_STORAGE.view.key;

/** The attribute on `<html>` that the styles show one view by (`globals.css`). */
export const DAY_VIEW_ATTRIBUTE = "data-day-view";

/** The attribute the root layout sets on `<html>` while the first impression is on. */
const FIRST_IMPRESSION_ATTRIBUTE = "data-first-impression";

/** Told to the page's switches when the view changes. */
const DAY_VIEW_EVENT = "lantern-day-view";

function isDayView(value: unknown): value is DayView {
  return value === "chart" || value === "read";
}

/** The view kept in storage, or the one a day opens on where none is kept. */
function storedViewOf(stored: string | null, isPlanFirst: boolean): DayView {
  if (isDayView(stored)) return stored;
  return isPlanFirst ? "read" : "chart";
}

/**
 * Run in `<head>` before the page paints: the stored view on `<html>`, or where none is stored
 * the chart, or under the first impression the plan (`src/lib/first-impression.ts`). Storage can
 * be unavailable, as in a private window, and the page then shows the view a day opens on.
 */
export function dayViewScriptOf(isPlanFirst: boolean): string {
  const key = JSON.stringify(DAY_VIEW_STORAGE_KEY);
  const first = JSON.stringify(isPlanFirst ? "read" : "chart");
  return `(function(){var v=${first};try{var s=localStorage.getItem(${key});if(s==="read"||s==="chart")v=s}catch(e){}document.documentElement.setAttribute(${JSON.stringify(DAY_VIEW_ATTRIBUTE)},v)})()`;
}

/** The view the page shows: what `<html>` carries, the list where nothing set it. */
export function readDayView(): DayView {
  const view = document.documentElement.getAttribute(DAY_VIEW_ATTRIBUTE);
  return isDayView(view) ? view : "read";
}

/**
 * What the server renders, before the page can know the visitor's choice: the list, which
 * the styles show where nothing set the attribute, so the switch's pressed button is the
 * view on show.
 */
export function serverDayView(): DayView {
  return "read";
}

/**
 * Sets the stored view on `<html>` where the head script has not run, as on a page React
 * drew in the browser, where no script it draws runs.
 */
export function restoreDayView(isPlanFirst = false): void {
  const root = document.documentElement;
  if (root.hasAttribute(DAY_VIEW_ATTRIBUTE)) return;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(DAY_VIEW_STORAGE_KEY);
  } catch {
    // Without storage the page shows the view a day opens on, as the head script does.
  }
  root.setAttribute(DAY_VIEW_ATTRIBUTE, storedViewOf(stored, isPlanFirst));
  window.dispatchEvent(new Event(DAY_VIEW_EVENT));
}

/** Shows a view at once, keeps it for the next visit, and tells every switch on the page. */
export function applyDayView(view: DayView): void {
  document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, view);
  // Kept by its value, the chart's too, so a choice holds whichever view a day opens on.
  try {
    localStorage.setItem(DAY_VIEW_STORAGE_KEY, view);
  } catch {
    // Without storage the view holds for this page only.
  }
  window.dispatchEvent(new Event(DAY_VIEW_EVENT));
}

/** Calls back when the view changes, on this page or from another tab. */
export function subscribeDayView(onChange: () => void): () => void {
  const fromStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== DAY_VIEW_STORAGE_KEY) return;
    document.documentElement.setAttribute(
      DAY_VIEW_ATTRIBUTE,
      // A choice cleared reads as the view a day opens on: the plan under the first impression,
      // which the root layout notes on <html>, the chart otherwise.
      storedViewOf(
        event.newValue,
        document.documentElement.hasAttribute(FIRST_IMPRESSION_ATTRIBUTE),
      ),
    );
    onChange();
  };
  window.addEventListener(DAY_VIEW_EVENT, onChange);
  window.addEventListener("storage", fromStorage);
  return () => {
    window.removeEventListener(DAY_VIEW_EVENT, onChange);
    window.removeEventListener("storage", fromStorage);
  };
}
