/**
 * The visitor's theme: the system's, or light or dark kept in this browser's storage. No
 * cookie and no banner: the choice never leaves the browser. A theme chosen sets
 * `data-theme` on `<html>`, which the colour tokens read (`globals.css`); the system's is
 * the attribute removed, so `color-scheme: light dark` answers to the device again. The
 * choice itself, the system's too, is noted beside it as `data-theme-choice`, which the
 * theme's icon reads, so it shows System on a dark device rather than the theme it resolves to.
 */

import { BROWSER_STORAGE } from "@/lib/browser-storage";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

/** Where the choice is kept, in `localStorage`; the system's theme is the key removed. */
export const THEME_STORAGE_KEY = BROWSER_STORAGE.theme.key;

/** The attribute on `<html>` that notes the choice, the system's included (`globals.css`). */
export const THEME_CHOICE_ATTRIBUTE = "data-theme-choice";

/** Told to every theme word on the page when one of them changes the theme. */
const THEME_EVENT = "lantern-theme";

function isChosenTheme(value: unknown): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

/**
 * Run in `<head>` before the page paints, so a stored theme is on `<html>` from the first
 * frame and the page never flashes the system's, and the theme's icon shows the choice from
 * that frame too. Storage can be unavailable, as in a private window, and the page then
 * keeps the system's theme.
 */
export const THEME_SCRIPT = `(function(){var r=document.documentElement,c="system";try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"){c=t;r.setAttribute("data-theme",t)}}catch(e){}r.setAttribute(${JSON.stringify(THEME_CHOICE_ATTRIBUTE)},c)})()`;

/** The theme the page is set in: what `<html>` carries, which the script set from storage. */
export function readThemeChoice(): ThemeChoice {
  const theme = document.documentElement.getAttribute("data-theme");
  return isChosenTheme(theme) ? theme : "system";
}

/** What the server renders, before the page can know the visitor's choice. */
export function serverThemeChoice(): ThemeChoice {
  return "system";
}

/** Sets a choice on `<html>`: its theme, and the note the theme's icon reads. */
function setRootTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  root.setAttribute(THEME_CHOICE_ATTRIBUTE, choice);
}

/**
 * Sets the stored choice on `<html>` where the head script has not, and tells every word. A
 * page React draws in the browser, as Lantern's page for no day can be, writes the head
 * script as React writes any script it draws, which the browser never runs. A page the
 * script ran on carries the choice's note already, and is left as it is.
 */
export function restoreThemeChoice(): void {
  if (document.documentElement.hasAttribute(THEME_CHOICE_ATTRIBUTE)) return;
  let choice: ThemeChoice = "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isChosenTheme(stored)) choice = stored;
  } catch {
    // Without storage the page keeps the system's theme, as the head script does.
  }
  setRootTheme(choice);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Sets the theme on the page at once, keeps it for the next visit, and tells every word. */
export function applyThemeChoice(choice: ThemeChoice): void {
  setRootTheme(choice);
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Without storage the choice holds for this page only.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Calls back when the theme changes: from a word on this page, or from another tab, whose
 * stored choice this page then takes too.
 */
export function subscribeThemeChoice(onChange: () => void): () => void {
  const fromStorage = (event: StorageEvent) => {
    // A null key is storage cleared whole, which clears the choice too.
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    setRootTheme(isChosenTheme(event.newValue) ? event.newValue : "system");
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", fromStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", fromStorage);
  };
}
