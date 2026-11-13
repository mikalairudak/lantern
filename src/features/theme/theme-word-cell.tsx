"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Masthead } from "@/features/day/masthead";
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
 * The theme's icon in the masthead, as the start screen sets it, closed, hinted or open: its
 * list hangs from the foot of the masthead's row. Its icon and hint are drawn from the cell's
 * choice, since the page notes only its own on `<html>`. An open list opens a frame after the
 * cell is drawn, as a press opens it, so the server's page and the first client frame agree;
 * drawn open rather than opened, it takes no focus.
 */
export function ThemeWordCell({ choice, isOpen, isHintShown }: ThemeWordCellProps) {
  const [isDrawn, setIsDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    // Open, the list hangs below the masthead, so the cell makes room under it. A phone cell
    // holds the page's gutters already.
    <div className={cn("px-6 pt-6 @max-chart:px-0", isOpen ? "pb-day" : "pb-12")}>
      <Masthead
        isHome
        theme={
          <ThemeWord
            choice={choice}
            onChoose={ignore}
            isDrawnOpen={isOpen && isDrawn}
            isChoiceDrawn
            isHintDrawn={isHintShown}
          />
        }
      />
    </div>
  );
}
