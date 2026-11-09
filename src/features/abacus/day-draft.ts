import { keptAsWrittenOf, swapRefusalOf } from "@/lib/normalizer/normalize";
import {
  ALTERNATIVES_PER_STOP,
  FACT_KEYS,
  GeneratedStopSchema,
  noneAsNull,
  type Alternative,
  type FactKey,
  type GeneratedDay,
  type GeneratedLightProfile,
  type Itinerary,
  type LightProfile,
  type Place,
  type SensoryProfile,
} from "@/lib/schema/itinerary.schema";
import type { DeepPartial } from "ai";
import type { RevealedPartial } from "@/features/itinerary/revealed";
import { formatClock, parseClock } from "@/lib/time/clock";
import { optionIdOf, primaryIdOf, stopIdAt } from "@/lib/schema/positions";

/**
 * The day as far as the stream has written it, in the app layer's shapes. Ids follow the
 * normalizer's, positions in the generation (`stop-N`, `stop-N:p`, `stop-N:a1`), so whatever
 * the visitor does to a stop carries over from the partial day to the complete one, and no
 * bead remounts when the day completes. A complete draft is a list of `Stop`s.
 */

/** A place as far as the stream has written it. */
export type PlaceDraft = { id: string } & DeepPartial<Omit<Place, "id">>;

/**
 * An alternative joins the day once its energy is written: a bead needs it to be placed,
 * and its id says how it relates to the model's pick.
 */
export type AlternativeDraft = { id: string } & DeepPartial<Omit<Alternative, "id" | "sensory">> & {
    sensory: DeepPartial<SensoryProfile> & Pick<SensoryProfile, "energy">;
  };

/** A stop joins the day once its start time and duration are written. */
export interface StopDraft {
  id: string;
  startTime: string;
  durationMinutes: number;
  primary: PlaceDraft;
  alternatives: AlternativeDraft[];
  selectedPlaceId: string;
  /** The words of the request it was planned around, as far as the stream has them. */
  dependsOn?: FactKey[];
}

/** A stop whose own energy is written, so it can sit on the curve. */
export type EnergeticStop = StopDraft & {
  primary: { sensory: Pick<SensoryProfile, "energy"> };
};

export interface DayDraft {
  dek: string | undefined;
  stops: StopDraft[];
  /** The text being written right now: `DEK`, or a place's field, such as "stop-2:p.name". */
  writing: string | null;
  isComplete: boolean;
}

/** The `writing` key while the line about the day is being written. */
export const DEK = "dek";

/** A light profile as far as the stream has written it, read by the app: its "none" is null. */
function draftLightOf(light: DeepPartial<GeneratedLightProfile>): DeepPartial<LightProfile> {
  const { orientation, bestWindow, ...rest } = light;
  return {
    ...rest,
    ...(orientation === undefined ? {} : { orientation: noneAsNull(orientation) }),
    ...(bestWindow === undefined ? {} : { bestWindow: noneAsNull(bestWindow) }),
  };
}

/**
 * A place's fields as far as the stream has written them, as the app reads them, as the
 * normalizer will: a direction or a window written "none" is null.
 */
export function draftFieldsOf<Fields extends { light?: DeepPartial<GeneratedLightProfile> }>(
  fields: Fields,
): Omit<Fields, "light"> & { light?: DeepPartial<LightProfile> } {
  const { light, ...rest } = fields;
  return light === undefined ? rest : { ...rest, light: draftLightOf(light) };
}

/** A place's field being written, by the stop's position in the stream. */
export const STOP_FIELD_PATH = /^stops\.(\d+)\.place\.(.+)$/;
/**
 * A stop's time as the normalizer will read it, "9:45" as "09:45", or null for one it will
 * not read, which a half-written "09:" never reaches: the stop is placed only once its
 * place has started, after its time.
 */
export function clockTimeOf(startTime: string | undefined): string | null {
  const minutes = startTime === undefined ? null : parseClock(startTime);
  return minutes === null ? null : formatClock(minutes);
}

/** An alternative as the model writes it, a field at a time. */
export type GeneratedOption = GeneratedDay["alternatives"][number]["options"][number];
type OptionDraft = DeepPartial<GeneratedOption>;

/**
 * Whether a stop's own energy is written: in a draft, once its best window is too
 * (`weighedWithItsLight`), so its row knows all it shows. That is everything a row shows: its
 * name, kind and neighbourhood, the energy that says how much the row says, the texture an
 * open row adds, and the best window that may mark it with a sun, the last of them in the
 * stream, so this is the moment its bead is weighed.
 */
export function hasEnergy(stop: StopDraft): stop is EnergeticStop {
  return stop.primary.sensory?.energy !== undefined;
}

/**
 * The stops whose rows can land whole, from the first, as reduced motion lands them: a row
 * that grew as its words arrived would step, and step the rows below it with it. The first
 * stop still being written holds back the ones after it, so the day still lands in order.
 * Every stop written, it is the same list.
 */
export function wordsWrittenStopsOf(stops: readonly StopDraft[]): readonly StopDraft[] {
  const writing = stops.findIndex((stop) => !hasEnergy(stop));
  return writing === -1 ? stops : stops.slice(0, writing);
}

/**
 * How many of the day's first stops are whole: every field of theirs final, so a sheet can
 * say what each place is while the day is still written. A stop is whole once the stream
 * has placed the stop after it; the last, once the versions have begun, since the model
 * writes them after every stop, or once the stream has ended.
 */
export function wholeStopsOf({
  stops,
  isComplete,
}: Pick<DayDraft, "stops" | "isComplete">): number {
  const isStopsClosed = isComplete || stops.some((stop) => stop.alternatives.length > 0);
  return isStopsClosed ? stops.length : Math.max(0, stops.length - 1);
}

/** No stop opens. */
export const NO_STOPS_OPEN: ReadonlySet<string> = new Set();

/**
 * The stops a sheet may open on while the day is still written: whole, and kept by the
 * normalizer exactly as written, their hours too, so nothing a sheet says changes when the
 * day completes and the chart takes the normalized itinerary. A stop the finished day will
 * cut short, clamp, trim or drop opens only once it is complete. Every stop of a complete
 * day opens. Ids, as the normalizer keeps them whatever it drops.
 */
export function openableStopsOf(
  day: DeepPartial<GeneratedDay>,
  draft: Pick<DayDraft, "stops" | "isComplete">,
): ReadonlySet<string> {
  if (draft.isComplete) return new Set(draft.stops.map(({ id }) => id));
  const whole = wholeStopsOf(draft);
  const written = (day.stops ?? [])
    .slice(0, whole)
    .map((stop) => GeneratedStopSchema.safeParse(stop));
  const stops = written.flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  // A stop the stream has not written as the schema has it is never shown as final.
  const parsedWhole = stops.length === written.length ? whole : 0;
  const kept = keptAsWrittenOf(stops.slice(0, parsedWhole), draft.stops[whole]?.startTime ?? null);
  return new Set(
    draft.stops.slice(0, parsedWhole).flatMap(({ id }, index) => (kept[index] ? [id] : [])),
  );
}

/**
 * A stop being written again whose new place has not started: its old text has left and
 * its time is a placeholder, so neither the list nor the axis states one.
 */
export function isEmptied(stop: StopDraft, rewriting: readonly string[]): boolean {
  return rewriting.includes(stop.id) && stop.primary.name === undefined;
}

/** Whether the stream is writing this field of this place right now. */
export function isWriting(writing: string | null, placeId: string, field: string): boolean {
  return writing === `${placeId}.${field}`;
}

/** A place's point once both its coordinates are written, else null. */
function wholePointOf(place: {
  coordinates?: { lat?: number; lng?: number };
}): GeneratedOption["coordinates"] | null {
  const { lat, lng } = place.coordinates ?? {};
  return lat === undefined || lng === undefined ? null : { lat, lng };
}

/**
 * The versions that have arrived for a stop, each once its energy is written and its stop's
 * is: a bead needs both to be placed. An id names the option's place in its set, as the
 * normalizer's does, so a version written later or dropped moves no other. Ids start with the
 * stop's id, or with another prefix where a stop is written again and its new places need ids
 * of their own. Every one is drawn as written, as for versions no normalizer reads.
 */
export function versionsOf(
  stop: StopDraft,
  options: readonly (OptionDraft | undefined)[],
  prefix: string = stop.id,
): AlternativeDraft[] {
  if (!hasEnergy(stop)) return [];
  return options.flatMap((option, n) => {
    const energy = option?.sensory?.energy;
    if (option === undefined || energy === undefined) return [];
    return [
      {
        ...draftFieldsOf(option),
        id: optionIdOf(prefix, n),
        sensory: { ...option.sensory, energy },
      },
    ];
  });
}

/**
 * A stop's versions as the finished day will keep them (`versionsOf`): none the normalizer
 * drops for what is known of it once its bead could appear, one spelled as one of the day's
 * stops or past a short walk from its stop (`swapRefusalOf`), nor more than it keeps. A
 * version's name and point come before its energy, so both are final by then, and a bead the
 * finished day does not keep never shows, to leave as the day lands. `dayStops` are the stops
 * written with it, which the normalizer reads it beside. What the draft cannot know so soon
 * still shows: a blank reason, or a place that cannot be shown, found once the version is
 * whole; and a stop the normalizer drops from the day, overlapping or unread, whose name the
 * draft still reads, so a version spelled as it is hidden here and kept there.
 */
export function alternativesOf(
  stop: StopDraft,
  options: readonly (OptionDraft | undefined)[],
  dayStops: readonly StopDraft[],
  prefix: string = stop.id,
): AlternativeDraft[] {
  const stopPoint = wholePointOf(stop.primary);
  if (stopPoint === null) return [];
  const dayStopNames = dayStops.map((each) => each.primary.name ?? "");
  const kept = versionsOf(stop, options, prefix).filter((version) => {
    const point = wholePointOf(version);
    if (point === null || version.name === undefined) return false;
    const option = { name: version.name, coordinates: point };
    return swapRefusalOf(stopPoint, option, dayStopNames) === null;
  });
  return kept.slice(0, ALTERNATIVES_PER_STOP);
}

/**
 * Stops whose time is known, before any alternatives arrive. A partial stream can hold a
 * half-written time ("09:") or number (9 on its way to 90), so a stop is placed only once
 * its place has started, which means both came before it whole, and its time is one the
 * normalizer reads, written as the normalizer writes it. A stop's id is its position in the
 * stream, under a re-plan's prefix where one writes stops again (`r2-stop-0`).
 */
export function placedStopsOf(
  stops: DeepPartial<GeneratedDay>["stops"],
  idOf: (index: number) => string = stopIdAt,
): { index: number; stop: StopDraft }[] {
  return (stops ?? []).flatMap((stop, index) => {
    // A partial's list items are typed as possibly missing.
    if (stop === undefined) return [];
    const { durationMinutes, place, dependsOn = [] } = stop;
    const startTime = clockTimeOf(stop.startTime);
    if (place === undefined || startTime === null || durationMinutes === undefined) return [];
    const id = idOf(index);
    const primary: PlaceDraft = {
      id: primaryIdOf(id),
      ...weighedWithItsLight(draftFieldsOf(place)),
    };
    const draft: StopDraft = {
      id,
      startTime,
      durationMinutes,
      primary,
      alternatives: [],
      selectedPlaceId: primary.id,
      // The energy word shapes every stop, so the model leaves it out.
      dependsOn: FACT_KEYS.filter((key) => key === "energy" || dependsOn.includes(key)),
    };
    return [{ index, stop: draft }];
  });
}

/**
 * A place's energy joins the day with its best window, the last of what its row shows, so the bead
 * is weighed once the row knows all it will say: its name, kind and quarter, the texture or the
 * crowd and sound of its second line, where it is on the map, and whether a sun marks it. Weighed
 * sooner, a row laid out its words before it knew of its sun, and a room held for a sun that never
 * came stayed in the day for good (`docs/decisions.md`, "A row's words go where its bead comes to
 * rest, and rows ease rather than jump").
 */
function weighedWithItsLight<Fields extends Omit<PlaceDraft, "id">>(fields: Fields): Fields {
  if (fields.light?.bestWindow !== undefined || fields.sensory?.energy === undefined) return fields;
  const { energy: _unweighed, ...sensory } = fields.sensory;
  return { ...fields, sensory };
}

/** The text being written, keyed by the place it belongs to rather than by its position. */
function writingOf(activePath: string | null): string | null {
  if (activePath === DEK) return DEK;
  const match = activePath === null ? null : STOP_FIELD_PATH.exec(activePath);
  if (!match) return null;
  return `${primaryIdOf(stopIdAt(Number(match[1])))}.${match[2]}`;
}

/** What the chart and the list can show of a day the stream has partly written. */
export function draftDayOf({ day, activePath, isComplete }: RevealedPartial): DayDraft {
  const sets = day.alternatives ?? [];
  const placed = placedStopsOf(day.stops).map(({ stop }) => stop);
  const stops = placed.map((stop) => {
    // A stop's first set counts, as the normalizer keeps only that one.
    const set = sets.find(
      (candidate) =>
        candidate?.stopIndex !== undefined && stopIdAt(candidate.stopIndex) === stop.id,
    );
    return { ...stop, alternatives: alternativesOf(stop, set?.options ?? [], placed) };
  });
  return { dek: day.dek, stops, writing: writingOf(activePath), isComplete };
}

/**
 * A complete day as the chart draws it once the stream has ended: the normalized itinerary,
 * so a swap selects by place id and the normalizer's repairs show. Its ids are the ones the
 * draft has used all along, so no bead or row remounts when the day switches to it.
 */
export function completeDraftOf(itinerary: Itinerary): DayDraft {
  return { dek: itinerary.dek, stops: itinerary.stops, writing: null, isComplete: true };
}
