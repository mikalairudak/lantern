"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { SPRINGS } from "@/lib/tokens/motion";
import { PLAN_ROW_EXAMPLES, planRowStillOf } from "./plan-row-examples";
import { ReadingList } from "./reading-list";

/** How long a taken proposal's cell shows the proposal before it is taken. */
const TAKEN_AFTER_MS = 900;

const NONE: ReadonlySet<string> = new Set();

/** One row of the plan, as the lab's matrix shows it. */
export function PlanRowCell({ example }: { example: number }) {
  const { lights, role, isLatest } = PLAN_ROW_EXAMPLES[example] ?? PLAN_ROW_EXAMPLES[0]!;
  const { stop, daylight } = useMemo(() => planRowStillOf(lights, isLatest), [lights, isLatest]);
  const [isTaken, setIsTaken] = useState(false);
  useEffect(() => {
    if (role !== "taken") return undefined;
    const timer = window.setTimeout(() => setIsTaken(true), TAKEN_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [role]);
  const isProposed = role === "proposed" || (role === "taken" && !isTaken);
  const own = useMemo(() => new Set([stop.id]), [stop.id]);
  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      <ReadingList
        stops={[stop]}
        entered={1}
        versionsShown={isProposed ? NONE : own}
        picks={[0]}
        daylight={daylight}
        proposed={isProposed ? own : NONE}
      />
    </MotionConfig>
  );
}
