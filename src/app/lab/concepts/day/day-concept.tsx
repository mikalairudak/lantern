"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Day, type DayHandle } from "@/features/day/day";
import type { WrittenDay } from "@/lib/days/written/written-day";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { NEVER_QUIET_DAY } from "@/lib/fixtures/edge/edge-days";
import { WRITTEN_DAYS } from "@/lib/days/written/days";
import { PACES, type Pace } from "../../stream/frames";
import { THEME_CHOICES, type ThemeChoice } from "@/features/theme/theme";
import { BENCH_ENDINGS, BENCH_PACE, benchSourceFor, type BenchEnding } from "./endings";
import type { ReplanControls } from "@/features/day/replan-controls";

const PACE_NAMES = Object.keys(PACES);

/**
 * The days the bench plays: the ones written by hand, Kyoto first, which the bench's design
 * notes were measured on; a live day's shape none of them has, a lively day that never goes
 * quiet, its quietest lane empty and its twins at one energy; and the days the site serves,
 * the starts', whose endings are a written day's.
 */
const BENCH_DAYS: readonly WrittenDay[] = [...CURATED_DAYS, NEVER_QUIET_DAY, ...WRITTEN_DAYS];

/**
 * The composition page: the product's day, which `/day/<city>` renders too, header over
 * chart, with the lab's chrome beside it. Its first play ends in any of the ways a stream
 * can end, at the pace chosen; Replay plays it again, and anything the day itself plays
 * comes from the route, as on `/day`.
 */
export function DayConcept() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [curated, setCurated] = useState<WrittenDay>(firstOf(BENCH_DAYS));
  const [ending, setEnding] = useState<BenchEnding>(firstOf(BENCH_ENDINGS));
  const [paceName, setPaceName] = useState(BENCH_PACE);
  const [isLive, setIsLive] = useState(false);
  const [replays, setReplays] = useState(0);
  const [isChoosing, setIsChoosing] = useState(false);
  // A changed word's fork, its versions taken or compared from here as its rows do
  // (`ReplanControls`).
  const day = useRef<DayHandle>(null);
  const sourceFor = useMemo(
    () => benchSourceFor(curated, ending, paceNamed(paceName), isLive),
    [curated, ending, paceName, isLive],
  );

  return (
    <div
      data-theme={theme === "system" ? undefined : theme}
      className="min-h-dvh bg-ground text-ink"
    >
      {/* A new day or ending remounts the day, so its first play ends as chosen; a pace
          changes the next play, never the one on screen. */}
      <Day
        key={`${curated.request.city}:${ending.key}:${isLive}:${replays}`}
        first={curated.request}
        sourceFor={sourceFor}
        isLive={isLive}
        ref={day}
      />
      <aside
        aria-label="Lab controls"
        // One strip: the ending opens on demand, so the controls never sit over the chart
        // on a phone. Its panel comes after the toggle, so Tab goes on into it, and is drawn
        // above the strip.
        className="fixed right-4 bottom-4 z-20 flex max-w-intro flex-col gap-2 rounded-md border border-line bg-surface p-1"
      >
        <div className="flex items-center gap-2">
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
          <span aria-hidden className="h-4 border-l border-line" />
          <button
            type="button"
            onClick={() => setReplays((count) => count + 1)}
            className={cn(CONTROL_CLASSES, "text-energy hover:text-ink")}
          >
            Replay
          </button>
          <button
            type="button"
            aria-expanded={isChoosing}
            aria-controls="lab-ending"
            onClick={() => setIsChoosing((open) => !open)}
            className={cn(
              CONTROL_CLASSES,
              isChoosing ? "bg-ground text-ink" : "text-muted hover:text-ink",
            )}
          >
            Ending
          </button>
        </div>
        {isChoosing && (
          <div id="lab-ending" className="order-first flex flex-col gap-3 px-1 pt-1">
            <BenchChoice label="Day">
              <select
                className={SELECT_CLASSES}
                value={curated.request.city}
                onChange={(event) =>
                  setCurated(
                    BENCH_DAYS.find((each) => each.request.city === event.target.value) ?? curated,
                  )
                }
              >
                {BENCH_DAYS.map(({ request }) => (
                  <option key={request.city} value={request.city}>
                    {request.city}
                  </option>
                ))}
              </select>
            </BenchChoice>
            <BenchChoice label="Ending">
              <select
                className={SELECT_CLASSES}
                value={ending.key}
                onChange={(event) =>
                  setEnding(BENCH_ENDINGS.find((each) => each.key === event.target.value) ?? ending)
                }
              >
                {BENCH_ENDINGS.map(({ key, label, outcome }) => (
                  <option key={key} value={key}>
                    {`${label} · ${outcome}`}
                  </option>
                ))}
              </select>
            </BenchChoice>
            <BenchChoice label="Pace">
              <select
                className={SELECT_CLASSES}
                value={paceName}
                onChange={(event) => setPaceName(event.target.value)}
              >
                {PACE_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </BenchChoice>
            <BenchChoice label="Re-plans">
              <select
                className={SELECT_CLASSES}
                value={isLive ? "live" : "written"}
                onChange={(event) => setIsLive(event.target.value === "live")}
              >
                <option value="written">Before launch: say what would change</option>
                <option value="live">Live: ask the route</option>
              </select>
            </BenchChoice>
            <div role="group" aria-label="The word changed" className="-ml-1 flex">
              {CHANGE_CONTROLS.map(({ name, act }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    const controls = day.current?.replan();
                    if (controls) act(controls);
                  }}
                  className={cn(CONTROL_CLASSES, "text-muted hover:text-ink")}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/** What the bench can do with a word changed on the day, as its fork rows do. */
const CHANGE_CONTROLS: readonly { name: string; act: (controls: ReplanControls) => void }[] = [
  { name: "take", act: (controls) => controls.choose("to") },
  { name: "take back", act: (controls) => controls.choose("from") },
  { name: "compare", act: (controls) => controls.compare() },
];

const CONTROL_CLASSES =
  "rounded-sm px-2 py-1 text-caption tracking-caps uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";
const SELECT_CLASSES =
  "w-full rounded-sm border border-line bg-surface px-2 py-1 text-small text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";

interface BenchChoiceProps {
  label: string;
  children: ReactNode;
}

/** One of the bench's choices: its name in the strip's caps, over its select. */
function BenchChoice({ label, children }: BenchChoiceProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption tracking-caps text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

function paceNamed(name: string): Pace {
  const pace = PACES[name];
  if (!pace) throw new Error(`The lab has no pace named "${name}"`);
  return pace;
}

function firstOf<T>(items: readonly T[]): T {
  const first = items[0];
  if (first === undefined) throw new Error("The bench has nothing to choose from");
  return first;
}
