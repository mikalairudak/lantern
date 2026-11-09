"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { SPRINGS } from "@/lib/tokens/motion";
import type { ThemeChoice } from "@/features/theme/theme";
import { AbacusControls, type NextChangeChoice, type StreamChoice } from "./abacus-controls";
import { AbacusDay, type DayHandle } from "./abacus-day";
import { offsetsOf, phrasingOf } from "./pacing";
import { arrivalBoundaries } from "./playback";
import { realisticStreamOf } from "./realistic-stream";
import { generatedDayOf } from "./stream";
import { useElementSize } from "@/components/ui/use-element-size";

interface AbacusConceptProps {
  itinerary: Itinerary;
  weather: string;
  /** The chart spans the stops alone; see `AbacusDay`. */
  isFramedByStops?: boolean;
  /** Starts with the whole day written; tests use it to skip the replay. */
  isInitiallyComplete?: boolean;
}

/**
 * The abacus concept: the request, the day as a chart of its candidates, and the list.
 * The day writes itself in on load; Replay starts it again from the empty frame.
 */
export function AbacusConcept({
  itinerary,
  weather,
  isFramedByStops = false,
  isInitiallyComplete = false,
}: AbacusConceptProps) {
  const isReducedMotion = useReducedMotion();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [runId, setRunId] = useState(0);
  const [isDayInteractive, setIsDayInteractive] = useState(isInitiallyComplete);
  const [chartBox, setChartBox] = useState<HTMLDivElement | null>(null);
  // Measured outside the run, so Replay keeps the chart's frame on screen.
  const chartSize = useElementSize(chartBox);
  const day = useRef<DayHandle>(null);
  const [stream, setStream] = useState<StreamChoice>("replay");
  const [nextChange, setNextChange] = useState<NextChangeChoice>("ok");
  const generated = useMemo(() => generatedDayOf(itinerary), [itinerary]);
  const phrased = useMemo(() => phrasingOf(generated), [generated]);
  const realistic = useMemo(() => realisticStreamOf(generated), [generated]);
  const live = useMemo(
    () => ({ boundaries: arrivalBoundaries(offsetsOf(generated)) }),
    [generated],
  );

  const replay = () => {
    setIsDayInteractive(false);
    setRunId((run) => run + 1);
  };

  const changeStream = (next: StreamChoice) => {
    setStream(next);
    replay();
  };

  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      <div
        data-theme={theme === "system" ? undefined : theme}
        className="min-h-dvh bg-ground text-ink"
      >
        <AbacusDay
          // A new run remounts the day, so it starts again from the empty frame.
          key={runId}
          ref={day}
          itinerary={itinerary}
          weather={weather}
          isFramedByStops={isFramedByStops}
          generated={generated}
          keyframes={stream === "realistic" ? realistic : phrased}
          live={stream === "realistic" ? live : undefined}
          // The first run matches the server render; with reduced motion a replay shows
          // the finished day at once, while a live stream still arrives as it is written.
          startsComplete={
            runId === 0 ? isInitiallyComplete : Boolean(isReducedMotion) && stream === "replay"
          }
          // A replay has no real silences; a live stream shows the day's voice in its own.
          isWaitingShown={stream === "realistic"}
          isNextFailing={nextChange === "fail"}
          // "Next" means once: the retry that follows a failure goes through.
          onFailingUsed={() => setNextChange("ok")}
          chartSize={chartSize}
          chartRef={setChartBox}
          onInteractiveChange={setIsDayInteractive}
        />
        <AbacusControls
          stream={stream}
          onStreamChange={changeStream}
          nextChange={nextChange}
          onNextChangeChange={setNextChange}
          theme={theme}
          onThemeChange={setTheme}
          isResetEnabled={isDayInteractive}
          onReset={() => day.current?.reset()}
          onReplay={replay}
        />
      </div>
    </MotionConfig>
  );
}
