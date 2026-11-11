import { cn } from "@/components/ui/cn";
import {
  lightRuns,
  sunCrossing,
  SUNRISE_ALTITUDE,
  type DayContext,
  type LightQuality,
} from "@/lib/geo/sun";
import { formatClock } from "@/lib/time/clock";

/**
 * The plan's rail: the day's light drawn down beside the times (`docs/decisions.md`, "A day opens
 * on its plan, lit by the day's light"). Through plain daylight it is a wire; through golden hour
 * it is the lamp, thicker; from sunset to sunrise, blue hour and night alike, it is dotted. Each
 * stop's stretch runs from its start to the next stop's, so the rail is one line down the day, and
 * a stop's bead stands on it at its time. The sun's own minutes stand in the list where they fall.
 */

const RAIL_UNITS = 8;
const RAIL_X = RAIL_UNITS / 2;
/** Golden hour is drawn heavier than daylight, as the chart's axis draws it. */
const GOLDEN_STROKE = 3;
const PLAIN_STROKE = 1.5;
/** Dusk and night: a dot, then a gap, in screen pixels. */
const DOTTED = "1 4";
/** A sun before the first stop stands over it only when the day starts this near its light. */
export const SUN_LEAD_MINUTES = 90;

const STROKE_CLASSES: Record<LightQuality, string> = {
  golden: "stroke-lamp",
  soft: "stroke-wire",
  clear: "stroke-wire",
  blue: "stroke-muted",
  dark: "stroke-muted",
};

function isDotted(quality: LightQuality): boolean {
  return quality === "blue" || quality === "dark";
}

/** The light over a stretch of minutes, one span for each quality. */
function spansOf(daylight: DayContext, from: number, to: number) {
  const runs = lightRuns(daylight, from, Math.max(to, from + 1));
  return runs.map((run, index) => ({
    quality: run.quality,
    from: run.fromMinutes,
    to: runs[index + 1]?.fromMinutes ?? Math.max(to, from + 1),
  }));
}

/** Whether a minute of the day is in golden hour, where a stop's time is said in amber. */
export function isGoldenAt(daylight: DayContext, minute: number): boolean {
  return lightRuns(daylight, minute, minute + 1)[0]?.quality === "golden";
}

export interface Sun {
  minute: number;
  word: "Sunrise" | "Sunset";
}

/** The day's sunrise and sunset, where the sun crosses the horizon at all. */
export function sunsOf(daylight: DayContext): Sun[] {
  const rise = sunCrossing(daylight, SUNRISE_ALTITUDE, "rising");
  const set = sunCrossing(daylight, SUNRISE_ALTITUDE, "setting");
  return [
    ...(rise === null ? [] : [{ minute: rise, word: "Sunrise" as const }]),
    ...(set === null ? [] : [{ minute: set, word: "Sunset" as const }]),
  ];
}

/** The rail down a stretch of the day, as tall as the row it stands beside. */
export function LightRail({
  daylight,
  from,
  to,
  hasBead,
  className,
}: {
  daylight: DayContext;
  from: number;
  to: number;
  /** A stop's bead stands on the rail at its time. */
  hasBead: boolean;
  className?: string;
}) {
  const length = Math.max(1, to - from);
  return (
    <span
      aria-hidden
      className={cn("relative flex w-2 shrink-0 justify-center self-stretch", className)}
    >
      <svg
        viewBox={`0 0 ${RAIL_UNITS} ${length}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {spansOf(daylight, from, to).map((span) => (
          <line
            key={span.from}
            x1={RAIL_X}
            x2={RAIL_X}
            y1={span.from - from}
            y2={span.to - from}
            vectorEffect="non-scaling-stroke"
            strokeWidth={span.quality === "golden" ? GOLDEN_STROKE : PLAIN_STROKE}
            strokeDasharray={isDotted(span.quality) ? DOTTED : undefined}
            strokeLinecap="round"
            className={STROKE_CLASSES[span.quality]}
          />
        ))}
      </svg>
      {hasBead && <span className="relative mt-2 size-2 rounded-full bg-ink" />}
    </span>
  );
}

/** A line of the plan for the sun: its minute in the gutter, its word beside the rail, in amber. */
export function SunLine({ daylight, sun }: { daylight: DayContext; sun: Sun }) {
  return (
    <div className="flex gap-3">
      <span className="w-12 shrink-0 type-time text-amber tabular-nums">
        {formatClock(sun.minute)}
      </span>
      <LightRail daylight={daylight} from={sun.minute - 10} to={sun.minute + 10} hasBead={false} />
      <span className="py-1 type-note text-amber">{sun.word}</span>
    </div>
  );
}
