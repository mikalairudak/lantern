"use client";

import { useEffect, useState } from "react";
import { readDayStream } from "@/lib/stream/read-day-stream";
import { simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { ENDING_PRESETS, framesOf, type EndingPreset, type Frame } from "./frames";
import { outcomeLine } from "./outcome-lines";
import { PartialDayView } from "./partial-day-view";
import { STREAM_DAYS } from "./stream-days";
import { StreamPlayer } from "./stream-player";

const CONTROL_CLASSES = "rounded-sm border border-line bg-surface px-3 py-1 text-small text-ink";
const NOTE_CLASSES = "text-small text-muted";

interface Ended {
  label: string;
  line: string;
}

/**
 * Scrubs a fixture day's stream one token-sized delta at a time, and ends it at the
 * scrubbed frame in any way the outcome protocol knows. Each ending is played through the
 * harness's simulator and stream reader, as the live route will be.
 */
export function StreamScrubber() {
  const [dayIndex, setDayIndex] = useState(0);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [ended, setEnded] = useState<Ended | null>(null);
  const streamDay = STREAM_DAYS[dayIndex] ?? STREAM_DAYS[0];

  useEffect(() => {
    if (!streamDay) return undefined;
    let isCurrent = true;
    void framesOf(streamDay.day).then((read) => {
      if (isCurrent) setFrames(read);
    });
    return () => {
      isCurrent = false;
    };
  }, [streamDay]);

  const frame = frames?.[frameIndex];

  const end = async (preset: EndingPreset) => {
    if (!streamDay || !frame) return;
    const outcome = await readDayStream({
      request: streamDay.request,
      response: simulateDayStream({ day: streamDay.day, ending: preset.ending(frame.at) }),
      onPartial: () => undefined,
    });
    const where = preset.isPositioned ? ` at character ${frame.at}` : "";
    setEnded({ label: `${preset.label}${where}`, line: outcomeLine(outcome) });
  };

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1">
        <span className={NOTE_CLASSES}>Day</span>
        <select
          className={CONTROL_CLASSES}
          value={dayIndex}
          onChange={(event) => {
            setDayIndex(Number(event.target.value));
            setFrames(null);
            setFrameIndex(0);
            setEnded(null);
          }}
        >
          {STREAM_DAYS.map(({ label }, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {frames === null || !frame || !streamDay ? (
        <p className={NOTE_CLASSES}>Reading the day…</p>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className={NOTE_CLASSES}>
              {`Frame ${frameIndex + 1} of ${frames.length}, after ${frame.at} characters`}
            </span>
            <input
              type="range"
              className="w-full accent-ink"
              min={0}
              max={frames.length - 1}
              value={frameIndex}
              aria-label="Frame"
              onChange={(event) => {
                setFrameIndex(Number(event.target.value));
                setEnded(null);
              }}
            />
          </label>

          <div className="flex flex-wrap gap-2" role="group" aria-label="End the stream">
            {ENDING_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={CONTROL_CLASSES}
                onClick={() => void end(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="text-small text-ink" aria-live="polite" data-testid="outcome">
            {ended ? `${ended.label} → ${ended.line}` : "End the stream to see its outcome."}
          </p>

          <div className="rounded-sm border border-line">
            <PartialDayView partial={frame.partial} />
          </div>

          {/* Keyed by the day, so choosing another stops the one playing. */}
          <StreamPlayer key={dayIndex} streamDay={streamDay} at={frame.at} />
        </>
      )}
    </div>
  );
}
