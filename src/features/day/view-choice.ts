/**
 * How the visitor reads a day: on its plan, the list, or on the chart (`docs/decisions.md`, "A day
 * can be read as a list, written as the chart is", and "A day opens on its plan, lit by the
 * day's light"). A day opens on its plan unless the visitor chose the chart, a choice a visitor of the
 * chart-first site kept too. The choice is kept in this browser's storage, as the theme is, and
 * noted on `<html>` as `data-day-view` before the first paint, so a visitor who chose the chart
 * never sees the plan flash first. The view on show goes with the product's events about the day
 * on screen (`use-day-events.ts`), as the privacy page says; nothing else of it leaves the
 * browser. Where nothing set the attribute, as where no script runs, the styles show the plan
 * (`globals.css`), and the switch the server draws says so. The day itself is not yet in a
 * written day's first HTML, which streams it in a part only the script shows, so a page read
 * without its script has no plan to show until it is. The server never reads the choice, so a
 * written day's page stays one page for everyone, served from the cache.
 */

import { BROWSER_STORAGE } from "@/lib/browser-storage";
import type { DAY_VIEWS } from "@/lib/events/event.schema";

/** The events' words for the views, so what an event says of the view is the page's own. */
export type DayView = (typeof DAY_VIEWS)[number];

/** Where the choice is kept, in `localStorage`. */
export const DAY_VIEW_STORAGE_KEY = BROWSER_STORAGE.view.key;

/** The attribute on `<html>` that the styles show one view by (`globals.css`). */
export const DAY_VIEW_ATTRIBUTE = "data-day-view";

/** Told to the page's switches when the view changes. */
const DAY_VIEW_EVENT = "lantern-day-view";

function isDayView(value: unknown): value is DayView {
  return value === "chart" || value === "read";
}

/** The view a day opens on where the visitor chose none: its plan. */
const FIRST_VIEW: DayView = "read";

/** The view kept in storage, or the one a day opens on where none is kept. */
function storedViewOf(stored: string | null): DayView {
  return isDayView(stored) ? stored : FIRST_VIEW;
}

/**
 * Run in `<head>` before the page paints: the stored view on `<html>`, or where none is stored
 * the plan. Storage can be unavailable, as in a private window, and the page then shows the
 * view a day opens on.
 */
export function dayViewScriptOf(): string {
  const key = JSON.stringify(DAY_VIEW_STORAGE_KEY);
  const first = JSON.stringify(FIRST_VIEW);
  return `(function(){var v=${first};try{var s=localStorage.getItem(${key});if(s==="read"||s==="chart")v=s}catch(e){}document.documentElement.setAttribute(${JSON.stringify(DAY_VIEW_ATTRIBUTE)},v)})()`;
}

/** The view the page shows: what `<html>` carries, the plan where nothing set it. */
export function readDayView(): DayView {
  return storedViewOf(document.documentElement.getAttribute(DAY_VIEW_ATTRIBUTE));
}

/**
 * What the server renders, before the page can know the visitor's choice: the plan, which
 * the styles show where nothing set the attribute, so the switch's pressed button is the
 * view on show.
 */
export function serverDayView(): DayView {
  return FIRST_VIEW;
}

/**
 * Sets the stored view on `<html>` where the head script has not run, as on a page React
 * drew in the browser, where no script it draws runs.
 */
export function restoreDayView(): void {
  const root = document.documentElement;
  if (root.hasAttribute(DAY_VIEW_ATTRIBUTE)) return;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(DAY_VIEW_STORAGE_KEY);
  } catch {
    // Without storage the page shows the view a day opens on, as the head script does.
  }
  root.setAttribute(DAY_VIEW_ATTRIBUTE, storedViewOf(stored));
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
    // A choice cleared reads as the view a day opens on: the plan.
    document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, storedViewOf(event.newValue));
    onChange();
  };
  window.addEventListener(DAY_VIEW_EVENT, onChange);
  window.addEventListener("storage", fromStorage);
  return () => {
    window.removeEventListener(DAY_VIEW_EVENT, onChange);
    window.removeEventListener("storage", fromStorage);
  };
}
