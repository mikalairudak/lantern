"use client";

import { createContext, useContext } from "react";

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
