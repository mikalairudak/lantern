"use client";

import { useState } from "react";
import { routeSourceFor } from "@/features/itinerary/day-route";
import { useDayStream } from "@/features/itinerary/use-day-stream";
import { isWrittenRequest } from "@/lib/days/written/requests";
import { simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { ENDING_PRESETS, PACES } from "./frames";
import { outcomeLine } from "./outcome-lines";
import { PartialDayView } from "./partial-day-view";
import type { StreamDay } from "./stream-days";

const CONTROL_CLASSES =
  "rounded-sm border border-line bg-surface px-3 py-1 text-small text-ink disabled:text-muted";
const NOTE_CLASSES = "text-small text-muted";

const PACE_NAMES = Object.keys(PACES);

/** Where the played day comes from: the simulator in this page, or the app's own route. */
const SOURCES = { page: "The simulator, in this page", route: "The route, POST /api/day" };
type SourceKey = keyof typeof SOURCES;
const SOURCE_KEYS = Object.keys(SOURCES) as SourceKey[];

interface StreamPlayerProps {
  streamDay: StreamDay;
  /** Where an ending that falls mid-stream happens: the frame scrubbed to above. */
  at: number;
}

/** Plays the day through the app's own stream hook, as the canvas will, at a model's pace. */
export function StreamPlayer({ streamDay, at }: StreamPlayerProps) {
  const stream = useDayStream();
  const [endingIndex, setEndingIndex] = useState(0);
  const [paceName, setPaceName] = useState(PACE_NAMES[0] ?? "");
  const [sourceKey, setSourceKey] = useState<SourceKey>("page");
  const preset = ENDING_PRESETS[endingIndex] ?? ENDING_PRESETS[0];
  // Only a written day goes to the route, which streams it from its file. Any other would ask
  // a model where live generation is on, and spend (`docs/security.md`, S8).
  const isRoutable = isWrittenRequest(streamDay.request);
  const source: SourceKey = isRoutable ? sourceKey : "page";
  const isFromRoute = source === "route";

  const play = () => {
    if (isFromRoute) {
      stream.play(routeSourceFor(streamDay.request));
      return;
    }
    if (!preset) return;
    const ending = preset.ending(at);
    const pace = PACES[paceName];
    stream.play({
      request: streamDay.request,
      open: (signal) => simulateDayStream({ day: streamDay.day, ending, pace, signal }),
    });
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Play the stream">
      <h2 className="type-name text-quote">Play it through the hook</h2>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className={NOTE_CLASSES}>Source</span>
          <select
            className={CONTROL_CLASSES}
            value={source}
            onChange={(event) => setSourceKey(event.target.value as SourceKey)}
          >
            {SOURCE_KEYS.map((key) => (
              <option key={key} value={key} disabled={key === "route" && !isRoutable}>
                {SOURCES[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={NOTE_CLASSES}>Ending</span>
          <select
            className={CONTROL_CLASSES}
            disabled={isFromRoute}
            value={endingIndex}
            onChange={(event) => setEndingIndex(Number(event.target.value))}
          >
            {ENDING_PRESETS.map(({ label, isPositioned }, index) => (
              <option key={label} value={index}>
                {isPositioned ? `${label} (character ${at})` : label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={NOTE_CLASSES}>Pace</span>
          <select
            className={CONTROL_CLASSES}
            disabled={isFromRoute}
            value={paceName}
            onChange={(event) => setPaceName(event.target.value)}
          >
            {PACE_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={CONTROL_CLASSES} onClick={play}>
          Play
        </button>
        <button
          type="button"
          className={CONTROL_CLASSES}
          disabled={!stream.isStreaming}
          onClick={stream.stop}
        >
          Stop
        </button>
      </div>
      {isFromRoute && (
        <p className={NOTE_CLASSES}>
          The route always finishes, at the pace of the landing. It plays the written days alone:
          any other would ask a model, so the lab never sends one.
        </p>
      )}

      <p className="text-small text-ink" aria-live="polite" data-testid="played-outcome">
        {stream.outcome
          ? outcomeLine(stream.outcome)
          : stream.isStreaming
            ? "Streaming…"
            : "Play the day to watch it arrive."}
      </p>
      {stream.partial && (
        <div className="rounded-md border border-line" data-testid="played-day">
          <PartialDayView partial={stream.partial} />
        </div>
      )}
    </section>
  );
}
