"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { todayIn } from "@/lib/normalizer/normalize-intake";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";
import type { YourDay } from "./your-days";
import { YourDaysLedger, type YourDaysLedgerProps } from "./your-days-ledger";

/** The lab's control under the cell, apart from the block it plays. */
const CONTROL_CLASSES = cn("mt-6 type-note text-muted", LINK_CLASSES, TARGET_CLASSES);

/**
 * The newest day as the product writes it from now: asked now, for its own date or today where
 * that date has passed, as a request for a past day is planned for today; and, once written,
 * ended as it ended unless that was only being written, which ends written.
 */
export function playedDayOf(newest: YourDay, now: Date, isWritten: boolean): YourDay {
  const today = todayIn(newest.request.timezone, now);
  return {
    ...newest,
    request: { ...newest.request, date: newest.request.date < today ? today : newest.request.date },
    startedAt: now.toISOString(),
    ending: !isWritten ? "writing" : newest.ending === "writing" ? "written" : newest.ending,
  };
}

/**
 * The ledger with its newest day played from being written to how it ends at a press, so the
 * lab shows that neither its row nor anything under it moves as "writing" turns to its date.
 */
export function LedgerPlayCell(props: YourDaysLedgerProps) {
  const [isWritten, setIsWritten] = useState(false);
  const [newest, ...rest] = props.days;
  if (!newest) return null;
  const played = playedDayOf(newest, props.now ?? new Date(), isWritten);
  return (
    <div>
      <YourDaysLedger {...props} days={[played, ...rest]} />
      <button type="button" onClick={() => setIsWritten(!isWritten)} className={CONTROL_CLASSES}>
        {isWritten ? "Write the newest again" : "Finish writing the newest"}
      </button>
    </div>
  );
}
