"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Masthead } from "@/features/day/masthead";
import type { CellWidth } from "@/lib/lab-matrix";
import type { ThemeLook } from "./theme";
import { ThemeButton } from "./theme-choice";

/** A state of the theme's button the lab draws still. */
export type ThemeButtonState = "rest" | "pointed" | "focused";

export interface ThemeButtonCellProps {
  state: ThemeButtonState;
}

interface ThemeButtonCellAtProps extends ThemeButtonCellProps {
  width: CellWidth;
}

/** A cell's press changes nothing: the lab's page keeps its own theme. */
const pressNothing = (): ThemeLook => "light";

/**
 * The theme's button in the masthead, as the start screen sets it, in the look of the cell it
 * stands in: a moon in a light cell, a sun in a dark one, since the page's `<html>` notes only
 * its own. The cell's theme is read once it is drawn, so its first frame shows nothing in the
 * button's place.
 */
export function ThemeButtonCell({ state, width }: ThemeButtonCellAtProps) {
  const cell = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState<ThemeLook | null>(null);
  useLayoutEffect(() => {
    const theme = cell.current?.closest("[data-theme]")?.getAttribute("data-theme");
    setLook(theme === "dark" ? "dark" : "light");
  }, []);
  return (
    // Room under the masthead for the helper, which hangs below its row. A phone cell holds
    // the page's gutters already.
    <div ref={cell} className="px-6 pt-6 pb-12 @max-chart:px-0">
      <Masthead
        isHome
        theme={
          look && (
            <ThemeButton
              onPress={pressNothing}
              drawnLook={look}
              isPointedDrawn={state === "pointed"}
              isFocusDrawn={state === "focused"}
              isHelperDrawn={state !== "rest"}
              isPhoneDrawn={width === "phone"}
            />
          )
        }
      />
    </div>
  );
}
