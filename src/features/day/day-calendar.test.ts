import { describe, expect, it } from "vitest";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import type { Stop } from "@/lib/schema/itinerary.schema";
import {
  calendarFileNameOf,
  calendarOf,
  escapeText,
  foldLine,
  type CalendarDay,
} from "./day-calendar";
import { shownPlacesOf } from "./day-end";

/** The curated Kyoto day, normalized: a fixture of its own, whatever the site serves. */
const KYOTO = KYOTO_ITINERARY;
const NOW = new Date("2026-11-05T10:15:00Z");
const WRITTEN = KYOTO.stops.map((stop) =>
  [stop.primary, ...stop.alternatives].findIndex((place) => place.id === stop.selectedPlaceId),
);

function dayOf(change: Partial<CalendarDay> = {}): CalendarDay {
  return {
    key: "kyoto:0123456789abcdef",
    city: KYOTO.city,
    date: KYOTO.date,
    timezone: KYOTO.timezone,
    stops: KYOTO.stops,
    shown: WRITTEN,
    url: "https://www.lanternday.com/day/kyoto",
    ...change,
  };
}

/** The file's content lines, folded lines joined again as RFC 5545 unfolds them. */
function unfolded(file: string): string[] {
  expect(file.endsWith("\r\n")).toBe(true);
  // Every line break is CRLF: none stands alone.
  expect(file.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  return file.replace(/\r\n /g, "").split("\r\n").slice(0, -1);
}

/** A TEXT value read back as a calendar reads it. */
function unescaped(value: string): string {
  return value.replace(/\\(n|N|\\|;|,)/g, (_, character: string) =>
    character === "n" || character === "N" ? "\n" : character,
  );
}

/** A property's values in the file's events, in order; the zone's definition aside. */
function propertyValues(file: string, name: string): string[] {
  let isInEvent = false;
  return unfolded(file).flatMap((line) => {
    if (line === "BEGIN:VEVENT") isInEvent = true;
    if (line === "END:VEVENT") isInEvent = false;
    const isNamed = line.startsWith(`${name}:`) || line.startsWith(`${name};`);
    return isInEvent && isNamed ? [line.slice(line.indexOf(":") + 1)] : [];
  });
}

/** The names a calendar's content lines may start with in this file. */
const PROPERTIES =
  /^(BEGIN|END|VERSION|PRODID|CALSCALE|METHOD|TZID|DTSTART|TZOFFSETFROM|TZOFFSETTO|UID|DTSTAMP|DTEND|SUMMARY|LOCATION|GEO|DESCRIPTION|URL)[;:]/;

describe("calendarOf", () => {
  it("holds one event per stop, at its local hours in the day's zone", () => {
    const file = calendarOf(dayOf(), NOW);
    const lines = unfolded(file);

    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(KYOTO.stops.length);
    expect(lines).toContain(`TZID:${KYOTO.timezone}`);
    expect(lines).toContain("TZOFFSETTO:+0900");
    const first = KYOTO.stops[0]!;
    const date = KYOTO.date.replace(/-/g, "");
    expect(propertyValues(file, "DTSTART")[0]).toBe(
      `${date}T${first.startTime.replace(":", "")}00`,
    );
    expect(lines).toContain(
      `DTSTART;TZID=${KYOTO.timezone}:${date}T${first.startTime.replace(":", "")}00`,
    );
    expect(propertyValues(file, "DTSTAMP")[0]).toBe("20261105T101500Z");
    for (const line of lines) expect(line).toMatch(PROPERTIES);
  });

  it("names each stop by the version shown, its quarter and city, its point and its summary", () => {
    const swappedAt = KYOTO.stops.findIndex((stop) => stop.alternatives.length > 0);
    const shown = WRITTEN.map((index, at) => (at === swappedAt ? (index === 0 ? 1 : 0) : index));
    const file = calendarOf(dayOf({ shown }), NOW);
    const places = shownPlacesOf(KYOTO.stops, shown);

    expect(propertyValues(file, "SUMMARY").map(unescaped)).toEqual(places.map(({ name }) => name));
    expect(propertyValues(file, "LOCATION").map(unescaped)).toEqual(
      places.map(({ neighborhood }) => `${neighborhood}, ${KYOTO.city}`),
    );
    expect(propertyValues(file, "DESCRIPTION").map(unescaped)).toEqual(
      places.map(({ summary }) => summary),
    );
    expect(propertyValues(file, "GEO")[0]).toMatch(/^-?\d+(\.\d+)?;-?\d+(\.\d+)?$/);
    expect(propertyValues(file, "URL")[0]).toBe("https://www.lanternday.com/day/kyoto");
  });

  it("keeps each event's id by the day and its stop, whichever version it shows", () => {
    const ids = propertyValues(calendarOf(dayOf(), NOW), "UID");
    expect(new Set(ids).size).toBe(KYOTO.stops.length);
    expect(ids[0]).toBe(
      `kyoto-0123456789abcdef-${KYOTO.stops[0]!.id.replace(/[^A-Za-z0-9-]/g, "-")}@lanternday.com`,
    );
    const swapped = WRITTEN.map((index) => (index === 0 ? 1 : 0));
    expect(propertyValues(calendarOf(dayOf({ shown: swapped }), NOW), "UID")).toEqual(ids);
    expect(propertyValues(calendarOf(dayOf({ key: "kept:2f1c…" }), NOW), "UID")[0]).toMatch(
      /^kept-2f1c--[A-Za-z0-9-]+@lanternday\.com$/,
    );
  });

  it("puts a stop past midnight on the next day's date", () => {
    const stops: Stop[] = [
      { ...KYOTO.stops[0]!, startTime: "22:00", durationMinutes: 120 },
      { ...KYOTO.stops[1]!, startTime: "00:30", durationMinutes: 60 },
    ];
    const file = calendarOf(dayOf({ stops, shown: [0, 0], date: "2026-12-31" }), NOW);
    expect(propertyValues(file, "DTSTART")).toEqual(["20261231T220000", "20270101T003000"]);
    expect(propertyValues(file, "DTEND")).toEqual(["20270101T000000", "20270101T013000"]);
  });

  it("leaves the times floating for a zone that is no zone's name", () => {
    const file = calendarOf(dayOf({ timezone: 'Asia/Tokyo";X-EVIL=1' }), NOW);
    expect(file).not.toContain("TZID");
    expect(file).not.toContain("X-EVIL");
  });

  it("carries the day's link only as a plain web address", () => {
    expect(calendarOf(dayOf({ url: "javascript:alert(1)" }), NOW)).not.toContain("URL:");
    expect(calendarOf(dayOf({ url: "https://x.example/a\r\nBEGIN:VEVENT" }), NOW)).not.toContain(
      "URL:",
    );
    expect(calendarOf(dayOf({ url: undefined }), NOW)).not.toContain("URL:");
  });

  it("keeps a name the model wrote to text, whatever it holds", () => {
    const evil = [
      "Tea\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:pwned",
      "Bar; DTSTART:19700101T000000Z, and more\\",
      "Line\nbreak\rand\u2028separator\u0000nul\u0007bell\u001bescape\u0085next",
      "Café 東京 🏮 ".repeat(20),
    ];
    const stops = KYOTO.stops.slice(0, evil.length).map((stop, at) => ({
      ...stop,
      primary: {
        ...stop.primary,
        name: evil[at]!,
        neighborhood: evil[(at + 1) % evil.length]!,
        summary: evil[(at + 2) % evil.length]!,
      },
      selectedPlaceId: stop.primary.id,
    }));
    const file = calendarOf(dayOf({ stops, shown: stops.map(() => 0) }), NOW);
    const lines = unfolded(file);

    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(evil.length);
    expect(lines.filter((line) => line === "END:VEVENT")).toHaveLength(evil.length);
    for (const line of lines) expect(line).toMatch(PROPERTIES);
    expect(propertyValues(file, "SUMMARY").map(unescaped)).toEqual([
      "Tea\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:pwned",
      "Bar; DTSTART:19700101T000000Z, and more\\",
      "Line\nbreak\nand\nseparatornulbellescapenext",
      evil[3],
    ]);
    // No folded line passes 75 octets, and none splits a character.
    for (const line of file.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
      expect(line).not.toContain("�");
    }
  });
});

describe("escapeText", () => {
  it("writes out what TEXT gives a meaning, and drops control characters", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    expect(escapeText("a\r\nb\rc\u2029d")).toBe("a\\nb\\nc\\nd");
    expect(escapeText("tab\there\u0001\u007f\u009f")).toBe("tab\there");
  });
});

describe("foldLine", () => {
  it("folds past 75 octets, every later line begun with a space, never inside a character", () => {
    const line = `SUMMARY:${"東".repeat(40)}`;
    const folded = foldLine(line).split("\r\n");
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    expect(folded.slice(1).every((part) => part.startsWith(" "))).toBe(true);
    expect(folded.map((part, at) => (at === 0 ? part : part.slice(1))).join("")).toBe(line);
    expect(foldLine("SHORT:line")).toBe("SHORT:line");
  });
});

describe("calendarFileNameOf", () => {
  it("names the file by the day's address and date", () => {
    expect(calendarFileNameOf("kyoto", "2026-11-14")).toBe("lantern-kyoto-2026-11-14.ics");
    expect(calendarFileNameOf("../evil/name", "2026-11-14")).toBe(
      "lantern----evil-name-2026-11-14.ics",
    );
  });
});
