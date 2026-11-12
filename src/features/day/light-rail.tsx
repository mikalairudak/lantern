import { cn } from "@/components/ui/cn";
import {
  lightRuns,
  sunCrossing,
  SUNRISE_ALTITUDE,
  type DayContext,
  type LightQuality,
} from "@/lib/geo/sun";
import { formatClock } from "@/lib/time/clock";
import { RailBead } from "./rail-bead";

/**
 * The plan's rail: the day's light drawn down beside the times (`docs/decisions.md`, "A day opens
 * on its plan, lit by the day's light"). Through plain daylight it is a wire; through golden hour
 * it is the lamp, thicker; from sunset to sunrise, blue hour and night alike, it is dotted. Each
 * stop's stretch runs from its start to the next stop's, so the rail is one line down the day, and
 * a stop's bead stands on it at its time: in ink, and lit where its stretch begins dotted, in the
 * lamp with a step of its glow round it, so after dark the beads read as lamps along the night.
 * The sun's own minutes stand in the list where they fall.
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

/** A day's light, minute by minute, worked out once for a day and a place. */
interface DayLightTable {
  runs: { quality: LightQuality; from: number; to: number }[];
  suns: Sun[];
}

/** The day and the night after it, as the plan's running minutes go past midnight. */
const TABLE_MINUTES = 2 * 24 * 60;
/** Days kept worked out: a page shows one day, a bench a few. */
const TABLES_KEPT = 8;
const tables = new Map<string, DayLightTable>();

/**
 * The day's light at every minute and its sunrise and sunset, worked out once for a day and a
 * place and kept: the sun's position over a day is two thousand minutes of arithmetic, and the
 * plan asks for it on every render of every row.
 */
function tableOf(daylight: DayContext): DayLightTable {
  const key = `${daylight.date}|${daylight.position.lat}|${daylight.position.lng}|${daylight.utcOffsetMinutes}`;
  const kept = tables.get(key);
  if (kept) return kept;
  const found = lightRuns(daylight, 0, TABLE_MINUTES);
  const runs = found.map((run, index) => ({
    quality: run.quality,
    from: run.fromMinutes,
    to: found[index + 1]?.fromMinutes ?? TABLE_MINUTES,
  }));
  const rise = sunCrossing(daylight, SUNRISE_ALTITUDE, "rising");
  const set = sunCrossing(daylight, SUNRISE_ALTITUDE, "setting");
  const suns: Sun[] = [
    ...(rise === null ? [] : [{ minute: rise, word: "Sunrise" as const }]),
    ...(set === null ? [] : [{ minute: set, word: "Sunset" as const }]),
  ];
  const table = { runs, suns };
  if (tables.size >= TABLES_KEPT) tables.delete(tables.keys().next().value ?? "");
  tables.set(key, table);
  return table;
}

/** The light over a stretch of minutes, one span for each quality. */
function spansOf(daylight: DayContext, from: number, to: number) {
  const end = Math.max(to, from + 1);
  return tableOf(daylight)
    .runs.filter((run) => run.to > from && run.from < end)
    .map((run) => ({
      quality: run.quality,
      from: Math.max(run.from, from),
      to: Math.min(run.to, end),
    }));
}

/** Whether a minute of the day is in golden hour, where a stop's time is said in amber. */
export function isGoldenAt(daylight: DayContext, minute: number): boolean {
  return spansOf(daylight, minute, minute + 1)[0]?.quality === "golden";
}

export interface Sun {
  minute: number;
  word: "Sunrise" | "Sunset";
}

/** The day's sunrise and sunset, where the sun crosses the horizon at all. */
export function sunsOf(daylight: DayContext): Sun[] {
  return tableOf(daylight).suns;
}

/** The day's light at a minute, as the rail draws the stretch that begins there. */
export function lightAt(daylight: DayContext, minute: number): LightQuality {
  return spansOf(daylight, minute, minute + 1)[0]?.quality ?? "clear";
}

/** The rail down a stretch of the day, as tall as the row it stands beside. */
export function LightRail({
  daylight,
  from,
  to,
  hasBead,
  isProposed = false,
  className,
}: {
  daylight: DayContext;
  from: number;
  to: number;
  /** A stop's bead stands on the rail at its time. */
  hasBead: boolean;
  /** A proposal's stop: its bead stays ink whatever its hour, as its row carries no light. */
  isProposed?: boolean;
  className?: string;
}) {
  const length = Math.max(1, to - from);
  const spans = spansOf(daylight, from, to);
  // The bead reads the very spans the rail is drawn from, so the two never disagree.
  const isLit = !isProposed && spans[0] !== undefined && isDotted(spans[0].quality);
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
        {spans.map((span) => (
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
      {hasBead && <RailBead isLit={isLit} />}
    </span>
  );
}

/** A sun's line of the plan, and where the rail beside it runs to. */
export interface SunPlace {
  sun: Sun;
  to: number;
}

/** Each stop's sun lines and where its own rail stops, so the rail is one line down the day. */
export interface StopSuns {
  /** Before the stop: the suns since the stop before it began, or before the first stop. */
  lead: SunPlace[];
  /** After the last stop once the day is whole: the suns past its start. */
  trail: SunPlace[];
  /** Where the stop's own rail runs to: the next sun line's minute, or the next stop's start. */
  railTo: number;
}

/** How far the rail runs past the day's last sun line. */
const TAIL_MINUTES = 30;

/**
 * Where each sun stands in the plan. A sun comes in with the stop after it, as a line over that
 * stop, so a sun line never lands above a row already on the list; a sun past the last stop's
 * start comes once the day is whole. Each rail runs from its own minute to the next line's, the
 * stop's to the sun's and the sun's to the next stop's, so the rail is one line down the day.
 */
export function sunLinesOf(
  suns: readonly Sun[],
  spans: readonly { from: number; to: number }[],
  isWhole: boolean,
): StopSuns[] {
  const groups = spans.map((span, at) => {
    const earliest = at === 0 ? span.from - SUN_LEAD_MINUTES : (spans[at - 1]?.from ?? span.from);
    const lead = suns.filter((sun) => sun.minute >= earliest && sun.minute < span.from);
    const isLast = at === spans.length - 1;
    const trail = isLast && isWhole ? suns.filter((sun) => sun.minute >= span.from) : [];
    return { span, lead, trail };
  });
  const placed = (list: readonly Sun[], end: number): SunPlace[] =>
    list.map((sun, index) => ({ sun, to: list[index + 1]?.minute ?? end }));
  return groups.map(({ span, lead, trail }, at) => {
    const next = groups[at + 1];
    return {
      lead: placed(lead, span.from),
      trail: placed(trail, (trail.at(-1)?.minute ?? span.to) + TAIL_MINUTES),
      railTo: next?.lead[0]?.minute ?? trail[0]?.minute ?? next?.span.from ?? span.to,
    };
  });
}

/** A line of the plan for the sun: its minute in the gutter, its word beside the rail, in amber. */
export function SunLine({ daylight, sun, to }: { daylight: DayContext; sun: Sun; to: number }) {
  return (
    <div className="flex gap-3">
      <span className="w-12 shrink-0 type-time text-amber tabular-nums">
        {formatClock(sun.minute)}
      </span>
      <LightRail daylight={daylight} from={sun.minute} to={to} hasBead={false} />
      <span className="py-1 type-note text-amber">{sun.word}</span>
    </div>
  );
}
