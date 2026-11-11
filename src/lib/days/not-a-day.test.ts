import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { dayAddressOf, daySlugOf } from "./address";
import { notADaySource } from "./not-a-day";
import { WRITTEN_DAYS } from "./written/days";
import { WRITTEN_REQUESTS } from "./written/requests";

describe("notADaySource", () => {
  // Matched as the router matches a custom route's source, without case and with no trailing
  // slash, so the test reads the rule as the server does.
  const isNotADay = getPathMatch(notADaySource(), { strict: true, removeUnnamedParams: true });
  const KEPT_DAY_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";

  it.each([
    ["a city with no written day", "/day/nope"],
    ["a city written with an accent", "/day/caf%C3%A9"],
    ["the same city, its accent read", "/day/café"],
    ["a day written by hand's old address", `/day/${daySlugOf(KYOTO_REQUEST)}`],
    ["a written day's slug with more after it", "/day/bologna-x"],
    ["a written day's slug inside another", "/day/xbologna"],
    ["an id a digit short", `/day/${KEPT_DAY_ID.slice(1)}`],
    ["an id with more after it", `/day/${KEPT_DAY_ID}0`],
    ["the route's own name", "/day/[city]"],
  ])("takes %s", (_, path) => {
    expect(isNotADay(path)).not.toBe(false);
  });

  it("leaves every written day's address to its page, as the page and its params find it", () => {
    const requests = [...WRITTEN_REQUESTS, ...WRITTEN_DAYS.map(({ request }) => request)];
    for (const request of requests) expect(isNotADay(dayAddressOf(request))).toBe(false);
  });

  it.each([
    ["a day's id", `/day/${KEPT_DAY_ID}`],
    ["a day's id in capitals, as a UUID may be written", `/day/${KEPT_DAY_ID.toUpperCase()}`],
    ["a written day's slug with a capital, as the router reads it", "/day/Bologna"],
    ["a written day's file beside its page", "/day/bologna.rsc"],
    ["a written day's segments beside its page", "/day/bologna.segments"],
    ["a path deeper than a day", "/day/nope/x"],
    ["the address with no day named", "/day"],
    ["another page", "/privacy"],
  ])("leaves %s alone", (_, path) => {
    expect(isNotADay(path)).toBe(false);
  });
});
