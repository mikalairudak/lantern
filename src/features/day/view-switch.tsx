"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";
import { InlineScript } from "@/components/ui/inline-script";
import { useFirstImpression } from "./first-impression";
import { TARGET_CLASSES } from "./link-classes";
import {
  dayViewScriptOf,
  applyDayView,
  readDayView,
  restoreDayView,
  serverDayView,
  subscribeDayView,
  type DayView,
} from "./view-choice";

/**
 * The visitor's view on `<html>` before the first paint: the head script, as the page's HTML
 * is parsed, and once React has drawn the page, the same choice wherever the script did not
 * run, as the theme's does.
 */
export function DayViewScript({ isPlanFirst = false }: { isPlanFirst?: boolean }) {
  useLayoutEffect(() => restoreDayView(isPlanFirst), [isPlanFirst]);
  return <InlineScript html={dayViewScriptOf(isPlanFirst)} />;
}

/**
 * Underlined as Lantern's actions are, a target 24 px tall: the view to go to; the one on
 * show in ink, without the underline, since pressing it does nothing.
 */
const SWITCH_CLASSES = cn(
  TARGET_CLASSES,
  "rounded-sm text-muted underline decoration-1 underline-offset-4 transition-colors hover:text-ink focus-ring",
);

const VIEWS: readonly { view: DayView; label: string }[] = [
  { view: "chart", label: "Chart" },
  { view: "read", label: "Read" },
];

/**
 * Under the first impression the list is the day's plan and comes first: "Plan · Chart". The
 * stored values stay `read` and `chart`, as the events name them.
 */
const PLAN_FIRST_VIEWS: readonly { view: DayView; label: string }[] = [
  { view: "read", label: "Plan" },
  { view: "chart", label: "Chart" },
];

/**
 * Chart or Read, where the chart's scale stands: the view on show in ink, the other underlined.
 * The styles say which is on show from `<html>`'s note, so the switch reads right from the
 * first paint, before the page has run.
 */
export function DayViewSwitch({ className }: { className?: string }) {
  const view = useSyncExternalStore(subscribeDayView, readDayView, serverDayView);
  const views = useFirstImpression() ? PLAN_FIRST_VIEWS : VIEWS;
  return (
    <div
      role="group"
      aria-label="View"
      // Without the page's script nothing could change the view: the switch is left out.
      className={cn("flex justify-end gap-4 type-note view-unset:hidden", className)}
    >
      {views.map((option) => (
        <button
          key={option.view}
          type="button"
          aria-pressed={view === option.view}
          onClick={() => applyDayView(option.view)}
          className={cn(
            SWITCH_CLASSES,
            option.view === "chart"
              ? "view-chart:text-ink view-chart:no-underline"
              : "view-read:text-ink view-read:no-underline",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
