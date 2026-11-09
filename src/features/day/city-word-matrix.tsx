import {
  PORTLAND_MAINE,
  PORTLAND_OREGON,
  SAINT_PETERSBURGS,
  SPRINGFIELDS,
} from "@/lib/fixtures/city-readings";
import { BOLOGNA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import type { CityReading } from "@/lib/schema/intake.schema";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { CityWordCell, type CityWordCellProps } from "./city-word-cell";

/** A lively night out, as the intake reads "… out late with friends", in a reading's city. */
function nightOutIn(reading: CityReading, citySource: DayRequest["citySource"]): DayRequest {
  return {
    ...BOLOGNA_START_REQUEST,
    city: reading.name,
    citySource,
    timezone: reading.timezone,
    end: "late",
  };
}

/** A city typed in the list, and a text typed there that names none. */
const TYPED = "Porto";
const NOT_A_CITY = "somewhere warm";

const [SPRINGFIELD_MASSACHUSETTS = PORTLAND_OREGON] = SPRINGFIELDS.slice(-1);
const [SAINT_PETERSBURG_RUSSIA = PORTLAND_OREGON] = SAINT_PETERSBURGS;

/**
 * The city word as each source leaves it: a written day, a city the visitor named, a city
 * Lantern assumed as the likeliest its name could mean, another of those chosen, three of
 * them with the longest region, and a long name. With live generation off no day can be played
 * for an assumed city, so this is where to see one whole.
 */
export const CITY_WORD_MATRIX: LabMatrix = labMatrix<CityWordCellProps>({
  key: "city-word",
  title: "City word",
  note: "The city in the sentence, dotted when Lantern assumed it, with the cities its name could mean",
  base: {
    request: BOLOGNA_START_REQUEST,
    readings: [],
    playedReading: null,
    isOpen: false,
    typedCity: null,
  },
  axes: [
    {
      name: "city",
      values: [
        { label: "a written day", props: { request: BOLOGNA_START_REQUEST } },
        {
          label: "named by the visitor",
          props: { request: nightOutIn(PORTLAND_OREGON, "chosen") },
        },
        {
          label: "assumed, the likeliest of two",
          props: {
            request: nightOutIn(PORTLAND_OREGON, "assumed"),
            readings: [PORTLAND_OREGON, PORTLAND_MAINE],
            playedReading: PORTLAND_OREGON.placeId,
          },
        },
        {
          label: "the other one, chosen",
          props: {
            request: nightOutIn(PORTLAND_MAINE, "chosen"),
            readings: [PORTLAND_OREGON, PORTLAND_MAINE],
            playedReading: PORTLAND_MAINE.placeId,
          },
        },
        {
          label: "chosen from three, the longest region",
          props: {
            request: nightOutIn(SPRINGFIELD_MASSACHUSETTS, "chosen"),
            readings: SPRINGFIELDS,
            playedReading: SPRINGFIELD_MASSACHUSETTS.placeId,
          },
        },
        {
          label: "assumed, a long name",
          props: {
            request: nightOutIn(SAINT_PETERSBURG_RUSSIA, "assumed"),
            readings: SAINT_PETERSBURGS,
            playedReading: SAINT_PETERSBURG_RUSSIA.placeId,
          },
        },
      ],
    },
    {
      name: "list",
      values: [
        { label: "closed", props: { isOpen: false } },
        { label: "open", props: { isOpen: true } },
      ],
    },
    {
      // Once live, a city typed in the open list that Lantern has not written is read first.
      name: "typed city",
      values: [
        { label: "none", props: { typedCity: null } },
        { label: "being read", props: { typedCity: { name: TYPED, failure: null } } },
        { label: "no city in it", props: { typedCity: { name: NOT_A_CITY, failure: "no-city" } } },
        { label: "refused", props: { typedCity: { name: TYPED, failure: "refused" } } },
        { label: "our limit", props: { typedCity: { name: TYPED, failure: "limited" } } },
        { label: "not read", props: { typedCity: { name: TYPED, failure: "unavailable" } } },
      ],
    },
  ],
  render: (props) => <CityWordCell {...props} />,
  // Each city against the list closed and open, and each typed city against the same, so
  // the six moments of a typed city are shot in the open list.
  baseline: [
    { rows: 0, columns: 1 },
    { rows: 2, columns: 1 },
  ],
});
