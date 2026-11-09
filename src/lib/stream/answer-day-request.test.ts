// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { START_PLACE_CHECKS } from "@/lib/days/written/checks";
import { KANAZAWA_START_REQUEST, PORTO_START_REQUEST } from "@/lib/days/written/quick-starts";
import { WRITTEN_DAYS } from "@/lib/days/written/days";
import {
  DAY_VERSION_HEADER,
  SEEN_DAY_HEADER,
  WHOLE_DAY_HEADER,
  writtenVersionFor,
} from "@/lib/days/written/version";
import { parseServerTiming } from "@/lib/server-timing";
import type { RequestIssue } from "@/lib/http/bad-request";
import { answerDayRequest } from "./answer-day-request";
import { placeCheckOf, type PlaceCheck } from "./place-checks";
import { readDayStream } from "./read-day-stream";
import type { StreamPace } from "./simulate-day-stream";

// Large deltas keep the suite fast; the route's own pace is for people.
const QUICK: Partial<StreamPace> = { deltaChars: 64 };
// Slow enough to stop a day partway through it.
const UNHURRIED: Partial<StreamPace> = { deltaChars: 64, deltaDelayMs: 5 };
const ROUTE_URL = "http://lantern.test/api/day";

function post(body: string, signal?: AbortSignal): Request {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  });
}

async function issuesOf(response: Response): Promise<RequestIssue[]> {
  const { issues } = (await response.json()) as { issues: RequestIssue[] };
  return issues;
}

describe("answerDayRequest", () => {
  it.each(WRITTEN_DAYS.map((written) => [written.request.city, written] as const))(
    "streams the day written for %s, and it reads as complete",
    async (_city, { request, day }) => {
      const response = answerDayRequest(post(JSON.stringify(request)), QUICK);
      const outcome = await readDayStream({ request, response, onPartial: () => undefined });

      expect(outcome.kind).toBe("complete");
      expect(outcome.kind === "complete" && outcome.itinerary.stops).toHaveLength(day.stops.length);
    },
  );

  it("answers 503 for a request no day was written for, which reads as unavailable", async () => {
    const request = { ...KANAZAWA_START_REQUEST, energy: "lively" as const };
    const response = await answerDayRequest(post(JSON.stringify(request)), QUICK);

    expect(response.status).toBe(503);
    const outcome = await readDayStream({
      request,
      response: Promise.resolve(response),
      onPartial: () => undefined,
    });
    expect(outcome).toEqual({ kind: "unavailable" });
  });

  it("answers 400 naming the field that is wrong", async () => {
    const response = await answerDayRequest(
      post(JSON.stringify({ ...KANAZAWA_START_REQUEST, energy: "frantic" })),
    );

    expect(response.status).toBe(400);
    expect((await issuesOf(response)).map(({ path }) => path)).toEqual(["energy"]);
  });

  it("answers 400 for a request that leaves out a word, since every word is sent, even as null", async () => {
    const { company: _company, ...withoutCompany } = KANAZAWA_START_REQUEST;
    const response = await answerDayRequest(post(JSON.stringify(withoutCompany)));

    expect(response.status).toBe(400);
    expect((await issuesOf(response)).map(({ path }) => path)).toEqual(["company"]);
  });

  it("answers 400 for a body that is not a request at all", async () => {
    const notJson = await answerDayRequest(post("Kyoto, please"));
    const notAnObject = await answerDayRequest(post(JSON.stringify(["Kyoto"])));

    expect([notJson.status, notAnObject.status]).toEqual([400, 400]);
    expect(await issuesOf(notJson)).toEqual([{ path: "request", message: "The body is not JSON" }]);
    expect((await issuesOf(notAnObject)).map(({ path }) => path)).toEqual(["request"]);
  });

  it("stops streaming when the request's signal aborts, as when the visitor leaves", async () => {
    const leave = new AbortController();
    // Held to the end: undici reaches a request's abort controller through a WeakRef, so a
    // request garbage collected mid-stream no longer passes its parent's abort on.
    const request = post(JSON.stringify(KANAZAWA_START_REQUEST), leave.signal);

    const outcome = await readDayStream({
      request: KANAZAWA_START_REQUEST,
      response: answerDayRequest(request, UNHURRIED),
      onPartial: () => leave.abort(),
    });

    expect(request.signal.aborted).toBe(true);
    expect(outcome.kind).not.toBe("complete");
  });

  // The pause before each check is the verifier's, held on fake timers in its own test: a client
  // under load sees a check start late, so a pause it measures says little.
  it("plays a start's recorded checks beside its day, under the normalizer's ids", async () => {
    const checks = START_PLACE_CHECKS[PORTO_START_REQUEST.city] ?? {};
    const ended = new Map<string, PlaceCheck>();

    const outcome = await readDayStream({
      request: PORTO_START_REQUEST,
      response: answerDayRequest(post(JSON.stringify(PORTO_START_REQUEST)), QUICK),
      onPartial: () => undefined,
      onPlaceCheck: (check) => {
        if (check.state !== "checking") ended.set(check.placeId, check);
      },
    });
    if (outcome.kind !== "complete") throw new Error(outcome.kind);
    const shown = outcome.itinerary.stops.flatMap((stop) => [
      stop.primary.id,
      ...stop.alternatives.map(({ id }) => id),
    ]);

    for (const id of shown) {
      const recorded = checks[id];
      if (recorded === undefined) throw new Error(`No recorded check for ${id}`);
      expect(ended.get(id)).toEqual(placeCheckOf(id, recorded));
    }
  });

  it("answers a day written by hand as any city it has not written: unavailable, a 503", async () => {
    const response = await answerDayRequest(post(JSON.stringify(KYOTO_REQUEST)), QUICK);

    expect(response.status).toBe(503);
  });
});

describe("answerDayRequest's Server-Timing", () => {
  function namesOf(response: Response): string[] {
    return parseServerTiming(response.headers.get("Server-Timing") ?? "")
      .map(({ name }) => name)
      .filter((name) => name !== "cold");
  }

  it("times the handler for a written day, which waits on nothing, and still streams it", async () => {
    const response = await answerDayRequest(post(JSON.stringify(KANAZAWA_START_REQUEST)), QUICK);

    expect(namesOf(response)).toEqual(["total"]);
    const outcome = await readDayStream({
      request: KANAZAWA_START_REQUEST,
      response: Promise.resolve(response),
      onPartial: () => undefined,
    });
    expect(outcome.kind).toBe("complete");
  });

  it("times the handler for a request it refuses", async () => {
    expect(namesOf(await answerDayRequest(post("{}"), QUICK))).toEqual(["total"]);
  });
});

describe("answerDayRequest for a page on another site", () => {
  const LIVELY_KANAZAWA = { ...KANAZAWA_START_REQUEST, energy: "lively" as const };

  function postWith(headers: Record<string, string>): Request {
    return new Request(ROUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", ...headers },
      body: JSON.stringify(LIVELY_KANAZAWA),
    });
  }

  it("refuses it with 403 before any live day, and the reader takes it as unavailable", async () => {
    const asked: Request[] = [];
    const live = (request: Request) => {
      asked.push(request);
      return Promise.resolve(new Response(null, { status: 200 }));
    };

    const response = await answerDayRequest(
      postWith({ "sec-fetch-site": "cross-site" }),
      QUICK,
      live,
    );

    expect(response.status).toBe(403);
    expect(asked).toEqual([]);
    const outcome = await readDayStream({
      request: LIVELY_KANAZAWA,
      response: Promise.resolve(response),
      onPartial: () => undefined,
    });
    expect(outcome).toEqual({ kind: "unavailable" });
  });

  it("refuses an Origin of another site from a browser that sends no Sec-Fetch-Site", async () => {
    const response = await answerDayRequest(postWith({ origin: "https://example.com" }), QUICK);

    expect(response.status).toBe(403);
  });

  it("serves Lantern's own page, on its domain or a phone's local address", async () => {
    const [written] = WRITTEN_DAYS;
    if (written === undefined) throw new Error("No written day");
    const own = (headers: Record<string, string>) =>
      new Request(ROUTE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(written.request),
      });

    const onDomain = await answerDayRequest(own({ "sec-fetch-site": "same-origin" }), QUICK);
    const onPhone = await answerDayRequest(
      own({ host: "192.168.1.20:3000", origin: "http://192.168.1.20:3000" }),
      QUICK,
    );

    expect(onDomain.status).toBe(200);
    expect(onPhone.status).toBe(200);
    await onDomain.body?.cancel();
    await onPhone.body?.cancel();
  });
});

describe("answerDayRequest for a written day this browser has seen", () => {
  const KANAZAWA_WRITTEN = WRITTEN_DAYS.find(({ request }) => request.city === "Kanazawa")!;
  const VERSION = writtenVersionFor(KANAZAWA_WRITTEN);
  /** The route's own pace, uneven and slow: a day at it takes seconds. */
  const SLOW: Partial<StreamPace> = { deltaChars: 4, deltaDelayMs: 20 };

  function postSeen(
    seen: string | null,
    body: unknown = KANAZAWA_START_REQUEST,
    site = "same-origin",
  ): Request {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "sec-fetch-site": site,
    };
    if (seen !== null) headers[SEEN_DAY_HEADER] = seen;
    return new Request(ROUTE_URL, { method: "POST", headers, body: JSON.stringify(body) });
  }

  it("says the version of every written day it plays", async () => {
    const response = await answerDayRequest(postSeen(null), QUICK);

    expect(response.headers.get(DAY_VERSION_HEADER)).toBe(VERSION);
    expect(response.headers.get(WHOLE_DAY_HEADER)).toBeNull();
  });

  it("plays the version the browser saw whole at once, whatever its pace", async () => {
    const started = performance.now();
    const response = answerDayRequest(postSeen(`kanazawa:${VERSION}`), SLOW);
    expect((await response).headers.get(WHOLE_DAY_HEADER)).toBe("1");
    const outcome = await readDayStream({
      request: KANAZAWA_START_REQUEST,
      response,
      onPartial: () => undefined,
    });

    expect(outcome.kind).toBe("complete");
    // At its pace the day takes seconds; whole, a few milliseconds.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it.each([
    ["another version", "kanazawa:0000000000000000"],
    ["another day's slug", `porto:${VERSION}`],
    ["a slug in capitals", `Kanazawa:${VERSION}`],
    ["a version too short", `kanazawa:${VERSION.slice(1)}`],
    ["a version too long", `kanazawa:${VERSION}0`],
    ["hex in capitals", `kanazawa:${VERSION.toUpperCase()}`],
    // Room at its ends the platform trims, as any header's; room inside it stays.
    ["room inside it", `kanazawa: ${VERSION}`],
    ["no slug", `:${VERSION}`],
    ["something else", "<script>"],
  ])("plays %s at its own pace, as with no header at all", async (_case, seen) => {
    const response = await answerDayRequest(postSeen(seen), QUICK);

    expect(response.headers.get(WHOLE_DAY_HEADER)).toBeNull();
    expect(response.headers.get(DAY_VERSION_HEADER)).toBe(VERSION);
  });

  it("changes nothing for a day Lantern writes, nor for a page on another site", async () => {
    const asked: { request: Request; day: unknown }[] = [];
    const live = (request: Request, day: unknown) => {
      asked.push({ request, day });
      return Promise.resolve(new Response("written live", { status: 200 }));
    };
    const lively = { ...KANAZAWA_START_REQUEST, energy: "lively" as const };

    const plain = await answerDayRequest(postSeen(null, lively), QUICK, live);
    const seen = await answerDayRequest(postSeen(`kanazawa:${VERSION}`, lively), QUICK, live);

    expect(await seen.text()).toBe(await plain.text());
    expect(seen.headers.get(WHOLE_DAY_HEADER)).toBeNull();
    expect(seen.headers.get(DAY_VERSION_HEADER)).toBeNull();
    expect(asked.map(({ day }) => day)).toEqual([lively, lively]);

    const elsewhere = await answerDayRequest(
      postSeen(`kanazawa:${VERSION}`, KANAZAWA_START_REQUEST, "cross-site"),
      QUICK,
      live,
    );
    expect(elsewhere.status).toBe(403);
    expect(asked).toHaveLength(2);
  });
});
