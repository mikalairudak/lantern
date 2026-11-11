import { normalizedDayOf, writtenSeasonsAt } from "@/lib/days/written/days";
import { DAY_LINK_DAYS, isDayId, type StoredDay } from "@/lib/days/stored-day";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { mergeReplan } from "@/lib/replan/merge";
import { replanIdPrefix } from "@/lib/replan/request";
import { GeneratedDaySchema, type DayRequest, type Itinerary } from "@/lib/schema/itinerary.schema";
import { GeneratedReplanSchema } from "@/lib/schema/replan.schema";
import { withLettersUnescaped } from "@/lib/stream/escaped-letters";
import { placeCheckOf, withProviderPoints, type PlaceCheck } from "@/lib/stream/place-checks";
import { salvagedDay } from "@/lib/stream/read-day-stream";
import type { LiveEnv } from "./flag";
import type { DayArchive, KeptRecord, ReplanContext } from "./generation-log";
import { storesFor } from "./stores";
import { replannedIdOf } from "@/lib/schema/positions";

/**
 * Days kept to be opened again (`src/lib/days/stored-day.ts`), read back from the generation
 * log for `GET /api/day/<id>` and the page that opens one. Server only: it reads the database.
 */

if (typeof window !== "undefined") {
  throw new Error("src/lib/live/stored-days.ts reads the database and runs only on the server");
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_SECOND = 1000;

function parsedOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface Shown {
  itinerary: Itinerary;
  checks: Record<string, PlaceCheck>;
}

/**
 * A day's record as the visitor was shown it: the whole day normalized with each place
 * confirmed by name at the provider's point, as the reader makes it at the stream's close;
 * a cut the salvage rule kept a day of, at the model's points, as a cut is shown. Anything
 * else showed no day.
 */
async function shownDayOf(record: KeptRecord, request: DayRequest): Promise<Shown | null> {
  const checks = record.placeChecks ?? {};
  const day =
    record.outcome === "complete"
      ? GeneratedDaySchema.safeParse(parsedOrNull(record.outputText)).data
      : record.salvaged === true
        ? await salvagedDay(record.outputText)
        : undefined;
  if (day === undefined || day === null) return null;
  const normalized = normalizeDay(request, withLettersUnescaped(day));
  if (!normalized.ok) return null;
  const isWhole = record.outcome === "complete";
  const checked = new Map(Object.entries(checks));
  return {
    itinerary: isWhole ? withProviderPoints(normalized.itinerary, checked) : normalized.itinerary,
    checks,
  };
}

/**
 * A re-plan's record as the visitor was shown it: the re-plan merged into the day it read, kept
 * in `context`, its places' checks under the round's prefix as the merged day holds them. A
 * re-plan is all or nothing, so one that did not finish showed no new day. A record whose day
 * the server did not read itself, written before it did, held a client's day and words of the
 * client's choosing (`docs/security.md`, S1), so it shows nothing.
 */
function shownReplanOf(record: KeptRecord, request: DayRequest): Shown | null {
  const { context } = record;
  if (context?.basis === undefined || record.outcome !== "complete") return null;
  const replan = GeneratedReplanSchema.safeParse(parsedOrNull(record.outputText));
  if (!replan.success) return null;
  const idPrefix = replanIdPrefix(context.round);
  const merged = mergeReplan({
    itinerary: context.itinerary,
    request,
    changed: context.changed,
    windows: context.windows,
    idPrefix,
    replan: withLettersUnescaped(replan.data),
  });
  if (!merged.ok) return null;
  const checks = ownChecksOf(record);
  return {
    itinerary: withProviderPoints(merged.itinerary, new Map(Object.entries(checks))),
    checks,
  };
}

/** How many re-plans a record's day has taken: none for a live day, its round for a re-plan's. */
function roundOf(record: KeptRecord): number {
  return record.context?.round ?? 0;
}

/**
 * A record's own places' checks, by their ids in its day: a live day's as its stream keyed
 * them, a re-plan's under its round's prefix, as the merged day holds its new places.
 */
function ownChecksOf(record: KeptRecord): Record<string, PlaceCheck> {
  const checks = record.placeChecks ?? {};
  if (record.context === undefined) return checks;
  const idPrefix = replanIdPrefix(record.context.round);
  return Object.fromEntries(
    Object.entries(checks).map(([id, check]) => [
      replannedIdOf(idPrefix, id),
      { ...check, placeId: replannedIdOf(idPrefix, id) },
    ]),
  );
}

/** Each place of a day by its id, every version of each stop included, with its name. */
function placeNamesOf(itinerary: Itinerary): Map<string, string> {
  const places = itinerary.stops.flatMap((stop) => [stop.primary, ...stop.alternatives]);
  return new Map(places.map(({ id, name }) => [id, name]));
}

/**
 * The checks a written day's run recorded (`src/lib/days/written/checks.ts`), as its page
 * plays them, for the places of the day as a re-plan read it from its file, from the first of
 * the city's seasons whose day holds that place under that name. A place no season's file, written
 * again since, holds under that name at that id takes none: its check is another place's.
 */
function writtenChecksFor(slug: string, read: Itinerary): Record<string, PlaceCheck> {
  const namesRead = placeNamesOf(read);
  const found: Record<string, PlaceCheck> = {};
  for (const { written, checks } of writtenSeasonsAt(slug) ?? []) {
    const names = placeNamesOf(normalizedDayOf(written).itinerary);
    for (const [id, result] of Object.entries(checks)) {
      const name = names.get(id);
      const isSamePlace = name !== undefined && name === namesRead.get(id);
      if (isSamePlace && found[id] === undefined) found[id] = placeCheckOf(id, result);
    }
  }
  return found;
}

/**
 * The checks of the days a re-plan was made from, back to the live or written day the re-plans
 * began with, each earlier re-plan's under its own round's prefix: what the page held of them
 * when it merged (`src/features/day/day.tsx`). Each basis is read as its record, never as its
 * link opens it, since one past its link's days still holds the checks the visitor saw. The
 * walk ends at a live day or a written one, and at a basis the log does not hold, that cannot
 * be an id, or that has taken as many re-plans as the day read from it, so it never loops.
 */
async function basisChecksOf(
  context: ReplanContext,
  archive: DayArchive,
): Promise<Record<string, PlaceCheck>> {
  let checks: Record<string, PlaceCheck> = {};
  let reading = context;
  for (;;) {
    const { basis } = reading;
    if (basis === undefined) return checks;
    if (basis.kind === "written") {
      return { ...writtenChecksFor(basis.slug, reading.itinerary), ...checks };
    }
    if (!isDayId(basis.id)) return checks;
    const record = await archive.dayRecordOf(basis.id);
    if (record === null || roundOf(record) >= reading.round) return checks;
    checks = { ...ownChecksOf(record), ...checks };
    if (record.context === undefined) return checks;
    reading = record.context;
  }
}

/** Only the checks of places the day holds: a window's old places went with their stops. */
function checksOfPlacesIn(
  itinerary: Itinerary,
  checks: Record<string, PlaceCheck>,
): Record<string, PlaceCheck> {
  const places = placeNamesOf(itinerary);
  return Object.fromEntries(Object.entries(checks).filter(([id]) => places.has(id)));
}

/** A record as `GET /api/day/<id>` answers it; no record is a day not written yet. */
async function storedDayOfRecord(record: KeptRecord | null, now: Date): Promise<StoredDay> {
  if (record === null || record.request === null) return { status: "unknown" };
  const { request } = record;
  const writtenAt = new Date(Date.parse(record.startedAt) + record.msToFinish);
  if (now.getTime() - writtenAt.getTime() > DAY_LINK_DAYS * MS_PER_DAY) {
    return { status: "expired", request };
  }
  const shown =
    record.context === undefined
      ? await shownDayOf(record, request)
      : shownReplanOf(record, request);
  if (shown === null) return { status: "failed", request };
  return {
    status: record.outcome === "complete" ? "written" : "cut",
    request,
    ...shown,
    writtenAt: writtenAt.toISOString(),
    seconds: Math.round(record.msToFinish / MS_PER_SECOND),
    round: roundOf(record),
  };
}

/**
 * The day kept under `id`, as `GET /api/day/<id>` answers it (`StoredDay`): written or cut with
 * the day the visitor was shown, failed, unknown while no record holds it, or expired once its
 * link's `DAY_LINK_DAYS` have passed since it was written. A record is written as its stream
 * ends, so a day still being written is unknown until then. A re-plan's day carries its round
 * and, beside its new places' checks, its kept places' from the days it was made from, read
 * from their records (`basisChecksOf`): one more read for each round.
 */
export async function readStoredDay(
  id: string,
  archive: DayArchive,
  now: Date,
): Promise<StoredDay> {
  const record = await archive.dayRecordOf(id);
  const stored = await storedDayOfRecord(record, now);
  const context = record?.context;
  if (stored.status !== "written" || context === undefined) return stored;
  const kept = checksOfPlacesIn(stored.itinerary, await basisChecksOf(context, archive));
  return { ...stored, checks: { ...kept, ...stored.checks } };
}

/** A kept day as a re-plan reads it: the day as shown, its request, and the re-plans in it. */
export interface KeptBasis {
  request: DayRequest;
  itinerary: Itinerary;
  /** How many re-plans the day has taken: none for a live day, its round for a re-plan's. */
  round: number;
}

/**
 * The day kept under `id` as a re-plan's basis, when it is one the visitor saw written whole;
 * otherwise its status (`unknown` while its record has not landed). One read of the log.
 */
export async function keptBasisOf(
  id: string,
  archive: DayArchive,
  now: Date,
): Promise<{ kind: "kept"; basis: KeptBasis } | { kind: "not-kept"; status: StoredDay["status"] }> {
  const record = await archive.dayRecordOf(id);
  const stored = await storedDayOfRecord(record, now);
  if (stored.status !== "written") return { kind: "not-kept", status: stored.status };
  const round = record?.context?.round ?? 0;
  return { kind: "kept", basis: { request: stored.request, itinerary: stored.itinerary, round } };
}

/**
 * The day kept under `id`, from the stores this deployment counts and logs in: what the route
 * and the page that opens a day both call. A string that cannot be an id is `unknown`, never a
 * query: the column is a UUID, and the page passes on whatever its path holds.
 */
export function storedDayOf(id: string, env: LiveEnv = process.env): Promise<StoredDay> {
  if (!isDayId(id)) return Promise.resolve({ status: "unknown" });
  return readStoredDay(id, storesFor(env).dayArchive, new Date());
}
