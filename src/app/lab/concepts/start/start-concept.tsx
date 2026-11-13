"use client";

import { useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Day, type WrittenGist } from "@/features/day/day";
import { routeSourceFor } from "@/features/itinerary/day-route";
import type { DaySource } from "@/features/itinerary/use-day-stream";
import { writtenDayFor } from "@/lib/days/written/days";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { THEME_CHOICES, type ThemeChoice } from "@/features/theme/theme";
import { CANNED_READINGS, readInLab } from "./read-in-lab";

/** Texts worth trying, one for each way a reading can go. */
const TRIES = ["Kyoto, with my dog", "Kyoto, Japan", "Paris", ...Object.keys(CANNED_READINGS)];

interface LivePace {
  /** From the visitor's Enter to the intake's answer. */
  intakeMs: number;
  /** From the intake's answer to the day's first bytes. */
  firstBytesMs: number;
}

/**
 * How the days stream: at the landing's pace, or with a live start's waits as production
 * measured them (`docs/harness.md`, "Where a request's seconds go"): the intake's answer,
 * then the day's first bytes about a second later. The model's first words come 1.4 s after
 * those, the uneven pace's own wait, against 1.0 to 1.2 s measured.
 */
const PACES = {
  landing: null,
  warm: { intakeMs: 1600, firstBytesMs: 1000 },
  cold: { intakeMs: 4100, firstBytesMs: 1000 },
} as const satisfies Record<string, LivePace | null>;

type PaceName = keyof typeof PACES;

const PACE_LABELS: Record<PaceName, string> = {
  landing: "Landing",
  warm: "Warm",
  cold: "Cold",
};

/** Waits, unless the visitor leaves first. */
function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((done, fail) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      fail(signal.reason);
    });
  });
}

/**
 * A curated day at a live model's pace, its first bytes after the pace's wait, so the start
 * screen's wait for a day can be seen as it is live. Any other day is answered as the route
 * answers it.
 */
function liveSourceFor(pace: LivePace): (request: DayRequest) => DaySource {
  return (request) => {
    const curated = writtenDayFor(request, new Date());
    if (!curated) return routeSourceFor(request);
    return {
      request,
      open: async (signal) => {
        await waitFor(pace.firstBytesMs, signal);
        return simulateDayStream({
          day: curated.day,
          ending: { kind: "finished" },
          pace: { kind: "uneven" },
          signal,
        });
      },
    };
  };
}

interface StartConceptProps {
  /** The written days, normalized on the server, in the order the start screen offers them. */
  pool: readonly WrittenGist[];
}

/**
 * The start screen concept: the product's start screen, the day written where its question
 * was, with the lab's chrome beside it: a theme, the note before or after launch, a start
 * from the top, and texts to try, with the pace of a live model beside them.
 */
export function StartConcept({ pool }: StartConceptProps) {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [isLive, setIsLive] = useState(false);
  const [visit, setVisit] = useState(0);
  const [isTrying, setIsTrying] = useState(false);
  // The days stream at the landing's pace, or with a live start's waits.
  const [paceName, setPaceName] = useState<PaceName>("landing");
  const pace = PACES[paceName];
  const start = useMemo(() => ({ pool, read: readInLab(pool, pace?.intakeMs) }), [pool, pace]);

  return (
    <div
      data-theme={theme === "system" ? undefined : theme}
      className="min-h-dvh bg-ground text-ink"
    >
      <Day
        key={visit}
        start={start}
        // The lab never asks the route for a live day: "after launch" changes only the page.
        isLive={isLive}
        sourceFor={pace ? liveSourceFor(pace) : (request) => routeSourceFor(request)}
      />
      <aside
        aria-label="Lab controls"
        // One strip, as the day concept's: the texts to try open on demand, so the controls
        // never sit over the chart on a phone.
        className="fixed right-4 bottom-4 z-20 flex max-w-intro flex-col gap-2 rounded-sm border border-line bg-surface p-1"
      >
        {isTrying && (
          <div id="lab-tries" className="order-first flex flex-col items-start gap-2 px-1">
            <ul className="flex flex-col gap-1 type-note text-muted">
              {TRIES.map((text) => (
                <li key={text}>“{text}”</li>
              ))}
            </ul>
            {/* Under the texts, on a line of their own, so the strip below stays one line: a
                day's wait at the landing's pace, or as it is live, warm or cold. */}
            <div role="group" aria-label="Pace" className="-ml-1 flex">
              {(Object.keys(PACES) as PaceName[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={name === paceName}
                  onClick={() => setPaceName(name)}
                  className={cn(
                    CONTROL_CLASSES,
                    name === paceName ? "bg-ground text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {PACE_LABELS[name]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div role="group" aria-label="Theme" className="flex">
            {THEME_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={choice === theme}
                onClick={() => setTheme(choice)}
                className={cn(
                  CONTROL_CLASSES,
                  choice === theme ? "bg-ground text-ink" : "text-muted hover:text-ink",
                )}
              >
                {choice}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={isLive}
            onClick={() => setIsLive((live) => !live)}
            className={cn(
              CONTROL_CLASSES,
              isLive ? "bg-ground text-ink" : "text-muted hover:text-ink",
            )}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => setVisit((count) => count + 1)}
            className={cn(CONTROL_CLASSES, "text-energy hover:text-ink")}
          >
            Again
          </button>
          <button
            type="button"
            aria-expanded={isTrying}
            aria-controls="lab-tries"
            onClick={() => setIsTrying((open) => !open)}
            className={cn(
              CONTROL_CLASSES,
              isTrying ? "bg-ground text-ink" : "text-muted hover:text-ink",
            )}
          >
            Try
          </button>
        </div>
      </aside>
    </div>
  );
}

const CONTROL_CLASSES =
  "rounded-sm px-2 py-1 text-caption tracking-caps uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";
