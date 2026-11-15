import { ENERGY_LEVELS, type DayRequest, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import type { YourDay } from "./your-days";

/**
 * The visitor's own days for the ledger's matrix and its comparison in the lab: days of cities
 * across time zones, read at one fixed moment, so every date a row says is the same on any
 * machine. A plain module, so the server reads the matrix's axes.
 */

/** Sunday 15 November 2026, six in the evening in Alicante. */
export const LEDGER_NOW = new Date("2026-11-15T17:00:00Z");

const HOUR_MS = 3_600_000;

/** A request with nothing chosen beyond its energy, on the day the ledger is read. */
function requestOf(change: Partial<DayRequest>): DayRequest {
  return {
    city: "Alicante",
    date: "2026-11-15",
    timezone: "Europe/Madrid",
    citySource: "chosen",
    energy: "balanced",
    energySource: "chosen",
    travel: null,
    start: null,
    dinner: null,
    end: null,
    company: null,
    ...change,
  };
}

/** How a day's stops rise from its energy and fall back by the evening, a step either side. */
const SHAPE_STEPS = [-1, 0, 1, 0, -1, -2] as const;
/** The stops a day being written has so far. */
const STOPS_SO_FAR = 2;

/** A day's stops at its energy, as today's list draws them; the ledger does not read them. */
function shapeOf(energy: EnergyLevel): EnergyLevel[] {
  const at = ENERGY_LEVELS.indexOf(energy);
  return SHAPE_STEPS.map(
    (step) => ENERGY_LEVELS[Math.min(ENERGY_LEVELS.length - 1, Math.max(0, at + step))]!,
  );
}

/** One of the visitor's days, asked `hoursAgo` before `LEDGER_NOW`. */
function dayOf(
  id: string,
  hoursAgo: number,
  request: Partial<DayRequest>,
  change: Partial<YourDay> = {},
): YourDay {
  const asked = requestOf(request);
  const ending = change.ending ?? "written";
  const shape = shapeOf(asked.energy);
  return {
    id: `ledger-${id}`,
    request: asked,
    startedAt: new Date(LEDGER_NOW.getTime() - hoursAgo * HOUR_MS).toISOString(),
    energies:
      ending === "failed" ? [] : ending === "writing" ? shape.slice(0, STOPS_SO_FAR) : shape,
    ending,
    seconds: null,
    ...change,
  };
}

/** A town of 58 letters with no break in it. */
const LONGEST_TOWN = "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch";

/** The longest words the vocabulary holds, on the longest weekday. */
const LONGEST_WORDS: Partial<DayRequest> = {
  date: "2026-11-18",
  energy: "balanced",
  travel: "transit",
  start: "slow",
  dinner: "early",
  end: "early",
  company: "partner",
};

const ALICANTE: Partial<DayRequest> = {
  energy: "social",
  travel: "transit",
  start: "early",
  end: "early",
  company: "friends",
};
/** The same day with one word fewer: a re-plan keeps its own row. */
const ALICANTE_ONE_WORD_LESS: Partial<DayRequest> = { ...ALICANTE, end: null };
const ELCHE: Partial<DayRequest> = {
  city: "Elche",
  energy: "balanced",
  start: "early",
  company: "family",
};

const PAIR = [
  dayOf("alicante", 0.5, ALICANTE),
  dayOf("alicante-again", 1, ALICANTE_ONE_WORD_LESS),
] as const;
const THREE = [...PAIR, dayOf("elche", 2, ELCHE)];

/** Days of cities the product writes, round the world, each asked a little earlier than the last. */
const OLDER: readonly YourDay[] = [
  dayOf("madrid", 30, {
    city: "Madrid",
    date: "2026-11-08",
    energy: "calm",
    start: "slow",
  }),
  dayOf("amsterdam", 34, {
    city: "Amsterdam",
    date: "2026-11-07",
    timezone: "Europe/Amsterdam",
    energy: "reflective",
    start: "slow",
    company: "alone",
  }),
  dayOf("new-york", 50, {
    city: "New York",
    date: "2026-11-13",
    timezone: "America/New_York",
    energy: "lively",
    end: "late",
  }),
  dayOf("kanazawa", 70, {
    city: "Kanazawa",
    date: "2026-11-12",
    timezone: "Asia/Tokyo",
    energy: "social",
    dinner: "late",
  }),
  dayOf("seoul", 96, {
    city: "Seoul",
    date: "2026-11-11",
    timezone: "Asia/Seoul",
    energy: "calm",
    travel: "on-foot",
  }),
  dayOf("zurich", 120, {
    city: "Zürich",
    date: "2026-11-10",
    timezone: "Europe/Zurich",
    company: "partner",
  }),
  dayOf("bologna", 150, {
    city: "Bologna",
    date: "2026-11-09",
    timezone: "Europe/Rome",
    energy: "reflective",
  }),
  dayOf("utrecht", 200, {
    city: "Utrecht",
    date: "2026-11-07",
    timezone: "Europe/Amsterdam",
    travel: "taxi",
    end: "evening",
  }),
  dayOf("nafplio", 240, {
    city: "Nafplio",
    date: "2026-11-05",
    timezone: "Europe/Athens",
    energy: "lively",
    start: "early",
  }),
];

/** The most the list keeps: the three above and nine older. */
export const TWELVE_DAYS: readonly YourDay[] = [...THREE, ...OLDER];

/** Two days being written, the newest first, and one cut short yesterday. */
export const WRITING_DAYS: readonly YourDay[] = [
  dayOf("writing-elche", 0, { city: "Elche", energy: "calm" }, { ending: "writing" }),
  dayOf("writing-alicante", 0.1, { energy: "lively", company: "friends" }, { ending: "writing" }),
  dayOf(
    "cut",
    26,
    { city: "New York", date: "2026-11-14", timezone: "America/New_York", start: "slow" },
    { ending: "cut" },
  ),
];

/** A named set of days, as the lab lays them out. */
export interface LedgerSet {
  label: string;
  days: readonly YourDay[];
  isAllShownAtFirst?: boolean;
}

/**
 * Every set the ledger is drawn for: the shortest and the longest a row can say, two days one
 * word apart, the most the list keeps folded and shown, each way a day can stand, a day asked
 * for a later date, and cities too long for a line.
 */
export const LEDGER_SETS: readonly LedgerSet[] = [
  { label: "one, at its shortest", days: [dayOf("short", 0.5, { city: "Elche", energy: "calm" })] },
  {
    label: "one, every word chosen",
    days: [dayOf("every-word", 0.5, { ...ALICANTE, dinner: "early" })],
  },
  { label: "two, one word apart", days: PAIR },
  { label: "three: the pair and another", days: THREE },
  { label: "twelve, the newest three", days: TWELVE_DAYS },
  { label: "twelve, all shown", days: TWELVE_DAYS, isAllShownAtFirst: true },
  {
    label: "the longest: a 58-letter town, every word",
    days: [
      dayOf("longest", 3, { ...LONGEST_WORDS, city: LONGEST_TOWN, timezone: "Europe/London" }),
    ],
  },
  { label: "two being written, one cut short", days: WRITING_DAYS },
  {
    label: "a later date, not finished, a link past 30 days",
    days: [
      dayOf("later", 1, {
        city: "New York",
        date: "2026-11-21",
        timezone: "America/New_York",
        energy: "lively",
        company: "friends",
      }),
      dayOf(
        "failed",
        24 * 3,
        { city: "Madrid", date: "2026-11-12", energy: "calm" },
        { ending: "failed" },
      ),
      dayOf("expired", 34 * 24, {
        city: "Amsterdam",
        timezone: "Europe/Amsterdam",
        date: "2026-10-12",
        energy: "reflective",
        start: "slow",
      }),
    ],
  },
  {
    label: "three cities too long for a line",
    days: [
      dayOf("long-wales", 1, { city: LONGEST_TOWN, timezone: "Europe/London" }),
      dayOf("long-aotearoa", 2, {
        city: "Taumatawhakatangihangakoauauotamateaturipukakapikimaungahoronukupokaiwhenuakitanatahu",
        date: "2026-11-16",
        timezone: "Pacific/Auckland",
        energy: "calm",
      }),
      dayOf("long-webster", 3, {
        city: "Chargoggagoggmanchauggagoggchaubunagungamaugg",
        timezone: "America/New_York",
        energy: "reflective",
        company: "alone",
      }),
    ],
  },
  {
    label: "the tallest three, the longest words",
    days: [
      dayOf("tallest-expired", 34 * 24, { ...LONGEST_WORDS, date: "2026-10-14" }),
      dayOf("tallest-writing", 0, { ...LONGEST_WORDS, city: "Elche" }, { ending: "writing" }),
      dayOf("tallest-cut", 5, { ...LONGEST_WORDS, city: "Madrid" }, { ending: "cut" }),
      ...OLDER,
    ],
  },
];

/** The set the states are drawn on: the pair and another, as a visitor who came back has. */
export const LEDGER_STATE_DAYS: readonly YourDay[] = THREE;
