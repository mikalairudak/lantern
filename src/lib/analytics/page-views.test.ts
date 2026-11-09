import { describe, expect, it } from "vitest";
import { isCountingPageViews, KEPT_DAY_PATH, pageViewToSend, withoutDayIds } from "./page-views";

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
    for (const path of ["/", "/day/kyoto", "/day/sao-paulo", "/privacy", `/day/${DAY_ID}x`]) {
      expect(withoutDayIds({ type: "pageview", url: `${ORIGIN}${path}` }).url).toBe(
        `${ORIGIN}${path}`,
      );
    }
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
