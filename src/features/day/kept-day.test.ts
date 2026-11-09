import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredDay } from "@/lib/days/stored-day";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import { shownEnergiesOf } from "./day-shape";
import {
  askKeptDay,
  keptKeyOf,
  keptViewOf,
  restatedYourDayOf,
  storedDayFrom,
  type KeptLanding,
} from "./kept-day";
import { LINK_EXPIRED, OPENS_HERE, STILL_WRITING } from "./not-yet";
import type { YourDay } from "./your-days";

const ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
/** Kyoto's day as a visitor's, kept in the log: no day the site has written. */
const KYOTO = { request: KYOTO_REQUEST, itinerary: KYOTO_ITINERARY };

const WRITTEN: StoredDay = {
  status: "written",
  ...KYOTO,
  checks: {},
  writtenAt: "2026-10-31T20:00:00.000Z",
  seconds: 46,
  round: 0,
};
const CUT: StoredDay = { ...WRITTEN, status: "cut" };
const FAILED: StoredDay = { status: "failed", request: KYOTO_REQUEST };
const EXPIRED: StoredDay = { status: "expired", request: KYOTO_REQUEST };
const UNKNOWN: StoredDay = { status: "unknown" };

const ASKED: YourDay = {
  id: ID,
  request: KYOTO_REQUEST,
  startedAt: "2026-10-31T19:59:00.000Z",
  energies: ["reflective", "calm"],
  ending: "writing",
  seconds: null,
};

function landingOf(view: ReturnType<typeof keptViewOf>): KeptLanding {
  if (view.kind !== "day") throw new Error(`No day: ${view.kind}`);
  return view.landing;
}

describe("a day's address", () => {
  it("says how many re-plans its day has taken, so the next is asked as the one after", () => {
    // A re-plan's record, opened at its address or reloaded.
    const replanned: StoredDay = { ...WRITTEN, round: 2 };
    expect(landingOf(keptViewOf(ID, replanned, null, false)).round).toBe(2);
    expect(landingOf(keptViewOf(ID, { ...CUT, round: 1 }, null, false)).round).toBe(1);
    // A day with none to show has taken none here.
    expect(landingOf(keptViewOf(ID, FAILED, null, false)).round).toBe(0);
  });

  it("draws a written day whole, and a cut one with the stops it kept", () => {
    expect(landingOf(keptViewOf(ID, WRITTEN, null, false))).toEqual({
      id: ID,
      request: KYOTO.request,
      outcome: { kind: "complete", itinerary: KYOTO.itinerary },
      notice: null,
      // The checks the log kept, which its rows show.
      checks: WRITTEN.status === "written" ? WRITTEN.checks : {},
      round: 0,
    });
    // A day the log kept no day of has none.
    expect(landingOf(keptViewOf(ID, FAILED, null, false)).checks).toEqual({});
    expect(landingOf(keptViewOf(ID, CUT, null, false)).outcome).toEqual({
      kind: "cut",
      itinerary: KYOTO.itinerary,
    });
  });

  it("says a day that failed did not finish, with its own ending's words", () => {
    const failed = landingOf(keptViewOf(ID, FAILED, null, false));
    expect(failed.outcome).toEqual({ kind: "cut", itinerary: null });
    expect(failed.notice).toBeNull();
  });

  it("says a link past its days has expired, and offers the day again", () => {
    const { notice, request } = landingOf(keptViewOf(ID, EXPIRED, null, false));
    expect(request).toBe(KYOTO_REQUEST);
    expect(notice).toMatchObject({ kind: "expired", text: LINK_EXPIRED, retry: "Write it again" });
    expect(notice?.written.map(({ city }) => city)).not.toContain("Kyoto");
  });

  it("names a day this browser asked while it is written, then says it did not finish", () => {
    const writing = landingOf(keptViewOf(ID, UNKNOWN, ASKED, false));
    expect(writing.request).toBe(KYOTO_REQUEST);
    expect(writing.notice).toEqual({
      kind: "still-writing",
      text: `${STILL_WRITING} ${OPENS_HERE}`,
      written: [],
    });
    expect(landingOf(keptViewOf(ID, UNKNOWN, ASKED, true)).notice).toBeNull();
  });

  it("waits for a day it never asked, then says it has none", () => {
    expect(keptViewOf(ID, UNKNOWN, null, false)).toEqual({ kind: "writing" });
    expect(keptViewOf(ID, UNKNOWN, null, true)).toEqual({ kind: "none" });
  });

  it("reads one landing made again as the same, and another ending as another", () => {
    const writing = landingOf(keptViewOf(ID, UNKNOWN, ASKED, false));
    expect(keptKeyOf(landingOf(keptViewOf(ID, UNKNOWN, { ...ASKED }, false)))).toBe(
      keptKeyOf(writing),
    );
    const keys = [
      writing,
      landingOf(keptViewOf(ID, UNKNOWN, ASKED, true)),
      landingOf(keptViewOf(ID, WRITTEN, ASKED, false)),
    ].map(keptKeyOf);
    expect(new Set(keys).size).toBe(3);
  });
});

describe("the visitor's own record of a kept day", () => {
  it("takes a written day's shape and time, and a cut one's shape", () => {
    expect(restatedYourDayOf(ASKED, WRITTEN, false)).toEqual({
      ...ASKED,
      energies: shownEnergiesOf(KYOTO.itinerary),
      ending: "written",
      seconds: 46,
    });
    expect(restatedYourDayOf(ASKED, CUT, false)).toMatchObject({ ending: "cut", seconds: null });
  });

  it("says a day that failed, or was not found in time, did not finish", () => {
    expect(restatedYourDayOf(ASKED, FAILED, false).ending).toBe("failed");
    expect(restatedYourDayOf(ASKED, UNKNOWN, false)).toBe(ASKED);
    expect(restatedYourDayOf(ASKED, UNKNOWN, true).ending).toBe("failed");
    const written = { ...ASKED, ending: "written" as const };
    expect(restatedYourDayOf(written, UNKNOWN, true)).toBe(written);
    expect(restatedYourDayOf(written, EXPIRED, false)).toBe(written);
    // Its record landed, so a day recorded as still written ended: only when is said.
    expect(restatedYourDayOf(ASKED, EXPIRED, false)).toEqual({
      ...ASKED,
      ending: "written",
      seconds: null,
    });
  });
});

describe("the log's answer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads each status the route sends, and nothing else", () => {
    for (const stored of [WRITTEN, CUT, FAILED, EXPIRED, UNKNOWN]) {
      expect(storedDayFrom(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    }
    for (const answer of [
      null,
      "written",
      { status: "lost" },
      { status: "failed" },
      { status: "written", request: KYOTO_REQUEST },
      { status: "cut", request: KYOTO_REQUEST, itinerary: { stops: "none" } },
    ]) {
      expect(storedDayFrom(answer)).toBeNull();
    }
  });

  it("asks the route once, and reads a failed read as worth asking again", async () => {
    const answers = [
      Response.json(WRITTEN),
      new Response(null, { status: 503 }),
      new Response("not json"),
    ];
    const fetchDay = vi.fn((_path: string) => {
      const answer = answers.shift();
      return answer ? Promise.resolve(answer) : Promise.reject(new TypeError("offline"));
    });
    vi.stubGlobal("fetch", fetchDay);
    const signal = new AbortController().signal;

    expect(await askKeptDay(ID, signal)).toEqual(WRITTEN);
    expect(fetchDay).toHaveBeenCalledWith(`/api/day/${ID}`, { cache: "no-store", signal });
    expect(await askKeptDay(ID, signal)).toBeNull();
    expect(await askKeptDay(ID, signal)).toBeNull();
    expect(await askKeptDay(ID, signal)).toBeNull();
  });
});
