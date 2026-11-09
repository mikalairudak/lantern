"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { LINK_CLASSES } from "@/features/day/link-classes";
import type { ThemeChoice } from "./theme";
import { ThemeWord } from "./theme-choice";

export interface ThemeWordCellProps {
  choice: ThemeChoice;
  isOpen: boolean;
  /** The hint under the icon, as the pointer or the keyboard's focus shows it. */
  isHintShown: boolean;
}

const ignore = () => undefined;

/**
 * The theme's icon where the masthead sets it, at the line's end, with an action in words
 * before it as a day's masthead has, closed, hinted or open. Its icon and hint are drawn
 * from the cell's choice, since the page notes only its own on `<html>`. An open list opens
 * a frame after the cell is drawn, as a press opens it, so the server's page and the first
 * client frame agree; drawn open rather than opened, it takes no focus.
 */
export function ThemeWordCell({ choice, isOpen, isHintShown }: ThemeWordCellProps) {
  const [isDrawn, setIsDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    // Open, the list hangs below the icon and towards the line's start, so the cell makes
    // room under it. A phone cell holds the page's gutters already, so the icon ends the line
    // at the phone's gutter there.
    <div className={cn("flex justify-end px-6 pt-6 @max-chart:px-0", isOpen ? "pb-day" : "pb-12")}>
      <span className="flex items-center gap-3 whitespace-nowrap">
        <span className={cn(LINK_CLASSES, "type-note text-ink")}>Plan another day</span>
        <ThemeWord
          choice={choice}
          onChoose={ignore}
          isDrawnOpen={isOpen && isDrawn}
          isChoiceDrawn
          isHintDrawn={isHintShown}
        />
      </span>
    </div>
  );
}
