import { describe, expect, it } from "vitest";
import { KYOTO_REQUEST, LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { replannedRequestOf } from "./replan-request";
import { NO_LOCAL_WORDS, sentenceFactsOf } from "./sentence";

/** What Kyoto's written day assumes, and the company it asks about. */
const KYOTO_ASSUMED: PartialDay["assumptions"] = {
  travel: "on-foot",
  start: "early",
  dinner: "early",
  end: "early",
  company: null,
};

describe("a request re-planned for a changed word", () => {
  it("is the day's request with the word changed, Lantern's other words left to assume", () => {
    const facts = sentenceFactsOf(KYOTO_REQUEST, KYOTO_ASSUMED);

    expect(replannedRequestOf(KYOTO_REQUEST, facts, { key: "dinner", value: "late" })).toEqual({
      ...KYOTO_REQUEST,
      dinner: "late",
    });
  });

  it("keeps the visitor's own words, and changes one of them", () => {
    const facts = sentenceFactsOf(LISBON_REQUEST, { ...KYOTO_ASSUMED, company: null });

    expect(replannedRequestOf(LISBON_REQUEST, facts, { key: "company", value: "family" })).toEqual({
      ...LISBON_REQUEST,
      company: "family",
    });
  });

  it("leaves to Lantern a word of the visitor's the changed one cannot stand beside", () => {
    const lateDinner: DayRequest = { ...KYOTO_REQUEST, dinner: "late" };
    const homeByEight: DayRequest = { ...KYOTO_REQUEST, end: "evening" };

    expect(
      replannedRequestOf(lateDinner, sentenceFactsOf(lateDinner, KYOTO_ASSUMED), {
        key: "end",
        value: "evening",
      }),
    ).toEqual({ ...KYOTO_REQUEST, dinner: null, end: "evening" });
    expect(
      replannedRequestOf(homeByEight, sentenceFactsOf(homeByEight, KYOTO_ASSUMED), {
        key: "dinner",
        value: "late",
      }),
    ).toEqual({ ...KYOTO_REQUEST, dinner: "late", end: null });
  });

  it("answers the word Lantern asked about", () => {
    const facts = sentenceFactsOf(KYOTO_REQUEST, KYOTO_ASSUMED);

    expect(replannedRequestOf(KYOTO_REQUEST, facts, { key: "company", value: "friends" })).toEqual({
      ...KYOTO_REQUEST,
      company: "friends",
    });
  });

  it("asks with the assumptions the visitor chose as they stood, and the energy re-picked", () => {
    const facts = sentenceFactsOf(KYOTO_REQUEST, KYOTO_ASSUMED, {
      energy: "lively",
      confirmed: ["travel", "end"],
      kept: {},
    });

    expect(replannedRequestOf(KYOTO_REQUEST, facts, { key: "dinner", value: "late" })).toEqual({
      ...KYOTO_REQUEST,
      energy: "lively",
      energySource: "chosen",
      travel: "on-foot",
      end: "early",
      dinner: "late",
    });
  });

  it("keeps an energy the intake assumed as Lantern's, until the visitor picks one", () => {
    const request: DayRequest = { ...KYOTO_REQUEST, energySource: "assumed" };
    const facts = sentenceFactsOf(request, KYOTO_ASSUMED, NO_LOCAL_WORDS);

    expect(replannedRequestOf(request, facts, { key: "start", value: "slow" })).toMatchObject({
      energy: "calm",
      energySource: "assumed",
      start: "slow",
    });
  });

  it("keeps the city, its zone and the date, which the city's signature covers", () => {
    const porto: DayRequest = {
      ...KYOTO_REQUEST,
      city: "Porto",
      timezone: "Europe/Lisbon",
      date: "2026-11-21",
    };
    const facts = sentenceFactsOf(porto, KYOTO_ASSUMED);

    expect(replannedRequestOf(porto, facts, { key: "travel", value: "taxi" })).toMatchObject({
      city: "Porto",
      citySource: "chosen",
      timezone: "Europe/Lisbon",
      date: "2026-11-21",
    });
  });

  it("refuses a value outside the word's vocabulary", () => {
    const facts = sentenceFactsOf(KYOTO_REQUEST, KYOTO_ASSUMED);

    expect(() =>
      replannedRequestOf(KYOTO_REQUEST, facts, { key: "dinner", value: "midnight" }),
    ).toThrow();
  });
});
