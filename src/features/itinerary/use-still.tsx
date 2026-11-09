"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A lab cell's still, worked out from frames of a day's stream: not read yet, read, or
 * failed to read, with why.
 */
export type StillReading<Still> =
  { status: "reading" } | { status: "read"; still: Still } | { status: "failed"; reason: string };

/** What a cell says while it reads its still. */
export const READING_NOTE = "Reading the day…";
/** What a cell says when its still fails to read, before why. */
export const FAILED_NOTE = "The day's frames could not be read:";

const READING: StillReading<never> = { status: "reading" };

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads a cell's still in an effect. The promise comes from its example module's cache, so
 * every render passes the same one and it is read once; a cell given another reads again
 * and never shows the last one's still. A still that fails to read says so.
 */
export function useStill<Still>(still: Promise<Still>): StillReading<Still> {
  const [settled, setSettled] = useState<{
    still: Promise<Still>;
    reading: StillReading<Still>;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const settle = (reading: StillReading<Still>) => {
      if (isCurrent) setSettled({ still, reading });
    };
    still.then(
      (read) => settle({ status: "read", still: read }),
      (error: unknown) => settle({ status: "failed", reason: reasonOf(error) }),
    );
    return () => {
      isCurrent = false;
    };
  }, [still]);

  return settled?.still === still ? settled.reading : READING;
}

/** What a cell says in place of its component, in the lab's muted small text. */
export function CellNote({ children }: { children: ReactNode }) {
  return <p className="p-4 text-small text-muted">{children}</p>;
}

/** A still that has not been read: being read, or failed. */
type Unread = Exclude<StillReading<unknown>, { status: "read" }>;

/** What a cell says while its still is read, or once it has failed to be. */
export function StillNote({ reading }: { reading: Unread }) {
  return (
    <CellNote>
      {reading.status === "failed" ? `${FAILED_NOTE} ${reading.reason}` : READING_NOTE}
    </CellNote>
  );
}
