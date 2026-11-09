import { z } from "zod";
import type { GenerationRecord } from "@/lib/live/generation-log";
import type { CallRole } from "@/lib/live/models";
import {
  AREA_RADIUS_METERS,
  MIN_PLACES_AROUND,
  namesAroundIn,
  PLACES_PER_LOOKUP,
  placesAroundIn,
} from "@/lib/places/area";
import type { GeoapifyClient, Lookup, LookupAnswer, LookupParams } from "@/lib/places/geoapify";
import { isCategoryFor, isWithinRadius } from "@/lib/places/match";
import { namedVenueIn, type MealLine, type NamedVenue } from "@/lib/places/venue";
import {
  candidatesIn,
  createAreaVerifier,
  createNameVerifier,
  type PlaceCheck,
  type PlaceToCheck,
} from "@/lib/places/verify-place";
import { GeneratedPlaceSchema, isAreaKind, type DayRequest } from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import type { DayRoundRun } from "./day-round";
import { lookupsFor, table, type PlaceScope } from "./round";
import {
  accentedSpellingsIn,
  lostAccentsIn,
  needsAccent,
  type Spellings,
} from "@/lib/quality/lost-accents";
import { isVerified } from "./tally";

export { isVerified };

/**
 * The places of a live day round, checked on Geoapify once the days are written
 * (`docs/harness.md`, "The prompt versions", `day-v3`). The round checks every place itself, a
 * stop's or an option's, in each day, as the route does: a coffee, food or bar place by the places
 * of its kind around its point, every other kind by its name. A shadow's places are not checked:
 * they took two fifths of a round's lookups, and every credit comes out of the day's free plan that
 * production shares (`FREE_PLAN_DAILY_CREDITS`). A meal's name and lines are read for a café,
 * restaurant or bar they name, the venue Lantern never names, among the places around it and
 * the geocoder's answers for its name (`src/lib/places/venue.ts`); its area's counts calibrate
 * the area check's radius and threshold. Each lookup costs one credit, and
 * every answer is kept with the parameters it was asked with (the key is never among them), so
 * a changed rule can score them again for nothing.
 */

type DayRole = Exclude<CallRole, "intake">;

/** A written day or shadow whose places the round checks. */
export interface DayToCheck {
  index: number;
  role: DayRole;
  request: DayRequest;
  outputText: string;
}

/** The days and shadows whose places a round checks (`PlaceScope`), in the order of its requests. */
export function daysToCheck(
  runs: readonly DayRoundRun[],
  scope: PlaceScope = "days",
): DayToCheck[] {
  if (scope === "none") return [];
  return runs.flatMap(({ index, body, day, shadow }) => {
    const isDayChecked = scope === "days" || scope === "both";
    const isShadowChecked = scope === "shadows" || scope === "both";
    const records: [DayRole, GenerationRecord | null][] = [
      ["day", isDayChecked && day?.role === "day" ? day : null],
      ["shadow", isShadowChecked && shadow?.role === "shadow" ? shadow : null],
    ];
    return records.flatMap(([role, record]) =>
      record === null ? [] : [{ index, role, request: body, outputText: record.outputText }],
    );
  });
}

// Loose: a place carries more than the checks read, and a day the normalizer refused, such as
// one whose stops closed empty, still has its places read. Its lines are read where they stand.
const PlaceFieldsSchema = z.object({
  ...GeneratedPlaceSchema.pick({
    name: true,
    kind: true,
    neighborhood: true,
    coordinates: true,
  }).shape,
  summary: z.string().optional(),
  sensory: z.object({ texture: z.string().optional() }).optional(),
  light: z.object({ note: z.string().optional() }).optional(),
  aesthetic: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

/** A place as the round reads it: what the checks look up, and its lines. */
export type PlaceRead = z.infer<typeof PlaceFieldsSchema>;

/** A place in a day, and where it stands there. */
export interface PlaceInDay {
  /** As the quality checks name a field: `stops[2].place`, `alternatives[1].options[0]`. */
  path: string;
  place: PlaceRead;
}
const LooseDaySchema = z.object({
  stops: z.array(z.object({ place: z.unknown() })),
  alternatives: z.array(z.object({ options: z.array(z.unknown()) })),
});

function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The places in a day as the model wrote it, stops first, or null when its output is not a
 * whole day, as a stream cut short is not. A place whose fields cannot be read is left out.
 * Letters escaped twice are read as the visitor is shown them, so a name is looked up as
 * "Castillo de Santa Bárbara", not "Castillo de Santa B\u00e1rbara".
 */
export function placesIn(outputText: string): PlaceInDay[] | null {
  const day = LooseDaySchema.safeParse(withLettersUnescaped(jsonOf(outputText)));
  if (!day.success) return null;
  const places = [
    ...day.data.stops.map(({ place }, index) => ({ path: `stops[${index}].place`, place })),
    ...day.data.alternatives.flatMap(({ options }, setIndex) =>
      options.map((place, index) => ({
        path: `alternatives[${setIndex}].options[${index}]`,
        place,
      })),
    ),
  ];
  return places.flatMap(({ path, place }) => {
    const fields = PlaceFieldsSchema.safeParse(place);
    return fields.success ? [{ path, place: fields.data }] : [];
  });
}

/** One lookup a place's check made, as asked and as answered. */
export interface RecordedLookup {
  endpoint: keyof GeoapifyClient;
  params: LookupParams;
  answer: LookupAnswer;
}

export interface CheckedPlace {
  index: number;
  role: DayRole;
  city: string;
  path: string;
  place: PlaceInDay["place"];
  /** A coffee, food or bar place, which the route checks by its area. */
  isMeal: boolean;
  /** A meal's area check; null for any other place, which is checked by its name alone. */
  area: PlaceCheck | null;
  /** Places of a meal's kind within its area's radius, up to a page; null for any other place or when the lookup failed. */
  placesAround: number | null;
  /** The name rule's ending, the route's check for any place but a meal. */
  byName: PlaceCheck;
  /** The provider's name for what the name rule confirmed; null when it confirmed nothing, and for a meal. */
  matchedName: string | null;
  /** A venue a meal's name or lines name; null when they name none, and for any other place. */
  venue: NamedVenue | null;
  lookups: RecordedLookup[];
}

function recorded(endpoint: keyof GeoapifyClient, lookup: Lookup, into: RecordedLookup[]): Lookup {
  return async (params, signal) => {
    const answer = await lookup(params, signal);
    into.push({ endpoint, params, answer });
    return answer;
  };
}

function bodyFrom(lookups: readonly RecordedLookup[], endpoint: keyof GeoapifyClient): unknown {
  const answer = lookups.find((lookup) => lookup.endpoint === endpoint)?.answer;
  return answer?.ok === true ? answer.body : undefined;
}

function matchedNameOf(
  place: PlaceToCheck,
  byName: PlaceCheck,
  lookups: readonly RecordedLookup[],
): string | null {
  if (byName.kind !== "verified" || byName.by !== "name") return null;
  const candidates = candidatesIn(place, bodyFrom(lookups, "geocode")) ?? [];
  const match = candidates.find(({ result }) => result.place_id === byName.providerId);
  return match?.names[0] ?? null;
}

async function areaOf(
  { kind, coordinates }: PlaceToCheck,
  client: GeoapifyClient,
  lookups: RecordedLookup[],
): Promise<{ area: PlaceCheck | null; placesAround: number | null }> {
  if (!isAreaKind(kind)) return { area: null, placesAround: null };
  const area = { kind, coordinates };
  const check = await createAreaVerifier(recorded("places", client.places, lookups)).verify(area);
  const body = bodyFrom(lookups, "places");
  return { area: check, placesAround: body === undefined ? null : placesAroundIn(area, body) };
}

/** A meal's lines by field, in the order a reader meets them. */
function linesOf({ summary, sensory, light, aesthetic, reason }: PlaceRead): MealLine[] {
  const lines = [
    { field: "summary", text: summary },
    { field: "sensory.texture", text: sensory?.texture },
    { field: "light.note", text: light?.note },
    ...(aesthetic ?? []).map((text, index) => ({ field: `aesthetic[${index}]`, text })),
    { field: "reason", text: reason },
  ];
  return lines.flatMap(({ field, text }) => (text === undefined ? [] : [{ field, text }]));
}

/**
 * The venues a meal's words could name: the places of its kind around its point, and the
 * geocoder's answers for its name that stand within its kind's radius and are of its kind.
 */
function venuesNear(place: PlaceRead, lookups: readonly RecordedLookup[]): string[] {
  if (!isAreaKind(place.kind)) return [];
  const area = { kind: place.kind, coordinates: place.coordinates };
  const around = namesAroundIn(area, bodyFrom(lookups, "places"));
  const geocoded = (candidatesIn(place, bodyFrom(lookups, "geocode")) ?? [])
    .filter(
      (candidate) =>
        isWithinRadius(place.kind, candidate.meters) && isCategoryFor(place.kind, candidate),
    )
    .flatMap(({ names }) => names);
  return [...new Set([...around, ...geocoded])];
}

async function checkPlace(
  day: DayToCheck,
  { path, place }: PlaceInDay,
  client: GeoapifyClient,
): Promise<CheckedPlace> {
  const lookups: RecordedLookup[] = [];
  const city = { city: day.request.city };
  const [{ area, placesAround }, byName] = await Promise.all([
    areaOf(place, client, lookups),
    createNameVerifier(recorded("geocode", client.geocode, lookups)).verify(place, city),
  ]);
  return {
    index: day.index,
    role: day.role,
    city: city.city,
    path,
    place,
    isMeal: area !== null,
    area,
    placesAround,
    byName,
    matchedName: area === null ? matchedNameOf(place, byName, lookups) : null,
    venue:
      area === null ? null : namedVenueIn(place, city, linesOf(place), venuesNear(place, lookups)),
    lookups,
  };
}

export interface PlaceRoundOptions {
  /** The most lookups the places may take, the plan's cap. */
  maxLookups: number;
  onCheck?: (check: CheckedPlace) => void;
}

export interface PlaceRound {
  checks: CheckedPlace[];
  /** Days and shadows whose output is not a whole day to read places from. */
  unread: Pick<DayToCheck, "index" | "role">[];
  /** Places left unchecked once the cap was reached. */
  unchecked: number;
  maxLookups: number;
}

/**
 * Places checked side by side: at most eight lookups in flight, which the client's queue of
 * five a second starts within two seconds, far inside the 10 s after which it answers a waiting
 * lookup as timed out.
 */
const PLACES_AT_ONCE = 4;

function inGroups<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, group) =>
    items.slice(group * size, (group + 1) * size),
  );
}

/** Every place of every day given, a few at a time, in the order of the days and their places. */
export async function runPlaceChecks(
  client: GeoapifyClient,
  days: readonly DayToCheck[],
  { maxLookups, onCheck }: PlaceRoundOptions,
): Promise<PlaceRound> {
  const round: PlaceRound = { checks: [], unread: [], unchecked: 0, maxLookups };
  let lookups = 0;
  for (const day of days) {
    const places = placesIn(day.outputText);
    if (places === null) {
      round.unread.push({ index: day.index, role: day.role });
      continue;
    }
    const allowed = places.filter(({ place }) => {
      const needed = lookupsFor(place.kind);
      if (lookups + needed > maxLookups) {
        round.unchecked += 1;
        return false;
      }
      lookups += needed;
      return true;
    });
    for (const group of inGroups(allowed, PLACES_AT_ONCE)) {
      const checks = await Promise.all(group.map((place) => checkPlace(day, place, client)));
      for (const check of checks) {
        round.checks.push(check);
        onCheck?.(check);
      }
    }
  }
  return round;
}

/** Bands of a count of places around: under the threshold, a few, many, and a full page. */
const COUNT_BANDS: readonly { label: string; from: number; to: number }[] = [
  { label: "0", from: 0, to: 0 },
  { label: `1–${MIN_PLACES_AROUND - 1}`, from: 1, to: MIN_PLACES_AROUND - 1 },
  // Five and ten split the counts that pass into a few, some and many; a reader marks where
  // the right areas and the wrong ones part, and these only make that visible.
  { label: `${MIN_PLACES_AROUND}–5`, from: MIN_PLACES_AROUND, to: 5 },
  { label: "6–10", from: 6, to: 10 },
  { label: `11–${PLACES_PER_LOOKUP - 1}`, from: 11, to: PLACES_PER_LOOKUP - 1 },
  { label: String(PLACES_PER_LOOKUP), from: PLACES_PER_LOOKUP, to: PLACES_PER_LOOKUP },
];

const ROLES: readonly { role: DayRole; label: string }[] = [
  { role: "day", label: "days" },
  { role: "shadow", label: "shadows" },
];

/**
 * The roles a round's report lists: those it checked or could not read. A round checks its days
 * alone since 2026-11-02; one saved before, with its shadows, is read again with both.
 */
function rolesIn(round: Pick<PlaceRound, "checks" | "unread">): typeof ROLES {
  const seen = new Set([...round.checks, ...round.unread].map(({ role }) => role));
  return ROLES.filter(({ role }) => seen.has(role));
}

const PERCENT = 100;

/** "12 of 30 (40%)", or "0 of 0" with no share to give. */
function share(checks: readonly CheckedPlace[], test: (check: CheckedPlace) => boolean): string {
  const count = checks.filter(test).length;
  const of = `${count} of ${checks.length}`;
  return checks.length === 0 ? of : `${of} (${Math.round((count / checks.length) * PERCENT)}%)`;
}

const isStop = ({ path }: CheckedPlace): boolean => path.startsWith("stops");

function verifiedRow(label: string, checks: readonly CheckedPlace[]): string[] {
  const named = checks.filter(({ isMeal }) => !isMeal);
  const meals = checks.filter(({ isMeal }) => isMeal);
  return [
    label,
    share(checks, isVerified),
    share(checks.filter(isStop), isVerified),
    share(
      checks.filter((check) => !isStop(check)),
      isVerified,
    ),
    share(named, isVerified),
    share(meals, isVerified),
  ];
}

/** How the name rule left the places it is the route's check for, by its endings. */
function nameEndings(checks: readonly CheckedPlace[]): string {
  const endings = checks
    .filter(({ isMeal }) => !isMeal)
    .map(({ byName }) => (byName.kind === "verified" ? null : byName.reason))
    .filter((reason) => reason !== null);
  const counts = new Map<string, number>();
  for (const reason of endings) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return counts.size === 0
    ? "none"
    : [...counts].map(([reason, count]) => `${reason} ${count}`).join(", ");
}

function countRow(label: string, meals: readonly CheckedPlace[]): string[] {
  const counts = meals.map(({ placesAround }) => placesAround);
  return [
    label,
    ...COUNT_BANDS.map(({ from, to }) =>
      String(counts.filter((count) => count !== null && count >= from && count <= to).length),
    ),
    String(counts.filter((count) => count === null).length),
  ];
}

function venueLine({ index, role, city, path, place, venue }: CheckedPlace): string {
  return `    ${role} ${index} · ${city} · ${path} · ${place.kind} "${place.name}" → "${venue?.venue}" in ${venue?.field}`;
}

function notesOf(round: PlaceRound): string {
  const notes = [
    ...(round.unchecked > 0
      ? [`${round.unchecked} places left unchecked past the cap of ${round.maxLookups} lookups`]
      : []),
    ...(round.unread.length > 0
      ? [
          `no whole day to read in ${round.unread.map((day) => `${day.role} ${day.index}`).join(", ")}`,
        ]
      : []),
  ];
  return notes.map((note) => `; ${note}`).join("");
}

/** The fields a visitor reads a place's name in: its row's name, and the quarter under it. */
const NAME_FIELDS: readonly { field: "name" | "neighborhood"; label: string }[] = [
  { field: "name", label: "names" },
  { field: "neighborhood", label: "quarters" },
];

/** Each city's spellings, from every answer its places' lookups got. */
function spellingsByCity(checks: readonly CheckedPlace[]): Map<string, Spellings> {
  const answers = new Map<string, unknown[]>();
  for (const { city, lookups } of checks) {
    const bodies = lookups.flatMap(({ answer }) => (answer.ok ? [answer.body] : []));
    answers.set(city, [...(answers.get(city) ?? []), ...bodies]);
  }
  return new Map([...answers].map(([city, bodies]) => [city, accentedSpellingsIn(bodies)]));
}

/**
 * Names and quarters written without an accent Geoapify gives them, of those with a word it
 * writes accented, by role and city (`lost-accents.ts`), and the words left plain.
 */
function accentLines(checks: readonly CheckedPlace[], roles: typeof ROLES): string[] {
  const spellings = spellingsByCity(checks);
  const cities = [...spellings.keys()];
  const of = ({ city }: CheckedPlace): Spellings => spellings.get(city) ?? new Map();
  const rows = roles.flatMap(({ role, label }) =>
    NAME_FIELDS.map(({ field, label: fieldLabel }) => {
      const ofRole = checks.filter((check) => check.role === role);
      const needing = ofRole.filter((check) => needsAccent(check.place[field], of(check)));
      const isLost = (check: CheckedPlace): boolean =>
        lostAccentsIn(check.place[field], of(check)).length > 0;
      const days = new Set(ofRole.map(({ index }) => index));
      const daysLost = new Set(needing.filter(isLost).map(({ index }) => index));
      return [
        `${label}, ${fieldLabel}`,
        share(needing, isLost),
        `${daysLost.size} of ${days.size}`,
        ...cities.map((city) =>
          share(
            needing.filter((check) => check.city === city),
            isLost,
          ),
        ),
      ];
    }),
  );
  const words = new Set(
    checks.flatMap((check) =>
      NAME_FIELDS.flatMap(({ field }) => lostAccentsIn(check.place[field], of(check))),
    ),
  );
  return [
    "  Names written without an accent Geoapify gives them, of those with a word it writes accented (a macron alone is English's to drop):",
    ...table([["", "all", "days with one", ...cities], ...rows], "    "),
    `  Left plain: ${words.size === 0 ? "none" : [...words].sort().join(", ")}.`,
  ];
}

/**
 * The places as a reader takes them in: how many the route would show verified, the meals'
 * own measures, the places around them and the venues their words name, and the names that
 * left an accent off.
 */
export function placeReport(round: PlaceRound): string[] {
  const roles = rolesIn(round);
  const of = (role: DayRole) => round.checks.filter((check) => check.role === role);
  const mealsOf = (role: DayRole) => of(role).filter(({ isMeal }) => isMeal);
  const lookups = round.checks.flatMap((check) => check.lookups);
  const failed = lookups.filter(({ answer }) => !answer.ok).length;
  const venues = round.checks.filter(({ venue }) => venue !== null);
  return [
    "Places, checked on Geoapify once the days were written:",
    `  ${roles.map(({ role, label }) => `${of(role).length} in the ${label} (${mealsOf(role).length} meals)`).join(", ")}; ${lookups.length} lookups, ${failed} failed${notesOf(round)}.`,
    "  Verified as the route would check them, a meal by its area and any other place by its name:",
    ...table(
      [
        ["", "all", "stops", "options", "by name", "meals by area"],
        ...roles.map(({ role, label }) => verifiedRow(label, of(role))),
      ],
      "    ",
    ),
    `  Left unverified by name: ${roles.map(({ role, label }) => `${label} ${nameEndings(of(role))}`).join("; ")}.`,
    `  Places of its kind within ${AREA_RADIUS_METERS} m of each meal's point; the area check confirms at ${MIN_PLACES_AROUND}:`,
    ...table(
      [
        ["places", ...COUNT_BANDS.map(({ label }) => label), "failed"],
        ...roles.map(({ role, label }) => countRow(label, mealsOf(role))),
      ],
      "    ",
    ),
    `  Meals whose name or lines name a café, restaurant or bar of the provider's: ${roles.map(({ role, label }) => `${mealsOf(role).filter(({ venue }) => venue !== null).length} of ${mealsOf(role).length} in the ${label}`).join(", ")}.`,
    ...venues.map(venueLine),
    ...accentLines(round.checks, roles),
  ];
}

function endingOf(check: PlaceCheck): string {
  return check.kind === "verified" ? "verified" : check.reason;
}

function nameColumn({ isMeal, byName, matchedName, venue }: CheckedPlace): string {
  if (isMeal) return venue === null ? "no venue" : `venue "${venue.venue}" in ${venue.field}`;
  return matchedName === null ? endingOf(byName) : `verified "${matchedName}"`;
}

/**
 * Every place on its own line, for a reader to mark each meal's area right or wrong and each
 * place real or not.
 */
export function placeTable(round: PlaceRound): string[] {
  return table(
    [
      [
        "#",
        "role",
        "city",
        "where",
        "kind",
        "name",
        "neighbourhood",
        "places",
        "area",
        "name rule",
      ],
      ...round.checks.map((check) => [
        String(check.index),
        check.role,
        check.city,
        check.path,
        check.place.kind,
        check.place.name,
        check.place.neighborhood,
        check.placesAround === null ? "" : String(check.placesAround),
        check.area === null ? "" : endingOf(check.area),
        nameColumn(check),
      ]),
    ],
    "",
  );
}
