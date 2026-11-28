"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/** Sets what the page's notice status says, "" for nothing. */
export type SayNotice = (line: string) => void;

/**
 * How long the status holds a line before it falls quiet: long enough for a screen reader to
 * finish what it says of the focus moved with it and come to the line, short enough that a
 * read-through after it meets the line once, on screen (`docs/decisions.md`, "How a day ended is
 * said from one status that stands before the ending").
 */
export const NOTICE_HEARD_MS = 3000;

/**
 * How long a status put on the page with nothing in it stands empty before its first words, where
 * those words could otherwise come at once: a status is said reliably only once it stood in the
 * page before its words came (W3C technique ARIA22). A re-plan the route refuses at once fails in
 * the frame after the press that put the fork's status on the page, and a day drawn whole in place
 * of the run that heard its wait says it is written from a status drawn with it.
 */
export const STATUS_STANDS_MS = 500;

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/**
 * Whether the page is on screen now: "visible" alone, so a page drawn before its visit, which
 * some browsers call "prerender", is not seen either.
 */
export function isPageSeen(): boolean {
  return document.visibilityState === "visible";
}

function isPageSeenOnServer(): boolean {
  return true;
}

/**
 * Whether the page is seen. A line held for `NOTICE_HEARD_MS` is written into its status only
 * while it is, and its hold runs only then, so a line that comes behind another tab waits,
 * empty, and is said and held from the moment the page is seen again; one gone before then is
 * never written (`docs/decisions.md`, "How a day ended is said from one status that stands
 * before the ending"). The visitor's own change (`useChangeHeard`) is held as long and is not
 * gated, since it answers an act on a page that is seen. The server and the first paint take the
 * page as seen.
 */
export function usePageSeen(): boolean {
  return useSyncExternalStore(subscribeVisibility, isPageSeen, isPageSeenOnServer);
}

/**
 * Whoever renders the page's notice status hands its writer down; null where no one does, or
 * while the day below is out of hearing, so a header says its notice in its own status.
 */
export const NoticeStatusContext = createContext<SayNotice | null>(null);

/** The page's notice status's writer, when one is handed down. */
export function useNoticeStatus(): SayNotice | null {
  return useContext(NoticeStatusContext);
}

interface NoticeStatusProps {
  /** What it says now: "" for nothing. */
  line: string;
}

/**
 * The page's status for how a day ended, or how the wait for one did: rendered before any
 * ending and above every view the page turns between, so an ending's line is a change of its
 * text, which a screen reader hears, rather than a status born holding it.
 */
export function NoticeStatus({ line }: NoticeStatusProps) {
  return (
    <p role="status" className="sr-only" data-notice-status>
      {line}
    </p>
  );
}
