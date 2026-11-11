import { CITY_DAYS } from "@/lib/days/written/city-days";
import { QUICK_STARTS } from "@/lib/days/written/quick-starts";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import type { IntakeReader, IntakeResult } from "@/lib/schema/intake.schema";
import type { DayRequest } from "@/lib/schema/itinerary.schema";

/**
 * The intake with live generation off, when no model reads the text. A city Lantern has written,
 * a quick start's or a city day's, named anywhere in the text, plays that day, and nothing else the text says is said back:
 * a phrase the stand-in cannot read may be one that is not about the day, which is dropped unsaid
 * (`docs/decisions.md`, "The intake's expected answers are product calls"). Any other text gets
 * what an intake that cannot run gets, `unavailable`. Live generation replaces it with the
 * intake's model.
 */

/** Words that only join a phrase to the city, dropped where a phrase meets it. */
const JOINING_WORDS = new Set(["in", "at", "to", "for", "around", "near", "of", "on", "and"]);

/** Each written city's country, which belongs to the city when it is typed beside it. */
const COUNTRIES: Readonly<Record<string, string>> = Object.fromEntries(
  [...QUICK_STARTS, ...CITY_DAYS].map(({ request, country }) => [request.city, country]),
);

/** "the Netherlands" as typed with or without its article. */
const ARTICLE = /^the\s+/;

/** The written request for a city as typed, whatever its case; null when there is none. */
export function writtenRequestFor(city: string): DayRequest | null {
  const typed = city.trim().toLowerCase();
  return WRITTEN_REQUESTS.find((request) => request.city.toLowerCase() === typed) ?? null;
}

interface Found {
  request: DayRequest;
  at: number;
  length: number;
}

/** The written city the text names first, as a whole word. */
function firstWrittenCityIn(text: string): Found | null {
  const found = WRITTEN_REQUESTS.flatMap((request): Found[] => {
    const match = new RegExp(`\\b${escaped(request.city)}\\b`, "i").exec(text);
    return match ? [{ request, at: match.index, length: request.city.length }] : [];
  });
  return found.sort((a, b) => a.at - b.at)[0] ?? null;
}

function escaped(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PHRASE_BREAK = /[,;.!?]/;

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== "");
}

function isJoin(word: string | undefined): boolean {
  return word !== undefined && JOINING_WORDS.has(word.toLowerCase());
}

/**
 * One side of the text without the joining words at the edge that touches the city, and
 * only there: past a comma a phrase is the visitor's as typed, so "Kanazawa, on foot" says
 * back "on foot".
 */
function withoutJoinsAt(edge: "start" | "end", side: string): string {
  const words = wordsOf(side);
  if (edge === "end") {
    while (isJoin(words.at(-1))) words.pop();
  } else {
    while (isJoin(words[0])) words.shift();
  }
  return words.join(" ");
}

/** The text's phrases on either side of the city, but its country. */
function phrasesBeside(text: string, { request, at, length }: Found): string[] {
  const country = COUNTRIES[request.city]?.toLowerCase().replace(ARTICLE, "");
  return [
    withoutJoinsAt("end", text.slice(0, at)),
    withoutJoinsAt("start", text.slice(at + length)),
  ]
    .flatMap((side) => side.split(PHRASE_BREAK))
    .map((phrase) => wordsOf(phrase).join(" "))
    .filter((phrase) => phrase !== "" && phrase.toLowerCase().replace(ARTICLE, "") !== country);
}

/** What the intake answers with live generation off: a written day, nothing said back. */
export function writtenIntakeOf(text: string): IntakeResult {
  const found = firstWrittenCityIn(text);
  if (!found) return { kind: "unavailable" };
  return { kind: "request", request: found.request, readings: [], unplaced: [] };
}

/**
 * The text's phrases beside the written city it names, as typed; none for a text without
 * one. Never said back: the start screen reads them only for the written day's own words,
 * which a phrase can make the visitor's (`src/features/day/written-reader.ts`).
 */
export function writtenPhrasesOf(text: string): string[] {
  const found = firstWrittenCityIn(text);
  return found ? phrasesBeside(text, found) : [];
}

/** The intake with live generation off, behind the start screen's reader. */
export const readWrittenIntake: IntakeReader = (text) => Promise.resolve(writtenIntakeOf(text));
