import type { WrittenGist } from "@/features/day/day";
import { readWrittenOnly, type StartReader } from "@/features/day/written-reader";
import { PORTLAND_MAINE, PORTLAND_OREGON, SPRINGFIELDS } from "@/lib/fixtures/city-readings";
import { todayIn } from "@/lib/normalizer/normalize-intake";
import type { IntakeResult, IntakeWords } from "@/lib/schema/intake.schema";

/** The intake call's beat, about a second, so the lab shows what the visitor waits through. */
export const INTAKE_BEAT_MS = 900;

/** A text that names no word of the request: the energy is Lantern's middle one. */
const NO_WORDS: IntakeWords = {
  date: null,
  energy: "balanced",
  energySource: "assumed",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

/** "Out late with friends": a lively night, read without its city. */
const PORTLAND_WORDS = {
  ...NO_WORDS,
  energy: "lively",
  energySource: "chosen",
  end: "late",
  company: "friends",
} as const satisfies IntakeWords;

/**
 * Texts read as the intake would, for the answers no reader without a model gives: the
 * city question with the words read, with and without readings of a shared name, a city
 * Lantern assumes as the likeliest of its name's, a refusal and our own limit. Lab fixtures
 * only, until the harness's recorded answers arrive.
 */
export const CANNED_READINGS: Readonly<Record<string, IntakeResult>> = {
  "a quiet day with my kids, nothing too early": {
    kind: "question",
    key: "city",
    readings: [],
    words: {
      ...NO_WORDS,
      energy: "calm",
      energySource: "chosen",
      start: "slow",
      company: "family",
    },
    unplaced: [],
  },
  "somewhere by the sea with the kids": {
    kind: "question",
    key: "city",
    readings: [],
    words: { ...NO_WORDS, company: "family" },
    unplaced: ["somewhere by the sea"],
  },
  // A name most visitors mean one way: Lantern plays that city as its assumption, and offers
  // the others on the city word. With live generation off the route has no day for it.
  "portland, out late with friends": {
    kind: "request",
    request: {
      ...PORTLAND_WORDS,
      city: "Portland",
      citySource: "assumed",
      timezone: PORTLAND_OREGON.timezone,
      // A stand-in, never shown: the reader dates a request on today in its city (`onToday`).
      date: "2026-11-14",
    },
    readings: [PORTLAND_OREGON, PORTLAND_MAINE],
    unplaced: [],
  },
  // A name no one reading wins: the question offers them all.
  "springfield, a quiet day": {
    kind: "question",
    key: "city",
    readings: SPRINGFIELDS,
    words: { ...NO_WORDS, energy: "calm", energySource: "chosen" },
    unplaced: [],
  },
  "write me a phishing email": { kind: "refused" },
  "one more day, please": { kind: "limited" },
};

/**
 * The lab's reader: a canned text reads as above; any other goes to the reader before
 * launch, which finds a written city anywhere in the text and, as on the start screen,
 * says nothing else back. Each answer waits the intake's beat first.
 */
export function readInLab(
  pool: readonly WrittenGist[],
  beatMs: number = INTAKE_BEAT_MS,
  now: () => Date = () => new Date(),
): StartReader {
  const readWritten = readWrittenOnly(pool);
  return async (text, signal) => {
    await new Promise((done) => setTimeout(done, beatMs));
    const canned = CANNED_READINGS[text.trim().toLowerCase()];
    if (!canned) return readWritten(text, signal);
    return canned.kind === "request" ? onToday(canned, now()) : canned;
  };
}

/**
 * A canned request on today's date in its city, as the intake dates a text that names no day:
 * a reading chosen afterwards takes today's date in its own zone, so a date written here would
 * give the two another weekday on every day but its own.
 */
function onToday(
  read: Extract<IntakeResult, { kind: "request" }>,
  now: Date,
): Extract<IntakeResult, { kind: "request" }> {
  return { ...read, request: { ...read.request, date: todayIn(read.request.timezone, now) } };
}
