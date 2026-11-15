import { describe, expect, it } from "vitest";
import {
  DAY_ROUTE,
  isCountingPageViews,
  KEPT_DAY_PATH,
  pageViewToSend,
  routeOf,
  withoutDayIds,
} from "./page-views";

const ORIGIN = "https://www.lanternday.com";
const DAY_ID = "6f1c1e9a-2b3c-4d5e-8f90-a1b2c3d4e5f6";

describe("withoutDayIds", () => {
  it("writes a kept day's address without the id that opens it", () => {
    expect(withoutDayIds({ type: "pageview", url: `${ORIGIN}/day/${DAY_ID}` })).toEqual({
      type: "pageview",
      url: `${ORIGIN}${KEPT_DAY_PATH}`,
    });
    expect(
      withoutDayIds({ type: "event", url: `${ORIGIN}/day/${DAY_ID.toUpperCase()}?a=1` }),
    ).toEqual({ type: "event", url: `${ORIGIN}${KEPT_DAY_PATH}?a=1` });
  });

  it("leaves a written day's address, and every other page, as it is", () => {
    for (const path of ["/", "/day/kyoto", "/day/sao-paulo", "/privacy", "/day/6f1c1e9a"]) {
      expect(withoutDayIds({ type: "pageview", url: `${ORIGIN}${path}` }).url).toBe(
        `${ORIGIN}${path}`,
      );
    }
  });

  // A link pasted at a sentence's end opens as an address with the id and a full stop.
  it("writes the id out whatever follows it, since its letters alone open the day", () => {
    for (const tail of [".", "x", ")", ",", "/more", "a1"]) {
      expect(withoutDayIds({ type: "pageview", url: `${ORIGIN}/day/${DAY_ID}${tail}` }).url).toBe(
        `${ORIGIN}${KEPT_DAY_PATH}${tail}`,
      );
    }
  });
});

describe("routeOf", () => {
  it("counts every day's page under one route, so a kept day's id is in none", () => {
    for (const path of ["/day/kyoto", "/day/sao-paulo", `/day/${DAY_ID}`, `/day/${DAY_ID}.`]) {
      expect(routeOf(path)).toBe(DAY_ROUTE);
    }
  });

  it("counts any other page under its own address", () => {
    for (const path of ["/", "/privacy", "/day", "/lab/matrix/stop-row"]) {
      expect(routeOf(path)).toBe(path);
    }
  });

  it("names no kept day's id in an address past a day's own, which is no page", () => {
    expect(routeOf(`/day/${DAY_ID}/more`)).toBe(`${KEPT_DAY_PATH}/more`);
    expect(routeOf(`/day/${DAY_ID.toUpperCase()}/`)).toBe(`${KEPT_DAY_PATH}/`);
    expect(routeOf(`/DAY/${DAY_ID}`)).toBe(KEPT_DAY_PATH);
    expect(routeOf(`/day/${DAY_ID}x/more`)).toBe(`${KEPT_DAY_PATH}x/more`);
  });
});

describe("pageViewToSend", () => {
  it("drops every page view from a browser marked as the owner's", () => {
    expect(pageViewToSend({ type: "pageview", url: `${ORIGIN}/day/kyoto` }, true)).toBeNull();
    expect(pageViewToSend({ type: "event", url: `${ORIGIN}/day/${DAY_ID}` }, true)).toBeNull();
  });

  it("sends any other without the kept days' ids", () => {
    expect(pageViewToSend({ type: "pageview", url: `${ORIGIN}/day/${DAY_ID}` }, false)).toEqual({
      type: "pageview",
      url: `${ORIGIN}${KEPT_DAY_PATH}`,
    });
    expect(pageViewToSend({ type: "pageview", url: `${ORIGIN}/privacy` }, false)).toEqual({
      type: "pageview",
      url: `${ORIGIN}/privacy`,
    });
  });
});

describe("isCountingPageViews", () => {
  it("counts on Vercel's production alone", () => {
    expect(isCountingPageViews({ VERCEL_ENV: "production" })).toBe(true);
    expect(isCountingPageViews({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isCountingPageViews({ NODE_ENV: "production" })).toBe(false);
    expect(isCountingPageViews({})).toBe(false);
  });
});
