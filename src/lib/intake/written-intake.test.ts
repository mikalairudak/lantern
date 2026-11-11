import { describe, expect, it } from "vitest";
import {
  KANAZAWA_START_REQUEST,
  MADRID_START_REQUEST,
  PORTO_START_REQUEST,
} from "@/lib/days/written/quick-starts";
import { NEW_YORK_REQUEST, PARIS_REQUEST } from "@/lib/days/written/city-days";
import {
  readWrittenIntake,
  writtenIntakeOf,
  writtenPhrasesOf,
  writtenRequestFor,
} from "./written-intake";

describe("writtenIntakeOf", () => {
  it("plays the written day for a city typed alone, in any case", () => {
    expect(writtenIntakeOf("kanazawa")).toEqual({
      kind: "request",
      request: KANAZAWA_START_REQUEST,
      readings: [],
      unplaced: [],
    });
  });

  it("finds a written city anywhere in the text, and says nothing else back", () => {
    expect(writtenIntakeOf("A slow day in Porto with friends")).toEqual({
      kind: "request",
      request: PORTO_START_REQUEST,
      readings: [],
      unplaced: [],
    });
  });

  it("drops a phrase that is not about the day unsaid", () => {
    // The day, and nothing said back (`docs/decisions.md`, "The intake's expected answers are
    // product calls").
    expect(writtenIntakeOf("Porto, following my ex without her noticing")).toEqual({
      kind: "request",
      request: PORTO_START_REQUEST,
      readings: [],
      unplaced: [],
    });
  });

  it("takes the written city named first", () => {
    const result = writtenIntakeOf("Madrid or Kanazawa");

    expect(result.kind === "request" && result.request).toEqual(MADRID_START_REQUEST);
  });

  it("says Lantern cannot plan yet for a city without a written day", () => {
    expect(writtenIntakeOf("Valencia, a slow morning")).toEqual({ kind: "unavailable" });
    // The days written by hand are fixtures, not the site's: their cities are any city's.
    expect(writtenIntakeOf("Kyoto")).toEqual({ kind: "unavailable" });
    expect(writtenIntakeOf("Lisbon, with friends")).toEqual({ kind: "unavailable" });
    expect(writtenIntakeOf("Portonians' favourite bars")).toEqual({ kind: "unavailable" });
    expect(writtenIntakeOf("   ")).toEqual({ kind: "unavailable" });
  });

  it("plays a city day as it plays a quick start's", () => {
    expect(writtenIntakeOf("Paris, a slow morning")).toEqual({
      kind: "request",
      request: PARIS_REQUEST,
      readings: [],
      unplaced: [],
    });
    const result = writtenIntakeOf("a night out in new york");
    expect(result.kind === "request" && result.request).toEqual(NEW_YORK_REQUEST);
  });

  it("reads as the start screen's reader does", async () => {
    await expect(readWrittenIntake("Porto")).resolves.toEqual(writtenIntakeOf("Porto"));
  });
});

describe("writtenPhrasesOf", () => {
  it("finds the phrases on either side of the written city", () => {
    expect(writtenPhrasesOf("A slow day in Porto with friends")).toEqual([
      "A slow day",
      "with friends",
    ]);
  });

  it("splits the rest into the phrases the visitor typed", () => {
    expect(writtenPhrasesOf("Madrid, early start, by bike; vegetarian.")).toEqual([
      "early start",
      "by bike",
      "vegetarian",
    ]);
  });

  it("drops the words that join a phrase to the city only where the two meet", () => {
    expect(writtenPhrasesOf("Two days in Porto for a slow morning")).toEqual([
      "Two days",
      "a slow morning",
    ]);
  });

  it("keeps a phrase a comma parts from the city as it was typed", () => {
    expect(writtenPhrasesOf("Kanazawa, on foot")).toEqual(["on foot"]);
    expect(writtenPhrasesOf("In the evening, Porto, near the sea")).toEqual([
      "In the evening",
      "near the sea",
    ]);
  });

  it("takes a city's country as part of the city", () => {
    expect(writtenPhrasesOf("Kanazawa, Japan")).toEqual([]);
    // Its country typed with its article or without it.
    expect(writtenPhrasesOf("Utrecht, the Netherlands")).toEqual([]);
    expect(writtenPhrasesOf("Utrecht, Netherlands")).toEqual([]);
    expect(writtenPhrasesOf("Nafplio in Greece, with my dog")).toEqual(["with my dog"]);
    // A city day's country too.
    expect(writtenPhrasesOf("Seoul, South Korea, out late")).toEqual(["out late"]);
  });

  it("finds none in a text without a written city", () => {
    expect(writtenPhrasesOf("Valencia, a slow morning")).toEqual([]);
  });
});

describe("writtenRequestFor", () => {
  it("finds the written day for a city as typed, whatever its case or spaces", () => {
    expect(writtenRequestFor(" porto ")).toEqual(PORTO_START_REQUEST);
    expect(writtenRequestFor("paris")).toEqual(PARIS_REQUEST);
    expect(writtenRequestFor("Valencia")).toBeNull();
  });
});
