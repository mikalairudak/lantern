import { distanceInMeters } from "@/lib/geo/distance";
import {
  ALTERNATIVES_PER_STOP,
  ENERGY_LEVELS,
  endKeptBy,
  FACT_KEYS,
  lightOf,
  ItinerarySchema,
  MAX_AESTHETIC_TAGS,
  MAX_STOP_MINUTES,
  SWAP_RADIUS_METERS,
  type Alternative,
  type Coordinates,
  type DayRequest,
  type FactKey,
  type Facts,
  type FactSource,
  type GeneratedAlternative,
  type GeneratedAssumptions,
  type GeneratedDay,
  type GeneratedPlace,
  type GeneratedStop,
  type Itinerary,
  type Place,
  type Stop,
} from "@/lib/schema/itinerary.schema";
import { isSameSpelling } from "@/lib/places/match";
import { formatClock, parseClock, runningSpans, runningStart } from "@/lib/time/clock";
import { isStopIndexOf, optionIdOf, primaryIdOf, stopIdAt } from "@/lib/schema/positions";

/**
 * Builds the app-layer itinerary from a finished generation. The model owns content; this
 * owns ids, request context and the invariants components rely on. A slip it can fix is
 * repaired and reported; a day it cannot make whole is refused with the reason. Every
 * repair is returned, because the eval counts them and debugging a bad generation starts
 * from them (docs/harness.md).
 */

export type RepairKind =
  | "trimmed-text"
  | "trimmed-tags"
  | "reformatted-time"
  | "rounded-duration"
  | "clamped-duration"
  | "shortened-overlap"
  | "dropped-stop"
  | "dropped-alternatives"
  | "dropped-alternative"
  | "dropped-repeat"
  | "sorted-alternatives"
  | "kept-choice"
  | "deduplicated-dependencies"
  | "fitted-end";

export interface Repair {
  kind: RepairKind;
  /** Where in the generated day, e.g. `["stops", 2, "startTime"]`. */
  path: (string | number)[];
  /** What was done, for a person reading the eval. */
  note: string;
}

export type NormalizeResult =
  | { ok: true; itinerary: Itinerary; repairs: Repair[] }
  | { ok: false; reason: string; repairs: Repair[] };

type Path = Repair["path"];
type PlaceContent = Omit<Place, "id">;

/** Where a stop stands in the day, all that putting the stops in order reads. */
interface Timing {
  generatedIndex: number;
  /** Minutes after midnight: as on the clock, then running on past 1440 once put in order. */
  start: number;
  durationMinutes: number;
}

interface TimedStop extends Timing {
  place: PlaceContent;
  /** The words it was planned around, the energy word first. */
  dependsOn: FactKey[];
}

// Leading and trailing whitespace, plus format characters such as zero-width spaces,
// which survive `trim()` but render as nothing. Inner ones are left alone: a joiner
// inside a word can be meaningful.
const EDGE_SPACE = /^[\s\p{Cf}]+|[\s\p{Cf}]+$/gu;

/** A text with its edges trimmed as the normalizer trims every text it keeps. */
export function withoutEdgeSpace(value: string): string {
  return value.replace(EDGE_SPACE, "");
}

/** Collects repairs while a day is rebuilt, so each step only says what it fixed. */
class RepairLog {
  readonly repairs: Repair[] = [];

  add(kind: RepairKind, path: Path, note: string): void {
    this.repairs.push({ kind, path, note });
  }
}

function cleanText(value: string, path: Path, log: RepairLog): string | null {
  const cleaned = withoutEdgeSpace(value);
  if (cleaned === "") return null;
  if (cleaned !== value) log.add("trimmed-text", path, `trimmed ${JSON.stringify(value)}`);
  return cleaned;
}

function isOnEarth({ lat, lng }: Coordinates): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * The place with its text trimmed and its tags cut to the allowed few, or the reason it
 * cannot be shown. One problem is enough to drop it, so the first one found is returned.
 */
function cleanPlace(
  place: GeneratedPlace,
  path: Path,
  log: RepairLog,
): { place: PlaceContent } | { problem: string } {
  const text = (value: string, ...field: Path): string | null =>
    cleanText(value, [...path, ...field], log);

  const name = text(place.name, "name");
  const neighborhood = text(place.neighborhood, "neighborhood");
  const summary = text(place.summary, "summary");
  const texture = text(place.sensory.texture, "sensory", "texture");
  const note = text(place.light.note, "light", "note");
  if (name === null || neighborhood === null || summary === null) {
    return { problem: "its name, neighborhood or summary is blank" };
  }
  if (texture === null || note === null) return { problem: "its texture or light note is blank" };
  if (!isOnEarth(place.coordinates)) return { problem: "its coordinates are off the map" };

  const tags = place.aesthetic.map(withoutEdgeSpace).filter((tag) => tag !== "");
  if (tags.length === 0) return { problem: "it has no aesthetic tags" };
  const aesthetic = tags.slice(0, MAX_AESTHETIC_TAGS);
  if (
    aesthetic.length !== place.aesthetic.length ||
    aesthetic.some((tag, i) => tag !== place.aesthetic[i])
  ) {
    log.add("trimmed-tags", [...path, "aesthetic"], `kept ${JSON.stringify(aesthetic)}`);
  }

  return {
    place: {
      ...place,
      name,
      neighborhood,
      summary,
      aesthetic,
      sensory: { ...place.sensory, texture },
      light: { ...lightOf(place.light), note },
    },
  };
}

/** A whole number of minutes the app can show, or null when nothing sensible is left. */
function cleanDuration(value: number, path: Path, log: RepairLog): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1) return null;
  if (rounded !== value) log.add("rounded-duration", path, `${value} became ${rounded}`);
  if (rounded > MAX_STOP_MINUTES) {
    log.add("clamped-duration", path, `${rounded} became ${MAX_STOP_MINUTES}`);
    return MAX_STOP_MINUTES;
  }
  return rounded;
}

/**
 * A word of the request as the day was planned on it. The visitor's choice stands where
 * the model assumed otherwise; a word that neither the visitor nor the model gave is the
 * one Lantern asks about.
 */
function factOf<Value extends string>(
  key: keyof GeneratedAssumptions,
  chosen: Value | null,
  assumed: Value | null,
  log: RepairLog,
): { value: Value | null; source: FactSource } {
  if (chosen === null) {
    return assumed === null
      ? { value: null, source: "asked" }
      : { value: assumed, source: "assumed" };
  }
  if (assumed !== null && assumed !== chosen) {
    log.add(
      "kept-choice",
      ["assumptions", key],
      `kept the visitor's ${JSON.stringify(chosen)} over the assumed ${JSON.stringify(assumed)}`,
    );
  }
  return { value: chosen, source: "chosen" };
}

function factsOf(request: DayRequest, assumptions: GeneratedAssumptions, log: RepairLog): Facts {
  return {
    energy: { value: request.energy, source: request.energySource },
    travel: factOf("travel", request.travel, assumptions.travel, log),
    start: factOf("start", request.start, assumptions.start, log),
    dinner: factOf("dinner", request.dinner, assumptions.dinner, log),
    end: factOf("end", request.end, assumptions.end, log),
    company: factOf("company", request.company, assumptions.company, log),
  };
}

/**
 * The day's words with an end Lantern assumed said as the one its hours keep (`endKeptBy`): the
 * model writes its assumptions before its stops, and a day it then ran past eight under "home by
 * eight", or ended at seven under "home by eleven", would promise an hour it does not keep, or
 * one far from it. The visitor's own end, and an end Lantern asked about, stand as they are. A
 * merged re-plan's day is fitted the same way (`mergeReplan`).
 */
export function withAssumedEndFitted(
  facts: Facts,
  stops: readonly Pick<Stop, "startTime" | "durationMinutes">[],
): Facts {
  if (facts.end.source !== "assumed" || stops.length === 0) return facts;
  const kept = endKeptBy(Math.max(...runningSpans(stops).map((span) => span.to)));
  return kept === facts.end.value ? facts : { ...facts, end: { value: kept, source: "assumed" } };
}

/** The words a stop was planned around: the energy word, then each it names once. */
function dependsOnOf(stop: GeneratedStop, path: Path, log: RepairLog): FactKey[] {
  const named = new Set<FactKey>(stop.dependsOn);
  if (named.size < stop.dependsOn.length) {
    log.add("deduplicated-dependencies", path, `kept ${JSON.stringify([...named])}`);
  }
  // In the sentence's order, which carries no meaning, so putting them in it is no repair.
  return FACT_KEYS.filter((key) => key === "energy" || named.has(key));
}

function timedStops(day: Pick<GeneratedDay, "stops">, log: RepairLog): TimedStop[] {
  return day.stops.flatMap((stop, generatedIndex): TimedStop[] => {
    const path: Path = ["stops", generatedIndex];
    const drop = (why: string): TimedStop[] => {
      log.add("dropped-stop", path, why);
      return [];
    };

    const start = parseClock(stop.startTime);
    if (start === null)
      return drop(`its start time ${JSON.stringify(stop.startTime)} is not a time`);
    if (formatClock(start) !== stop.startTime) {
      log.add(
        "reformatted-time",
        [...path, "startTime"],
        `${JSON.stringify(stop.startTime)} became "${formatClock(start)}"`,
      );
    }
    const durationMinutes = cleanDuration(stop.durationMinutes, [...path, "durationMinutes"], log);
    if (durationMinutes === null) return drop(`its duration ${stop.durationMinutes} is not a stay`);
    const cleaned = cleanPlace(stop.place, [...path, "place"], log);
    if ("problem" in cleaned) return drop(`its place cannot be shown: ${cleaned.problem}`);
    const dependsOn = dependsOnOf(stop, [...path, "dependsOn"], log);

    return [{ generatedIndex, start, durationMinutes, place: cleaned.place, dependsOn }];
  });
}

/**
 * Each stop starts no earlier than the previous one ends. A stop that runs into the next
 * is cut short at the next start; a stop that starts no later than the one before it is
 * out of order and dropped. A start in the small hours after a late evening is after
 * midnight, not out of order (`runningStart`).
 */
function withoutOverlaps<Timed extends Timing>(stops: Timed[], log: RepairLog): Timed[] {
  const kept: Timed[] = [];
  for (const timed of stops) {
    const previous = kept.at(-1);
    const previousEnd = previous ? previous.start + previous.durationMinutes : null;
    const stop = { ...timed, start: runningStart(timed.start, previousEnd) };
    if (previous && stop.start <= previous.start) {
      log.add(
        "dropped-stop",
        ["stops", stop.generatedIndex],
        `it starts at ${formatClock(stop.start)}, no later than the stop before it`,
      );
      continue;
    }
    if (previous && stop.start < previous.start + previous.durationMinutes) {
      const shortened = stop.start - previous.start;
      log.add(
        "shortened-overlap",
        ["stops", previous.generatedIndex, "durationMinutes"],
        `${previous.durationMinutes} became ${shortened}, to end when the next stop starts`,
      );
      previous.durationMinutes = shortened;
    }
    kept.push(stop);
  }
  return kept;
}

/**
 * Which of a day's first stops, while it streams, the finished day will show exactly as they
 * were written: nothing of them repaired, trimmed or dropped, their time included. A stop's
 * time is judged against the start of the stop after it, once that is known, as the finished
 * day's order judges it; when that next stop is itself out of order, what cuts the stop short
 * is still to come, so it is not yet known to stand.
 */
export function keptAsWrittenOf(
  stops: readonly GeneratedStop[],
  nextStart: string | null,
): boolean[] {
  const log = new RepairLog();
  const timed = timedStops({ stops: [...stops] }, log);
  const next = nextStart === null ? null : parseClock(nextStart);
  const probe: Timing[] =
    next === null ? [] : [{ generatedIndex: stops.length, start: next, durationMinutes: 1 }];
  const kept = withoutOverlaps<Timing>([...timed, ...probe], log);
  const keptIndices = new Set(kept.map(({ generatedIndex }) => generatedIndex));
  const repaired = new Set(
    log.repairs.flatMap(({ path: [field, index] }) =>
      field === "stops" && typeof index === "number" ? [index] : [],
    ),
  );
  // A next stop with no time the clock reads is dropped as well, and so is out of order.
  const isNextInOrder = nextStart === null || keptIndices.has(stops.length);
  return stops.map(
    (_, index) =>
      keptIndices.has(index) && !repaired.has(index) && (isNextInOrder || index < stops.length - 1),
  );
}

interface OptionSet {
  setIndex: number;
  options: GeneratedAlternative[];
}

/** The first set of options for each stop, by the stop's index in the generated day. */
function optionsByStop(day: GeneratedDay, log: RepairLog): Map<number, OptionSet> {
  const byStop = new Map<number, OptionSet>();
  day.alternatives.forEach((set, setIndex) => {
    const path: Path = ["alternatives", setIndex];
    if (!isStopIndexOf(set.stopIndex, day.stops.length)) {
      log.add("dropped-alternatives", path, `stop ${set.stopIndex} does not exist`);
    } else if (byStop.has(set.stopIndex)) {
      log.add("dropped-alternatives", path, `stop ${set.stopIndex} already has alternatives`);
    } else {
      byStop.set(set.stopIndex, { setIndex, options: set.options });
    }
  });
  return byStop;
}

function energyRank(place: Pick<GeneratedPlace, "sensory">): number {
  return ENERGY_LEVELS.indexOf(place.sensory.energy);
}

/** Why an option cannot stand beside its stop: it repeats one of the day's stops, or is too far. */
export type SwapRefusal = { kind: "repeat"; stopIndex: number } | { kind: "far"; meters: number };

/**
 * Whether an option can stand beside its stop, by what is known of it once its point is
 * written: its name and its point. The normalizer drops an option it refuses, and the stream's
 * draft never draws one (`alternativesOf`), so a bead the finished day will not keep never
 * shows while the day is written. `dayStopNames` are the day's stops, by their index.
 */
export function swapRefusalOf(
  stopPoint: Coordinates,
  option: Pick<GeneratedPlace, "name" | "coordinates">,
  dayStopNames: readonly string[],
): SwapRefusal | null {
  const stopIndex = dayStopNames.findIndex((name) => isSameSpelling(name, option.name));
  if (stopIndex !== -1) return { kind: "repeat", stopIndex };
  const meters = Math.round(distanceInMeters(stopPoint, option.coordinates));
  return meters > SWAP_RADIUS_METERS ? { kind: "far", meters } : null;
}

/**
 * The options a stop can swap to: shown, not already in the day, within a short walk, at most
 * two, quieter first. An option spelled as one of the day's stops would put that place in the
 * day twice once swapped in, as Belgrade's Trg Republike did (`docs/decisions.md`, "The normalizer
 * repairs slips and refuses what it cannot make whole"), as a re-plan's merge drops a repeat
 * (`mergeReplan`). The walk is measured between the points the model gave, the middle of a coffee,
 * food or bar area since day-v3 rather than a door. The curve picks by energy, so the order only
 * matters to a reader; the schema asks for it. An id names the option's place in the generation, so
 * sorting or dropping does not move it.
 */
function cleanAlternatives(
  stop: TimedStop,
  stopId: string,
  { setIndex, options }: OptionSet,
  dayStops: readonly TimedStop[],
  log: RepairLog,
): Alternative[] {
  const usable = options.flatMap((option, n): Alternative[] => {
    const path: Path = ["alternatives", setIndex, "options", n];
    const cleaned = cleanPlace(option, path, log);
    if ("problem" in cleaned) {
      log.add("dropped-alternative", path, `it cannot be shown: ${cleaned.problem}`);
      return [];
    }
    const reason = cleanText(option.reason, [...path, "reason"], log);
    if (reason === null) {
      log.add("dropped-alternative", path, "its reason is blank");
      return [];
    }
    const refusal = swapRefusalOf(
      stop.place.coordinates,
      { name: cleaned.place.name, coordinates: option.coordinates },
      dayStops.map((each) => each.place.name),
    );
    const repeated = refusal?.kind === "repeat" ? dayStops[refusal.stopIndex] : undefined;
    if (repeated !== undefined) {
      log.add(
        "dropped-repeat",
        path,
        `${cleaned.place.name} is the day's stop at ${formatClock(repeated.start)}`,
      );
      return [];
    }
    if (refusal?.kind === "far") {
      log.add(
        "dropped-alternative",
        path,
        `it is ${refusal.meters} m from its stop, over ${SWAP_RADIUS_METERS} m`,
      );
      return [];
    }
    return [{ id: optionIdOf(stopId, n), ...cleaned.place, reason }];
  });

  const kept = usable.slice(0, ALTERNATIVES_PER_STOP);
  if (kept.length < usable.length) {
    log.add(
      "dropped-alternative",
      ["alternatives", setIndex, "options"],
      `kept the first ${ALTERNATIVES_PER_STOP} of ${usable.length}`,
    );
  }
  const sorted = [...kept].sort((a, b) => energyRank(a) - energyRank(b));
  if (sorted.some((option, i) => option !== kept[i])) {
    log.add(
      "sorted-alternatives",
      ["alternatives", setIndex, "options"],
      "put the quieter option first",
    );
  }
  return sorted;
}

/**
 * Turns a finished generation into the itinerary components render, or refuses it.
 * Ids are positions in the generation (`stop-0`, `stop-0:p`, `stop-0:a1`), not in the
 * itinerary: a dropped stop or option leaves a gap, so a card keyed by its index while the
 * day streamed keeps its key once the day is complete. Every stop shows its primary.
 * The request must already have parsed through `DayRequestSchema`.
 */
export function normalizeDay(request: DayRequest, day: GeneratedDay): NormalizeResult {
  const log = new RepairLog();
  const refuse = (reason: string): NormalizeResult => ({ ok: false, reason, repairs: log.repairs });

  const facts = factsOf(request, day.assumptions, log);
  const dek = cleanText(day.dek, ["dek"], log);
  if (dek === null) return refuse("the line about the day is blank");

  const stops = withoutOverlaps(timedStops(day, log), log);
  if (stops.length === 0) return refuse("no stop could be shown");

  const byStop = optionsByStop(day, log);
  const itineraryStops = stops.map((stop): Stop => {
    const id = stopIdAt(stop.generatedIndex);
    const primaryId = primaryIdOf(id);
    const set = byStop.get(stop.generatedIndex);
    return {
      id,
      startTime: formatClock(stop.start),
      durationMinutes: stop.durationMinutes,
      primary: { id: primaryId, ...stop.place },
      alternatives: set ? cleanAlternatives(stop, id, set, stops, log) : [],
      selectedPlaceId: primaryId,
      dependsOn: stop.dependsOn,
    };
  });

  const fitted = withAssumedEndFitted(facts, itineraryStops);
  if (fitted.end.value !== facts.end.value) {
    log.add(
      "fitted-end",
      ["assumptions", "end"],
      `the assumed ${JSON.stringify(facts.end.value)} became ${JSON.stringify(fitted.end.value)}, the end the day's hours keep`,
    );
  }
  const itinerary = {
    dek,
    city: request.city,
    date: request.date,
    timezone: request.timezone,
    facts: fitted,
    stops: itineraryStops,
  };
  const parsed = ItinerarySchema.safeParse(itinerary);
  if (!parsed.success) {
    // Everything the app layer checks is repaired or refused above, so this is a bug here.
    throw new Error(`The normalizer built an invalid itinerary: ${parsed.error.message}`);
  }
  return { ok: true, itinerary: parsed.data, repairs: log.repairs };
}
