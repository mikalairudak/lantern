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

/**
 * Marks `<html>` while script sets the theme, so that no colour eases to the new theme on its
 * own (`globals.css`): an element whose colours ease under a pointer would otherwise arrive
 * 160 ms after the rest of the page, behind the theme's crossing.
 */
const STILL_ATTRIBUTE = "data-theme-still";

/**
 * The choice set or chosen last, which a crossing still waiting to set its theme sets in its
 * place, so the last choice always stands.
 */
let lastChoice: ThemeChoice = "system";

/** Sets a choice on `<html>`: its theme, and the note the theme's icon reads. */
function setRootTheme(choice: ThemeChoice): void {
  lastChoice = choice;
  const root = document.documentElement;
  root.setAttribute(STILL_ATTRIBUTE, "");
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  root.setAttribute(THEME_CHOICE_ATTRIBUTE, choice);
  // Read once, the page's style is worked out in the new theme while the mark holds every
  // colour still, so each takes its new value at once and none eases once the mark is gone.
  void root.offsetWidth;
  root.removeAttribute(STILL_ATTRIBUTE);
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

/** The theme a choice shows: the system's is the device's. */
function shownThemeOf(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return matchesMedia("(prefers-color-scheme: dark)") ? "dark" : "light";
}

function matchesMedia(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/** Whether the page can cross from one theme to the other: never under reduced motion. */
function canCross(): boolean {
  return (
    typeof document.startViewTransition === "function" &&
    !matchesMedia("(prefers-reduced-motion: reduce)")
  );
}

function showLastChoice(): void {
  setRootTheme(lastChoice);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Sets a choice on the page, keeps it for the next visit, and tells every word. Where the
 * choice changes what the page looks like, the page crosses to it: the browser's view
 * transition of the root fades the last frame in the old theme into the live page in the new
 * (`--duration-theme`, linear, in `globals.css`), and the page takes no press meanwhile. A
 * choice that changes no colour, reduced motion and a browser without view transitions set it
 * at once (`docs/decisions.md`, "The theme crosses as one cross-fade of the whole page").
 */
export function applyThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Without storage the choice holds for this page only.
  }
  const isSeen = shownThemeOf(choice) !== shownThemeOf(readThemeChoice());
  lastChoice = choice;
  if (isSeen && canCross()) document.startViewTransition(showLastChoice);
  else showLastChoice();
}

/**
 * Calls back when the theme changes: from a word on this page, or from another tab, whose
 * stored choice this page then takes too, at once.
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
