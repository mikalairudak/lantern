"use client";

import { MotionConfig } from "motion/react";
import { useMemo } from "react";
import { cn } from "@/components/ui/cn";
import { SPRINGS } from "@/lib/tokens/motion";
import { PLAN_ROW_EXAMPLES } from "./plan-row-examples";
import { ReadingList } from "./reading-list";

/**
 * A 320 px phone inside the cell: the intro's 20 rem with the page's 16 px gutters inside it,
 * so the list has 288 px and a stop's words 208 px, as on that phone.
 */
const NARROW_CLASSES = "max-w-intro px-4";

/** One row of the plan, as the lab's matrix shows it. */
export function PlanRowCell({ example }: { example: number }) {
  const { still, isNarrow = false } = PLAN_ROW_EXAMPLES[example] ?? PLAN_ROW_EXAMPLES[0]!;
  const { stop, daylight } = useMemo(() => still(), [still]);
  const own = useMemo(() => new Set([stop.id]), [stop.id]);
  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      <div className={cn(isNarrow && NARROW_CLASSES)}>
        <ReadingList
          stops={[stop]}
          entered={1}
          versionsShown={own}
          picks={[0]}
          daylight={daylight}
        />
      </div>
    </MotionConfig>
  );
}
