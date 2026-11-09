// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PORTLAND_MAINE, PORTLAND_OREGON } from "@/lib/fixtures/city-readings";
import { KYOTO_REQUEST, LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { CITY_SIGNATURE_HEADER } from "@/lib/intake/signed-city";
import type { IntakeResult, IntakeWords } from "@/lib/schema/intake.schema";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import {
  citySignatureKey,
  isSignedCity,
  isSignedRequest,
  keptCityOf,
  signCity,
  signedAnswerOf,
} from "./city-signature";
import type { KeptRecord, ReplanContext } from "./generation-log";

const SALT = "test-salt";
const PARIS = { city: "Paris", timezone: "Europe/Paris" };

const WORDS: IntakeWords = {
  date: null,
  energy: "balanced",
  energySource: "assumed",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

function postSigned(signature?: string): Request {
  return new Request("http://lantern.test/api/day", {
    method: "POST",
    headers: signature === undefined ? {} : { [CITY_SIGNATURE_HEADER]: signature },
  });
}

describe("signCity and isSignedCity", () => {
  it("signs a city in its zone, and the signature holds for that city and zone alone", async () => {
    const key = await citySignatureKey(SALT);
    const { signature } = await signCity(key, PARIS);

    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await isSignedCity(key, PARIS, signature)).toBe(true);
    expect(await isSignedCity(key, { ...PARIS, city: "Braga" }, signature)).toBe(false);
    expect(await isSignedCity(key, { ...PARIS, timezone: "Europe/Madrid" }, signature)).toBe(false);
  });

  it("never lets a city's letters move into its zone, or the other way", async () => {
    const key = await citySignatureKey(SALT);
    const { signature } = await signCity(key, { city: "Paris", timezone: "Europe/Paris" });

    expect(await isSignedCity(key, { city: "Pari", timezone: "sEurope/Paris" }, signature)).toBe(
      false,
    );
  });

  it("holds only under the salt that signed it", async () => {
    const { signature } = await signCity(await citySignatureKey(SALT), PARIS);

    expect(await isSignedCity(await citySignatureKey("another-salt"), PARIS, signature)).toBe(
      false,
    );
  });

  it("refuses no signature, and anything that is not one, without checking it", async () => {
    const key = await citySignatureKey(SALT);
    const { signature } = await signCity(key, PARIS);

    for (const forged of [
      null,
      "",
      "forged",
      `${signature}=`,
      signature.slice(1),
      `${signature}A`,
    ]) {
      expect(await isSignedCity(key, PARIS, forged)).toBe(false);
    }
  });
});

describe("signedAnswerOf", () => {
  it("signs a request's city, named whole", async () => {
    const request = { ...LISBON_REQUEST, city: "Paris", timezone: "Europe/Paris" };
    const result: IntakeResult = { kind: "request", request, readings: [], unplaced: [] };

    const answer = await signedAnswerOf(result, SALT);

    expect(answer).toMatchObject(result);
    expect(answer.signed).toEqual([{ ...PARIS, signature: expect.any(String) }]);
  });

  it("signs the city played and every other a shared name could mean, each once", async () => {
    const request = {
      ...LISBON_REQUEST,
      city: PORTLAND_OREGON.name,
      citySource: "assumed" as const,
      timezone: PORTLAND_OREGON.timezone,
    };
    const result: IntakeResult = {
      kind: "request",
      request,
      readings: [PORTLAND_OREGON, PORTLAND_MAINE],
      unplaced: [],
    };

    const { signed = [] } = await signedAnswerOf(result, SALT);

    const key = await citySignatureKey(SALT);
    expect(signed.map(({ city, timezone }) => [city, timezone])).toEqual([
      [PORTLAND_OREGON.name, PORTLAND_OREGON.timezone],
      [PORTLAND_MAINE.name, PORTLAND_MAINE.timezone],
    ]);
    for (const city of signed) expect(await isSignedCity(key, city, city.signature)).toBe(true);
  });

  it("signs each city a question offers", async () => {
    const result: IntakeResult = {
      kind: "question",
      key: "city",
      readings: [PORTLAND_OREGON, PORTLAND_MAINE],
      words: WORDS,
      unplaced: [],
    };

    const { signed = [] } = await signedAnswerOf(result, SALT);

    expect(signed.map(({ city }) => city)).toEqual([PORTLAND_OREGON.name, PORTLAND_MAINE.name]);
  });

  it("passes on as it came an answer with no city to sign", async () => {
    const question: IntakeResult = {
      kind: "question",
      key: "city",
      readings: [],
      words: WORDS,
      unplaced: [],
    };
    for (const result of [
      question,
      { kind: "refused" },
      { kind: "limited" },
      { kind: "unavailable" },
    ] satisfies IntakeResult[]) {
      expect(await signedAnswerOf(result, SALT)).toBe(result);
    }
  });
});

describe("isSignedRequest", () => {
  it("takes a written day's city in its own zone unsigned, whatever its words", async () => {
    const lively = { ...KANAZAWA_START_REQUEST, energy: "lively" as const };

    expect(await isSignedRequest(postSigned(), lively, SALT)).toBe(true);
  });

  it("asks a day written by hand for a signature, as any city: it is no day of the site's", async () => {
    expect(await isSignedRequest(postSigned(), KYOTO_REQUEST, SALT)).toBe(false);
  });

  it("asks any other city for the intake's signature in its header", async () => {
    const { signature } = await signCity(await citySignatureKey(SALT), PARIS);
    const { signature: kanazawaSignature } = await signCity(await citySignatureKey(SALT), {
      city: "Kanazawa",
      timezone: "Europe/Lisbon",
    });

    expect(await isSignedRequest(postSigned(), PARIS, SALT)).toBe(false);
    expect(await isSignedRequest(postSigned(signature), PARIS, SALT)).toBe(true);
    // A written city's name in another zone is not that written day's city.
    const kanazawaElsewhere = { city: "Kanazawa", timezone: "Europe/Lisbon" };
    expect(await isSignedRequest(postSigned(), kanazawaElsewhere, SALT)).toBe(false);
    expect(await isSignedRequest(postSigned(kanazawaSignature), kanazawaElsewhere, SALT)).toBe(
      true,
    );
  });
});

describe("keptCityOf", () => {
  /** A visitor's Kyoto day as the log keeps it: Kyoto has no written day. */
  const DAY_RECORD: KeptRecord = {
    id: "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b",
    promptVersion: "day-test",
    startedAt: "2026-11-05T09:00:00.000Z",
    msToFinish: 46_000,
    outcome: "complete",
    salvaged: false,
    request: KYOTO_REQUEST,
    outputText: "{}",
    placeChecks: null,
  };
  /** A re-plan written before the server read its own day: no `basis`. */
  const REPLAN_CONTEXT: ReplanContext = {
    changed: "start",
    round: 1,
    windows: [],
    itinerary: KYOTO_ITINERARY,
  };
  const KYOTO = { city: KYOTO_REQUEST.city, timezone: KYOTO_REQUEST.timezone };

  it("gives a kept day's city and zone, whether it ended whole or not", () => {
    expect(keptCityOf(DAY_RECORD)).toEqual(KYOTO);
    expect(keptCityOf({ ...DAY_RECORD, outcome: "cut" })).toEqual(KYOTO);
    expect(keptCityOf({ ...DAY_RECORD, outcome: "unavailable" })).toEqual(KYOTO);
  });

  it("gives a re-plan's city when the server read the day it rewrote", () => {
    const replan: ReplanContext = {
      ...REPLAN_CONTEXT,
      basis: { kind: "kept", id: DAY_RECORD.id },
    };
    expect(keptCityOf({ ...DAY_RECORD, context: replan })).toEqual(KYOTO);
  });

  it("gives nothing for a re-plan of a client's day, nor for no record or no request", () => {
    expect(keptCityOf({ ...DAY_RECORD, context: REPLAN_CONTEXT })).toBeNull();
    expect(keptCityOf(null)).toBeNull();
    expect(keptCityOf({ ...DAY_RECORD, request: null })).toBeNull();
  });
});
