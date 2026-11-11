import { describe, expect, it } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import {
  BOLOGNA_START_REQUEST,
  KANAZAWA_START_REQUEST,
  START_REQUESTS,
} from "@/lib/days/written/quick-starts";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import { endedDayOf, noticeOf, phaseOf, slotOf } from "./stream-ending";
import {
  BUSY,
  CONNECTION_DROPPED,
  NOT_WRITING_YET,
  OPEN_WRITTEN,
  OR_OPEN_WRITTEN,
  REFUSED_LINE,
  RESTING,
  UNFINISHED,
  WRITE_IT_AGAIN,
} from "./not-yet";
import { NO_LOCAL_WORDS } from "./sentence";

/** A city Lantern has no day for. */
const PARIS: DayRequest = { ...KANAZAWA_START_REQUEST, city: "Paris", timezone: "Europe/Paris" };
/** Kanazawa, but not the request its day was written for: the route has no day for it either. */
const LIVELY_KANAZAWA: DayRequest = { ...KANAZAWA_START_REQUEST, energy: "lively" };
/** The written days a notice over Kanazawa's offers: every one but its own. */
const BESIDES_KANAZAWA = START_REQUESTS.filter((request) => request !== KANAZAWA_START_REQUEST);

function kanazawaDay(): Itinerary {
  const written = normalizeDay(KANAZAWA_START_REQUEST, KANAZAWA_START_DAY.day);
  if (!written.ok) throw new Error(written.reason);
  return written.itinerary;
}

/** How the day stands after `outcome`, as `DayStage` reads it. */
function endingOf(outcome: DayOutcome | null, request: DayRequest = KANAZAWA_START_REQUEST) {
  const ended = endedDayOf(outcome);
  return { ended, phase: phaseOf(outcome, ended), notice: noticeOf(outcome, request) };
}

describe("how a day ended", () => {
  it("still streaming: the day is being written, with no notice", () => {
    expect(endingOf(null)).toEqual({ ended: null, phase: "writing", notice: null });
  });

  it("complete: the day is done, with no notice", () => {
    const itinerary = kanazawaDay();

    expect(endingOf({ kind: "complete", itinerary })).toEqual({
      ended: itinerary,
      phase: "done",
      notice: null,
    });
  });

  it("cut: a day the salvage rule kept is done; one cut before it is unfinished", () => {
    const itinerary = kanazawaDay();
    expect(endingOf({ kind: "cut", itinerary })).toEqual({
      ended: itinerary,
      phase: "done",
      notice: null,
    });

    expect(endingOf({ kind: "cut", itinerary: null })).toEqual({
      ended: null,
      phase: "failed",
      notice: {
        kind: "unfinished",
        text: UNFINISHED,
        retry: WRITE_IT_AGAIN,
        offer: OR_OPEN_WRITTEN,
        written: BESIDES_KANAZAWA,
      },
    });
  });

  it("disconnected: a kept day is written; without one, the connection is said to have dropped", () => {
    const itinerary = kanazawaDay();
    expect(endingOf({ kind: "disconnected", itinerary }).notice).toBeNull();

    expect(endingOf({ kind: "disconnected", itinerary: null })).toEqual({
      ended: null,
      phase: "failed",
      notice: {
        kind: "dropped",
        text: CONNECTION_DROPPED,
        retry: WRITE_IT_AGAIN,
        offer: OR_OPEN_WRITTEN,
        written: BESIDES_KANAZAWA,
      },
    });
  });

  it("refused: no retry, and the written days besides the one refused", () => {
    expect(endingOf({ kind: "refused" })).toEqual({
      ended: null,
      phase: "failed",
      notice: {
        kind: "refused",
        text: REFUSED_LINE,
        offer: OPEN_WRITTEN,
        written: BESIDES_KANAZAWA,
      },
    });
    // A day no one has written leaves every offered day to offer; an offered one, the others.
    expect(endingOf({ kind: "refused" }, PARIS).notice?.written).toEqual(START_REQUESTS);
    expect(endingOf({ kind: "refused" }, BOLOGNA_START_REQUEST).notice?.written).toEqual(
      START_REQUESTS.slice(1),
    );
  });

  it("invalid: said as a day Lantern could not finish, and offered again", () => {
    expect(
      endingOf({ kind: "invalid", reason: "The line about the day is blank", isEmpty: false }),
    ).toEqual({
      ended: null,
      phase: "failed",
      notice: {
        kind: "unfinished",
        text: UNFINISHED,
        retry: WRITE_IT_AGAIN,
        offer: OR_OPEN_WRITTEN,
        written: BESIDES_KANAZAWA,
      },
    });
  });

  it("unavailable: busy over a written day, with only a retry; not yet over any other", () => {
    expect(endingOf({ kind: "unavailable" })).toEqual({
      ended: null,
      phase: "not-yet",
      notice: { kind: "busy", text: BUSY, retry: WRITE_IT_AGAIN, written: [] },
    });

    const notYet = { kind: "not-yet", text: NOT_WRITING_YET, written: START_REQUESTS };
    expect(endingOf({ kind: "unavailable" }, PARIS).notice).toEqual(notYet);
    // Kanazawa at another energy is a day no one has written.
    expect(endingOf({ kind: "unavailable" }, LIVELY_KANAZAWA).notice).toEqual(notYet);
    // Nor is a day written by hand one of the site's.
    expect(endingOf({ kind: "unavailable" }, KYOTO_REQUEST).notice).toEqual(notYet);
  });

  it("unavailable with live generation on: busy over any day, since Lantern writes them all", () => {
    const busy = { kind: "busy", text: BUSY, retry: WRITE_IT_AGAIN, written: [] };

    for (const request of [PARIS, LIVELY_KANAZAWA]) {
      expect(noticeOf({ kind: "unavailable" }, request, true)).toEqual(busy);
    }
  });

  it("offers the other written days over one on the date it is shown on, never its own again", () => {
    const shown = { ...KANAZAWA_START_REQUEST, date: "2026-11-14" };

    expect(noticeOf({ kind: "cut", itinerary: null }, shown)).toMatchObject({
      kind: "unfinished",
      written: BESIDES_KANAZAWA,
    });
  });

  it("limited: Lantern rests, and offers the starts' days", () => {
    expect(endingOf({ kind: "limited" })).toEqual({
      ended: null,
      phase: "not-yet",
      notice: { kind: "resting", text: RESTING, written: START_REQUESTS },
    });
  });
});

describe("the end of the facts line", () => {
  it("ends a day that is done with the hint until a word is changed", () => {
    expect(slotOf("done", null, NO_LOCAL_WORDS)).toEqual({ kind: "hint" });
    expect(slotOf("done", null, { ...NO_LOCAL_WORDS, energy: "lively" })).toBeNull();
    expect(slotOf("done", null, { ...NO_LOCAL_WORDS, confirmed: ["travel"] })).toBeNull();
    expect(slotOf("done", null, { ...NO_LOCAL_WORDS, kept: { travel: "taxi" } })).toBeNull();
  });

  it("says what a changed word would have re-planned", () => {
    const text = "Lantern isn't re-planning days right now, so dinner stays as written";

    expect(slotOf("done", text, NO_LOCAL_WORDS)).toEqual({ kind: "not-yet", text });
  });

  it("says nothing while the day is written, or when none is coming: the notice says that", () => {
    expect(slotOf("writing", null, NO_LOCAL_WORDS)).toBeNull();
    expect(slotOf("not-yet", null, NO_LOCAL_WORDS)).toBeNull();
    expect(slotOf("failed", null, NO_LOCAL_WORDS)).toBeNull();
  });
});
