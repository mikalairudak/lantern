import { describe, expect, it } from "vitest";
import { GOLDEN_NOW } from "@/lib/fixtures/intake/golden";
import { searchWrittenPlaces } from "@/lib/fixtures/intake/places";
import { answerIntake, readIntake } from "./answer-intake";

const LISBON_INTAKE = {
  city: "Lisbon",
  cityReadings: [],
  energy: null,
  energyGuess: null,
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
  date: null,
  unplaced: [],
};

describe("answerIntake", () => {
  it("answers a city Geoapify knows with the request for it", async () => {
    const result = await answerIntake(LISBON_INTAKE, searchWrittenPlaces, GOLDEN_NOW);

    expect(result).toMatchObject({
      kind: "request",
      request: { city: "Lisbon", timezone: "Europe/Lisbon", date: "2026-11-19" },
    });
  });

  it("answers an output that is not an intake as an intake that could not run", async () => {
    const result = await answerIntake({ city: "Lisbon" }, searchWrittenPlaces, GOLDEN_NOW);

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("answers a failed lookup as an intake that could not run", async () => {
    const failing = () => Promise.reject(new Error("Geoapify is down"));

    await expect(answerIntake(LISBON_INTAKE, failing, GOLDEN_NOW)).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("readIntake", () => {
  it("names an output that is not an intake, with the fields that are wrong", async () => {
    const reading = await readIntake({ city: "Lisbon" }, searchWrittenPlaces, GOLDEN_NOW);

    expect(reading).toMatchObject({
      kind: "failed",
      failure: {
        type: "intake-output-unparsable",
        message: expect.stringContaining("cityReadings"),
      },
    });
  });

  it("names a failed lookup apart from it, with the lookup's own message", async () => {
    const failing = () => Promise.reject(new Error("Geoapify could not look the city up: timeout"));

    const reading = await readIntake(LISBON_INTAKE, failing, GOLDEN_NOW);

    expect(reading).toEqual({
      kind: "failed",
      failure: {
        type: "city-lookup-failed",
        message: "Geoapify could not look the city up: timeout",
      },
    });
  });

  it("names a lookup that threw something other than an error by what it threw", async () => {
    const failing = () => Promise.reject("quota spent");

    const reading = await readIntake(LISBON_INTAKE, failing, GOLDEN_NOW);

    expect(reading).toMatchObject({ failure: { message: "quota spent" } });
  });

  it("answers an intake whose cities were found", async () => {
    const reading = await readIntake(LISBON_INTAKE, searchWrittenPlaces, GOLDEN_NOW);

    expect(reading).toMatchObject({ kind: "answered", result: { kind: "request" } });
  });

  it("gives no answer once the caller has walked away", async () => {
    const controller = new AbortController();
    const aborted = new DOMException("The visitor left", "AbortError");
    const search = () => {
      controller.abort(aborted);
      return Promise.reject(aborted);
    };

    await expect(readIntake(LISBON_INTAKE, search, GOLDEN_NOW, controller.signal)).rejects.toBe(
      aborted,
    );
  });
});
