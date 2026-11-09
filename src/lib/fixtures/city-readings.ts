import type { CityReading } from "@/lib/schema/intake.schema";

/**
 * Cities a shared name can mean, as the resolver gives them, for the lab's canned readings,
 * the city word's matrix and their tests. The place ids are the lab's own, not Geoapify's.
 */

export const PORTLAND_OREGON: CityReading = {
  placeId: "lab-portland-oregon",
  name: "Portland",
  region: "Oregon, United States",
  timezone: "America/Los_Angeles",
};

export const PORTLAND_MAINE: CityReading = {
  placeId: "lab-portland-maine",
  name: "Portland",
  region: "Maine, United States",
  timezone: "America/New_York",
};

/** Three cities of one name, two of them in one zone: told apart only by the place id. */
export const SPRINGFIELDS: readonly CityReading[] = [
  {
    placeId: "lab-springfield-illinois",
    name: "Springfield",
    region: "Illinois, United States",
    timezone: "America/Chicago",
  },
  {
    placeId: "lab-springfield-missouri",
    name: "Springfield",
    region: "Missouri, United States",
    timezone: "America/Chicago",
  },
  {
    placeId: "lab-springfield-massachusetts",
    name: "Springfield",
    region: "Massachusetts, United States",
    timezone: "America/New_York",
  },
];

/** A long name, which on a phone can begin a line of the sentence on its own. */
export const SAINT_PETERSBURGS: readonly CityReading[] = [
  {
    placeId: "lab-saint-petersburg-russia",
    name: "Saint Petersburg",
    region: "Russia",
    timezone: "Europe/Moscow",
  },
  {
    placeId: "lab-saint-petersburg-florida",
    name: "Saint Petersburg",
    region: "Florida, United States",
    timezone: "America/New_York",
  },
];
