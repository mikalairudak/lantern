import { AROUND_DAY } from "./around";
import { CROWDED_DAY } from "./crowded";
import type { EdgeDay } from "./edge-day";
import { LATE_NIGHT_DAY } from "./late-night";
import { LONG_STAY_DAY } from "./long-stay";
import { MINIMAL_DAY } from "./minimal";
import { NEVER_QUIET_DAY } from "./never-quiet";
import { MIDNIGHT_SUN_DAY, POLAR_NIGHT_DAY } from "./polar";
import { REPAIRED_DAY } from "./repaired";

export {
  AROUND_DAY,
  CROWDED_DAY,
  LATE_NIGHT_DAY,
  LONG_STAY_DAY,
  MIDNIGHT_SUN_DAY,
  MINIMAL_DAY,
  NEVER_QUIET_DAY,
  POLAR_NIGHT_DAY,
  REPAIRED_DAY,
};
export { REFUSED_DAY } from "./refused";

/**
 * Every edge day the normalizer turns into an itinerary. The refused day is not here: it
 * has no itinerary, so it is exported on its own.
 */
export const EDGE_DAYS: readonly EdgeDay[] = [
  MINIMAL_DAY,
  LONG_STAY_DAY,
  CROWDED_DAY,
  POLAR_NIGHT_DAY,
  MIDNIGHT_SUN_DAY,
  LATE_NIGHT_DAY,
  REPAIRED_DAY,
  AROUND_DAY,
  NEVER_QUIET_DAY,
];
