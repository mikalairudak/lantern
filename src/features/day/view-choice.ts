/**
 * How the visitor reads a day: on the chart, or as a list (`docs/decisions.md`, "A day can be read
 * as a list, written as the chart is"). Kept in this browser's storage, as the theme is, never sent
 * anywhere, and noted on `<html>` as `data-day-view` before the first paint, so a visitor who chose
 * the list never sees the chart flash first. Where nothing set the attribute, as where no script
 * runs, the styles show the list (`globals.css`), and the switch the server draws says so. The day
 * itself is not yet in a written day's first HTML, which streams it in a part only the script
 * shows, so a page read without its script has no list to show until it is. The server never reads
 * the choice, so a written day's page stays one page for everyone, served from the cache.
 */

import { BROWSER_STORAGE } from "@/lib/browser-storage";

export type DayView = "chart" | "read";

/** Where the choice is kept, in `localStorage`. */
export const DAY_VIEW_STORAGE_KEY = BROWSER_STORAGE.view.key;

/** The attribute on `<html>` that the styles show one view by (`globals.css`). */
export const DAY_VIEW_ATTRIBUTE = "data-day-view";

/** Told to the page's switches when the view changes. */
const DAY_VIEW_EVENT = "lantern-day-view";

function isDayView(value: unknown): value is DayView {
  return value === "chart" || value === "read";
}

/**
 * Run in `<head>` before the page paints: the stored view, or the chart, on `<html>`.
 * Storage can be unavailable, as in a private window, and the page then shows the chart.
 */
export const DAY_VIEW_SCRIPT = `(function(){var v="chart";try{if(localStorage.getItem(${JSON.stringify(DAY_VIEW_STORAGE_KEY)})==="read")v="read"}catch(e){}document.documentElement.setAttribute(${JSON.stringify(DAY_VIEW_ATTRIBUTE)},v)})()`;

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
export function restoreDayView(): void {
  const root = document.documentElement;
  if (root.hasAttribute(DAY_VIEW_ATTRIBUTE)) return;
  let view: DayView = "chart";
  try {
    if (localStorage.getItem(DAY_VIEW_STORAGE_KEY) === "read") view = "read";
  } catch {
    // Without storage the page shows the chart, as the head script does.
  }
  root.setAttribute(DAY_VIEW_ATTRIBUTE, view);
  window.dispatchEvent(new Event(DAY_VIEW_EVENT));
}

/** Shows a view at once, keeps it for the next visit, and tells every switch on the page. */
export function applyDayView(view: DayView): void {
  document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, view);
  try {
    if (view === "chart") localStorage.removeItem(DAY_VIEW_STORAGE_KEY);
    else localStorage.setItem(DAY_VIEW_STORAGE_KEY, view);
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
      event.newValue === "read" ? "read" : "chart",
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
