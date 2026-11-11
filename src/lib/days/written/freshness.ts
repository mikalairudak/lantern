import { lightQuality, sunAltitude, utcOffsetMinutes, type LightQuality } from "@/lib/geo/sun";
import { checkLightSense, MIN_SHARE_IN_LIGHT_WINDOW } from "@/lib/quality/checks";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { parseClock } from "@/lib/time/clock";
import { daySlugOf } from "../address";
import { normalizedDayOf, normalizedDayOn, WRITTEN_SEASONS } from "./days";
import { firstStartOf } from "./requests";
import { firstSeasonOf, isInSeason, seasonOn, type WrittenSeason } from "./seasons";
import { cityClockOf, dateAfter, daysFrom, shownDateOf } from "./shown-date";
import type { WrittenDay } from "./written-day";

/**
 * How long a written day still holds as its dates move on (`docs/decisions.md`, "A city's written
 * day is one of its seasons, picked by the date it is shown on"). Code computes each date's sun,
 * so what goes stale is the plan's fit to the light, and the words written for the light of the
 * date the day was written for. Pure of the clock: `pnpm days:fresh` passes the instant.
 */

/**
 * The light a stop is in as the time axis draws it (`src/features/abacus/light.ts`): plain day,
 * golden hour, or dark from sunset on, blue hour and night alike. Soft and clear daylight are
 * one, since nothing on the page or in a day's words tells them apart.
 */
type AxisPhase = "day" | "golden" | "dark";

const AXIS_PHASES: Readonly<Record<LightQuality, AxisPhase>> = {
  clear: "day",
  soft: "day",
  golden: "golden",
  blue: "dark",
  dark: "dark",
};

/**
 * How many stops may begin in another light than on the day's own date while the day holds: as
 * the light-sense check does, one passes and two fail. One stop's move is often into light its
 * words still fit: Kanazawa's garden at half past seven, whose words speak of low sun through
 * the maples, is in golden hour by December.
 */
export const MAX_STOPS_IN_OTHER_LIGHT = 1;

/** How far ahead a day is followed: a year of its weekday's dates. */
const WEEKS_FOLLOWED = 52;
const DAYS_PER_WEEK = 7;

/** Fewer days than this before a city's day stops holding is a season to write now. */
export const DAYS_LEFT_TO_FLAG = 21;

/** Each stop's light at its start, at its planned place, on the itinerary's date. */
function phasesOf(itinerary: Itinerary): (AxisPhase | null)[] {
  const offset = utcOffsetMinutes(itinerary.timezone, itinerary.date);
  return itinerary.stops.map((stop) => {
    const start = parseClock(stop.startTime);
    if (start === null) return null;
    const place = stop.alternatives.find(({ id }) => id === stop.selectedPlaceId) ?? stop.primary;
    const context = { position: place.coordinates, date: itinerary.date, utcOffsetMinutes: offset };
    return AXIS_PHASES[lightQuality(sunAltitude(context, start))];
  });
}

/** What a written day reads on a date it is moved to. */
export interface DayOnDate {
  /** The light-sense check's share on that date. */
  lightSense: number;
  /** The stops whose light at their start is not the light of the day's own date. */
  stopsInOtherLight: number;
  holds: boolean;
}

/**
 * A written day moved to a date, as its page would show it there: whether its stops still meet
 * their light windows (`checkLightSense`, held to `MIN_SHARE_IN_LIGHT_WINDOW`), and how many
 * begin in another light than they were written in.
 */
export function dayOnDate(written: WrittenDay, date: string): DayOnDate {
  const asWritten = phasesOf(normalizedDayOf(written).itinerary);
  const moved = phasesOf(normalizedDayOn(written, date).itinerary);
  const stopsInOtherLight = moved.filter((phase, index) => phase !== asWritten[index]).length;
  const lightSense = checkLightSense({ ...written.request, date }, written.day).value ?? 0;
  return {
    lightSense,
    stopsInOtherLight,
    holds: lightSense >= MIN_SHARE_IN_LIGHT_WINDOW && stopsInOtherLight <= MAX_STOPS_IN_OTHER_LIGHT,
  };
}

/**
 * The last date, a week at a time from `from`, on which the day a city's page shows still
 * holds (`dayOnDate`), each date's day from the season it picks (`seasonOn`): the date before the
 * first one that fails, or the last of a year followed when none does. Null when the day fails
 * on `from` itself. `from` is a date its days are shown on.
 */
export function freshUntil(seasons: readonly WrittenSeason[], from: string): string | null {
  let last: string | null = null;
  for (let week = 0; week <= WEEKS_FOLLOWED; week++) {
    const date = dateAfter(from, week * DAYS_PER_WEEK);
    if (!dayOnDate(seasonOn(seasons, date).written, date).holds) return last;
    last = date;
  }
  return last;
}

/** A city's line in the freshness report. */
export interface CityFreshness {
  city: string;
  /** The date its page shows at the instant read. */
  shownOn: string;
  /** The season that date picks, and whether its range holds the date. */
  season: Pick<WrittenSeason, "from" | "through">;
  isInSeason: boolean;
  freshUntil: string | null;
  /** From today in the city to `freshUntil`; 0 when the day shown fails already. */
  daysLeft: number;
  isFlagged: boolean;
}

/** Each written city's freshness at an instant, in the order the starts offer them. */
export function freshnessAt(now: Date): CityFreshness[] {
  return WRITTEN_SEASONS.map((seasons) => {
    const start = firstSeasonOf(seasons).written.request;
    const shownOn = shownDateOf(start, firstStartOf(start), now);
    const season = seasonOn(seasons, shownOn);
    const until = freshUntil(seasons, shownOn);
    const today = cityClockOf(start.timezone, now).date;
    const daysLeft = until === null ? 0 : daysFrom(today, until);
    return {
      city: start.city,
      shownOn,
      season: { from: season.from, through: season.through },
      isInSeason: isInSeason(season, shownOn),
      freshUntil: until,
      daysLeft,
      isFlagged: daysLeft < DAYS_LEFT_TO_FLAG,
    };
  });
}

function seasonLabelOf({ season, isInSeason: isIn }: CityFreshness): string {
  const range = `season ${season.from} to ${season.through ?? "open"}`;
  return isIn ? range : `${range}, served past its end`;
}

function holdingOf({ freshUntil: until, shownOn, daysLeft }: CityFreshness): string {
  if (until === null) return `does not hold on ${shownOn}`;
  return `holds until ${until}, ${daysLeft} days left`;
}

/** The report `pnpm days:fresh` prints: a line a city, then the cities flagged, if any. */
export function freshnessReportOf(cities: readonly CityFreshness[]): string[] {
  const lines = cities.map((each) => {
    const flag = each.isFlagged ? "  FLAG" : "";
    return `${daySlugOf(each)}: shown ${each.shownOn}, ${seasonLabelOf(each)}, ${holdingOf(each)}${flag}`;
  });
  const flagged = cities.filter(({ isFlagged }) => isFlagged).map(({ city }) => city);
  const verdict =
    flagged.length === 0
      ? `Every written day holds for ${DAYS_LEFT_TO_FLAG} days or more.`
      : `Under ${DAYS_LEFT_TO_FLAG} days: ${flagged.join(", ")}. Each needs its next season written.`;
  return [...lines, verdict];
}
