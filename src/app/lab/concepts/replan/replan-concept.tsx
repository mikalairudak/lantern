"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { Day } from "@/features/day/day";
import type { DaySource } from "@/features/itinerary/use-day-stream";
import { replanBasisOf, type ReplanAsk } from "@/features/itinerary/replan-route";
import type { ReplanSource } from "@/features/itinerary/use-replan-stream";
import {
  ELCHE_ITINERARY,
  ELCHE_LATE_DINNER,
  ELCHE_LATE_DINNER_UNREPEATED,
  ELCHE_REQUEST,
} from "@/lib/fixtures/replan/elche-dinner";
import { LISBON_LATE_DINNER } from "@/lib/fixtures/replan/lisbon-dinner";
import type { DayRequest, GeneratedDay } from "@/lib/schema/itinerary.schema";
import { keptPlaceNamesOf, type ReplanBasis } from "@/lib/replan/merge";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { generatedDayOf } from "@/lib/normalizer/generated-day";
import { isSameRequest } from "@/lib/days/request";
import { simulateDayStream, type StreamPace } from "@/lib/stream/simulate-day-stream";
import { THEME_CHOICES, type ThemeChoice } from "@/features/theme/theme";

/** A day the bench re-plans: its request, and the day as the model wrote it. */
export interface BenchDay {
  request: DayRequest;
  day: GeneratedDay;
}

/** How fast the bench's day first lands: at once, so the re-plan has a day to rewrite. */
const LANDING_PACE: Partial<StreamPace> = { deltaChars: 64 };

/**
 * The bench's day: landing at once, and written again whole, for a word the bench holds no
 * recording of (company), at the re-plan's pace, so its moments can be watched as a
 * part's are.
 */
const sourceOf =
  ({ request: first, day }: BenchDay, pace: Partial<StreamPace>) =>
  (request: DayRequest): DaySource => ({
    request,
    open: (signal) =>
      simulateDayStream({
        day,
        ending: { kind: "finished" },
        pace: isSameRequest(request, first) ? LANDING_PACE : pace,
        signal,
      }),
  });

/**
 * Production's Elche day, whose dinner rewrites its lunch and its afternoon, two parts of one
 * fork. Its re-plan as the model wrote it, less the coffee the merge would drop, so the
 * proposal stands whole; with the coffee, it fails as production's did.
 */
const ELCHE: BenchDay = { request: ELCHE_REQUEST, day: generatedDayOf(ELCHE_ITINERARY) };

/**
 * Paces a proposal streams at, a part or the whole day written again, as a live one does and
 * slower, to watch each stop land beside the day.
 */
const PACES = {
  live: { deltaChars: 24, deltaDelayMs: 30, startDelayMs: 1200 },
  slow: { deltaChars: 12, deltaDelayMs: 40, startDelayMs: 1500 },
} as const;
type PaceName = keyof typeof PACES;

/**
 * How a proposal ends: whole; its stream cut short after its first new stop has landed; a new
 * stop the merge drops, so the page lets it go as soon as that stop is whole (production's
 * own in Elche, its coffee a kept place again; in Lisbon its last new stop moved to a kept
 * place); or the route busy, nothing sent. Each but the first fails, the day as it was.
 */
const ENDINGS = {
  complete: null,
  "cut after a stop": 0.62,
  "a stop dropped": null,
  busy: null,
} as const;
type EndingName = keyof typeof ENDINGS;
/**
 * How long a cut stream falls silent before it drops, as a live model's can between two
 * tokens: long enough for its first new stop to land whole at any width before the day goes
 * back.
 */
const CUT_SILENCE_MS = 1500;

/** What the route answers when nothing could be sent: the reader takes it as unavailable. */
const HTTP_BUSY = 503;

/** A recorded re-plan whose last new stop is at a place the day keeps, which the merge drops. */
function withLastAtKeptPlace(replan: GeneratedReplan, basis: ReplanBasis): GeneratedReplan {
  const kept = keptPlaceNamesOf(basis.itinerary, basis.windows)[0];
  const last = replan.stops.length - 1;
  if (kept === undefined) return replan;
  return {
    ...replan,
    stops: replan.stops.map((stop, at) =>
      at === last ? { ...stop, place: { ...stop.place, name: kept } } : stop,
    ),
  };
}

const encoder = new TextEncoder();

/**
 * A re-plan's stream as the route sends it, the AI SDK's events over server-sent events, the
 * re-plan's text in deltas a pace apart: what the reader reads from `POST /api/replan`.
 */
function recordedReplan(
  replan: GeneratedReplan,
  pace: (typeof PACES)[PaceName],
  signal: AbortSignal,
  cutAt: number | null = null,
) {
  const whole = JSON.stringify(replan);
  const text = cutAt === null ? whole : whole.slice(0, Math.floor(whole.length * cutAt));
  const events: object[] = [{ type: "start" }, { type: "text-start", id: "t" }];
  for (let start = 0; start < text.length; start += pace.deltaChars) {
    events.push({ type: "text-delta", id: "t", delta: text.slice(start, start + pace.deltaChars) });
  }
  if (cutAt === null) events.push({ type: "text-end", id: "t" }, { type: "finish" });
  const lines = [
    ...events.map((event) => JSON.stringify(event)),
    ...(cutAt === null ? ["[DONE]"] : []),
  ];
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const wait = (ms: number) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, ms);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(signal.reason);
          });
        });
      try {
        await wait(pace.startDelayMs);
        for (const line of lines) {
          controller.enqueue(encoder.encode(`data: ${line}\n\n`));
          await wait(pace.deltaDelayMs);
        }
        // A stream cut short falls silent, then drops as a lost connection does.
        if (cutAt === null) controller.close();
        else {
          await wait(CUT_SILENCE_MS);
          controller.error(new TypeError("network error"));
        }
      } catch (reason) {
        controller.error(reason);
      }
    },
  });
  return Promise.resolve(new Response(body, { headers: { "Content-Type": "text/event-stream" } }));
}

/**
 * A changed word's fork on the product's day (`docs/decisions.md`, "A changed word proposes its
 * part beside the day, and the visitor takes it"): production's Elche, whose dinner changed to
 * "eating late" proposes a new lunch and evening beside its own, two parts of one fork, and
 * Lisbon's, whose dinner proposes its last two stops anew. Each proposal is a recorded one, at
 * a live pace or slower; the day is the product's, the same as on a day's own address.
 */
export function ReplanConcept({ lisbon }: { lisbon: BenchDay }) {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [paceName, setPaceName] = useState<PaceName>("live");
  const [endingName, setEndingName] = useState<EndingName>("complete");
  const [dayName, setDayName] = useState<DayName>("Elche");
  const [replays, setReplays] = useState(0);
  const [isChoosing, setIsChoosing] = useState(false);
  const days: Record<DayName, BenchDay> = { Elche: ELCHE, Lisbon: lisbon };
  const bench = days[dayName];
  // The day chooses the recording: Elche's dinner rewrites its lunch and its afternoon,
  // Lisbon's its last two stops.
  const recordingOf = (ask: ReplanAsk): GeneratedReplan => {
    const isDropped = endingName === "a stop dropped";
    if (dayName === "Elche") return isDropped ? ELCHE_LATE_DINNER : ELCHE_LATE_DINNER_UNREPEATED;
    return isDropped
      ? withLastAtKeptPlace(LISBON_LATE_DINNER, replanBasisOf(ask))
      : LISBON_LATE_DINNER;
  };
  // Only the time words have recordings: company, which rewrites its own stops on a live day,
  // is written again whole here, as the page does with no re-plan to read; travel changes the
  // word alone and asks nothing.
  const replanSourceFor = (ask: ReplanAsk): ReplanSource | null =>
    ask.changed === "company"
      ? null
      : {
          basis: replanBasisOf(ask),
          open: (signal) =>
            endingName === "busy"
              ? Promise.resolve(new Response(null, { status: HTTP_BUSY }))
              : recordedReplan(recordingOf(ask), PACES[paceName], signal, ENDINGS[endingName]),
        };

  return (
    <div
      data-theme={theme === "system" ? undefined : theme}
      className="min-h-dvh bg-ground text-ink"
    >
      <Day
        key={`${dayName}:${replays}`}
        first={bench.request}
        sourceFor={sourceOf(bench, PACES[paceName])}
        replanSourceFor={replanSourceFor}
        isLive
      />
      <aside
        aria-label="Lab controls"
        // One strip, as the day bench's: the re-plan's choices open on demand, so the controls
        // never sit over the chart on a phone. The panel comes after its toggle, so Tab goes on
        // into it, and is drawn above the strip.
        className="fixed right-4 bottom-4 z-20 flex max-w-intro flex-col gap-2 rounded-sm border border-line bg-surface p-1"
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
            Again
          </button>
          <button
            type="button"
            aria-expanded={isChoosing}
            aria-controls="lab-replan"
            onClick={() => setIsChoosing((open) => !open)}
            className={cn(
              CONTROL_CLASSES,
              isChoosing ? "bg-ground text-ink" : "text-muted hover:text-ink",
            )}
          >
            Re-plan
          </button>
        </div>
        {isChoosing && (
          <div id="lab-replan" className="order-first flex flex-col gap-2 px-1 pt-1">
            <ChoiceGroup label="Day" names={DAY_NAMES} chosen={dayName} onChoose={setDayName} />
            <ChoiceGroup
              label="Ending"
              names={Object.keys(ENDINGS) as EndingName[]}
              chosen={endingName}
              onChoose={setEndingName}
            />
            <div role="group" aria-label="Re-plan pace" className="-ml-1 flex flex-wrap">
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
                  {name}
                </button>
              ))}
            </div>
            <p className="type-note text-muted">
              In Elche “early dinner” to “eating late” proposes its lunch and its afternoon anew,
              one fork of two parts; in Lisbon the same word its last two stops. Company, which no
              recording here answers, proposes the whole day at the pace chosen; travel changes the
              word alone.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

const DAY_NAMES = ["Elche", "Lisbon"] as const;
type DayName = (typeof DAY_NAMES)[number];

interface ChoiceGroupProps<Name extends string> {
  label: string;
  names: readonly Name[];
  chosen: Name;
  onChoose: (name: Name) => void;
}

/** One of the bench's choices: its options as buttons, the chosen one pressed. */
function ChoiceGroup<Name extends string>({
  label,
  names,
  chosen,
  onChoose,
}: ChoiceGroupProps<Name>) {
  return (
    <div role="group" aria-label={label} className="-ml-1 flex flex-wrap">
      {names.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={name === chosen}
          onClick={() => onChoose(name)}
          className={cn(
            CONTROL_CLASSES,
            name === chosen ? "bg-ground text-ink" : "text-muted hover:text-ink",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

const CONTROL_CLASSES = "rounded-sm px-2 py-1 type-note focus-ring";
