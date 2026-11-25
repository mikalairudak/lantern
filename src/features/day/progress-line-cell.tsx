"use client";

import { ProgressLine } from "./foot-line";
import { progressWordsOf, type DayProgress } from "./progress";

export interface ProgressLineCellProps {
  progress: DayProgress;
  /** A written day the page holds whole is playing: the line offers it whole. */
  isPressOffered: boolean;
}

const ignore = () => undefined;

/** The line under a day's chart at one moment of the day's writing, as the day stage draws it. */
export function ProgressLineCell({ progress, isPressOffered }: ProgressLineCellProps) {
  const words = progressWordsOf(progress);
  if (!isPressOffered) return words === null ? null : <ProgressLine>{words}</ProgressLine>;
  return <ProgressLine onShowWhole={ignore}>{words}</ProgressLine>;
}
