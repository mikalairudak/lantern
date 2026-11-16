"use client";

import { MotionConfig } from "motion/react";
import { useLayoutEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { SPRINGS } from "@/lib/tokens/motion";
import type { CellWidth } from "@/lib/lab-matrix";
import { PartSlip, SLIP_ATTRIBUTE, type SlipPlacement } from "./part-slip";
import { slipStillOf, type SlipExample, type SlipMoment } from "./part-slip-examples";
import { ReadingList } from "./reading-list";

export interface PartSlipCellProps {
  example: SlipExample;
  moment: SlipMoment;
  placement: SlipPlacement;
}

const ignore = () => undefined;

/**
 * A part's slip at the head of its part, between the row the day keeps before it and the part's
 * first row, as the lab's matrix shows it. A phone has no margin, so a phone cell sets the slip
 * in the column whichever placement it is given. In the margin the slip stands out of flow, so
 * the cell holds the slip's height under it, as a part's rows do on the page.
 */
export function PartSlipCell({
  example,
  moment,
  placement,
  width,
}: PartSlipCellProps & { width: CellWidth }) {
  const { view, shown, other } = slipStillOf(example, moment);
  const { fork, daylight } = example;
  const shownPlacement = width === "phone" ? "column" : placement;
  const first = shown[0];
  // The stop the day keeps before the part, then the part's first row: the plan's clock runs on
  // into the part, so a row past midnight is the night's.
  const rows = [example.lead, first].filter((stop) => stop != null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const roomHeight = useMarginRoom(box, shownPlacement === "margin");
  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      {/* The plan's column on a laptop, in either placement; positioned, so the plan's
          unseen words stand inside the cell. */}
      <div ref={setBox} className={cn("relative", width === "wide" && "w-abacus")}>
        <div style={{ minHeight: roomHeight }}>
          <ReadingList
            stops={rows}
            entered={rows.length}
            versionsShown={new Set(rows.map(({ id }) => id))}
            picks={rows.map(() => 0)}
            daylight={daylight}
            // The part's first row stands for the part, not the day's end: no sun trails it.
            isWritten={false}
            parts={{
              anchors: [first?.id ?? null],
              isBeside: shownPlacement === "margin",
              headOf: () => (
                <PartSlip
                  view={view}
                  shown={shown}
                  other={other}
                  opens={example.opens}
                  index={fork.index}
                  count={fork.count}
                  reach={fork.reach}
                  placement={shownPlacement}
                  onChoose={ignore}
                  onAskAgain={ignore}
                />
              ),
            }}
          />
        </div>
      </div>
    </MotionConfig>
  );
}

/**
 * The height a slip in the margin reaches below the cell's top, which the cell holds, since a
 * slip out of flow takes no room of its own. None in the column.
 */
function useMarginRoom(box: HTMLDivElement | null, isMargin: boolean): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const slip = box?.querySelector<HTMLElement>(`[${SLIP_ATTRIBUTE}]`);
    if (!isMargin || !box || !slip) return undefined;
    const measure = () =>
      setHeight(slip.getBoundingClientRect().bottom - box.getBoundingClientRect().top);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slip);
    return () => observer.disconnect();
  }, [box, isMargin]);
  return isMargin ? height : 0;
}
