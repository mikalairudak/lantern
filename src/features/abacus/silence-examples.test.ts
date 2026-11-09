import { describe, expect, it } from "vitest";
import { revealedOf } from "@/features/itinerary/revealed";
import type { PartialDay } from "@/lib/stream/outcome";
import { draftDayOf, hasEnergy } from "./day-draft";
import type { DaySpan } from "./geometry";
import {
  ONE_STOP,
  SILENCE_DAYS,
  SILENCE_MOMENTS,
  silenceOf,
  type SilenceDay,
  type SilenceMoment,
} from "./silence-examples";
import { itineraryOf, pageFrameOf, type StopRowStill } from "./stop-row-examples";
import { bareStopOf, waitingInBareRow, waitingOver } from "./waiting";

const MINUTES_PER_HOUR = 60;
/** The curated days a visitor opens; the others are edge days. */
const CURATED = ["Kyoto", "Alicante", "Lisbon"];

function dayLabelled(label: string): SilenceDay {
  const day = SILENCE_DAYS.find((each) => each.label === label);
  if (!day) throw new Error(`No day "${label}"`);
  return day;
}

/** A silence the day reaches: a test of one it never reaches fails here. */
async function reachedSilence(day: SilenceDay, moment: SilenceMoment): Promise<StopRowStill> {
  const still = await silenceOf(day, moment);
  if ("unreached" in still) throw new Error(`${day.label} never reaches ${moment}`);
  return still;
}

/** The page's frame a silence's line reads its pen against. */
function pageOf({ frame }: StopRowStill): DaySpan {
  if (frame.kind !== "silence") throw new Error("Not a silence");
  return frame.page;
}

const DAYS = SILENCE_DAYS.map((day) => [day.label, day] as const);
/** Days with a stop before their middle one, where the stream pauses. */
const DAYS_OF_STOPS = DAYS.filter(([, day]) => day.fixture.day.stops.length > 1);

describe("bareStopOf", () => {
  const stopOf = (place: NonNullable<NonNullable<PartialDay["stops"]>[number]>["place"]) => ({
    startTime: "12:30",
    durationMinutes: 60,
    place,
  });
  const stopsOf = (day: PartialDay) => draftDayOf(revealedOf(day, null)).stops;

  it("names a bare row from its time, before its kind: its place says what the row before did", () => {
    expect(bareStopOf(stopsOf({ stops: [stopOf({ name: "Merc" })] }))?.id).toBe("stop-0");
    const named = stopsOf({
      stops: [stopOf({ name: "Mercado Central", kind: "food", neighborhood: "" })],
    });
    expect(bareStopOf(named)?.id).toBe("stop-0");
  });
});

describe("a silence in a day's stream", () => {
  it("after a stop, waits under the row's whole words for the next part of the day", async () => {
    // Alicante's market, the stop before the middle one, where the day's stream pauses.
    const still = await reachedSilence(dayLabelled("Alicante"), "after-stop");
    const stop = still.draft.stops[still.subject];
    if (!stop) throw new Error("No silence after the market");

    expect(stop.primary.name).toBe("Mercado Central");
    expect(hasEnergy(stop)).toBe(true);
    // The market ends at 13:15, well before the evening asked for, so a stop comes next.
    expect(waitingOver(still.draft.stops, pageOf(still))).toEqual({
      pen: { next: "stop", minutes: 13 * MINUTES_PER_HOUR + 15 },
      phrase: "midday",
    });
  });

  it("with a row bare, waits in its place, saying the part of the day its own time begins", async () => {
    // Alicante's lunch is placed and named at 14:00, its words waiting for its light.
    const still = await reachedSilence(dayLabelled("Alicante"), "bare-row");
    const { stops } = still.draft;
    const bare = bareStopOf(stops);
    if (!bare) throw new Error("No bare row in Alicante's silence");

    expect(bare.primary.name).toBeDefined();
    expect(bare.startTime).toBe("14:00");
    expect(hasEnergy(bare)).toBe(false);
    expect(waitingInBareRow(stops, bare, 0)).toMatchObject({
      phrase: "the afternoon",
      isInPlace: true,
      stopId: bare.id,
    });
  });

  it("reads a bare row past midnight on the day's running clock, never as the morning", () => {
    // A bar at half past ten, a supper at a quarter past midnight, and a row bare after it at
    // half past one: read on the raw clock it was the morning.
    const weighed = (startTime: string, kind: "bar" | "food") => ({
      startTime,
      durationMinutes: 60,
      place: {
        name: "Written",
        kind,
        neighborhood: "",
        sensory: { energy: "lively", acoustic: "loud", crowd: "busy", texture: "Loud." } as const,
        light: {
          exposure: "interior",
          orientation: "none",
          bestWindow: "none",
          note: "Lit.",
        } as const,
      },
    });
    const stops = draftDayOf(
      revealedOf(
        {
          stops: [
            weighed("22:30", "bar"),
            weighed("00:15", "food"),
            { startTime: "01:30", durationMinutes: 60, place: { name: "Bare" } },
          ],
        },
        null,
      ),
    ).stops;
    const bare = bareStopOf(stops);
    if (!bare) throw new Error("No bare row after the supper");

    expect(waitingInBareRow(stops, bare, 0).phrase).toBe("late evening");
  });

  it("after the last stop, waits for the versions once the plan reaches the hours asked for", async () => {
    const still = await reachedSilence(dayLabelled("a night past midnight"), "after-last");

    expect(waitingOver(still.draft.stops, pageOf(still)).phrase).toBe("other versions");
  });

  it("after a last stop that ends before the hours asked for, waits for a next one, as the page does", async () => {
    // Kyoto's dinner ends at 19:30, and asked home by eleven its words ask for 23:00: the page
    // cannot tell the dinner is the day's last stop.
    const kyoto = dayLabelled("Kyoto");
    const homeByEleven: SilenceDay = {
      label: "Kyoto, home by eleven",
      fixture: { ...kyoto.fixture, request: { ...kyoto.fixture.request, end: "early" } },
    };
    const still = await reachedSilence(homeByEleven, "after-last");

    expect(waitingOver(still.draft.stops, pageOf(still))).toEqual({
      pen: { next: "stop", minutes: 19 * MINUTES_PER_HOUR + 30 },
      phrase: "after dinner",
    });
  });

  it("after a last stop within the last hour asked for, waits for the versions", async () => {
    // Kyoto's own words ask it home by eight, and its dinner ends at 19:30.
    const still = await reachedSilence(dayLabelled("Kyoto"), "after-last");

    expect(waitingOver(still.draft.stops, pageOf(still)).phrase).toBe("other versions");
  });

  it.each(DAYS_OF_STOPS)(
    "after a stop, shows %s written up to the stop before its middle one, the line under it",
    async (_label, day) => {
      const { draft, subject } = await reachedSilence(day, "after-stop");
      const middle = Math.floor(day.fixture.day.stops.length / 2);

      expect(draft.stops.at(-1)?.id).toBe(`stop-${middle - 1}`);
      expect(subject).toBe(draft.stops.length - 1);
    },
  );

  it.each(DAYS)(
    "after the last stop, shows %s ending in its last row before any version, the line under it",
    async (_label, day) => {
      const { draft, subject } = await reachedSilence(day, "after-last");

      expect(draft.stops.at(-1)?.id).toBe(`stop-${day.fixture.day.stops.length - 1}`);
      expect(draft.stops.every((stop) => stop.alternatives.length === 0)).toBe(true);
      expect(subject).toBe(draft.stops.length - 1);
    },
  );

  it("says a day of one stop has no silence after a stop but the one after its last", async () => {
    expect(await silenceOf(dayLabelled("one stop"), "after-stop")).toEqual({ unreached: ONE_STOP });
  });

  it("frames a silence as the page frames the day at that moment", async () => {
    // Lisbon's words ask for a slow start and a late end: 09:00 to midnight.
    const still = await reachedSilence(dayLabelled("Lisbon"), "after-stop");

    expect(pageOf(still)).toEqual({ start: 9 * MINUTES_PER_HOUR, end: 24 * MINUTES_PER_HOUR });
  });

  it("shows each frame of a day's stream once", async () => {
    for (const day of SILENCE_DAYS) {
      const stills = await Promise.all(SILENCE_MOMENTS.map(({ key }) => silenceOf(day, key)));
      const frames = stills.flatMap((still) => ("unreached" in still ? [] : [still.at]));

      expect(new Set(frames).size).toBe(frames.length);
    }
  });

  it("adds an edge day only for a page frame no other day has", () => {
    const frameOf = (day: SilenceDay) => {
      const itinerary = itineraryOf(day.fixture);
      const { start, end } = pageFrameOf(itinerary.stops, itinerary);
      return `${start}-${end}`;
    };
    const frames = SILENCE_DAYS.map(frameOf);

    for (const [index, day] of SILENCE_DAYS.entries()) {
      if (CURATED.includes(day.label)) continue;
      expect(frames.filter((frame) => frame === frames[index])).toHaveLength(1);
    }
  });

  it("reads each silence once, whichever theme and width shows it", () => {
    const [day] = SILENCE_DAYS;
    if (!day) throw new Error("No days");

    expect(silenceOf(day, "after-last")).toBe(silenceOf(day, "after-last"));
  });
});
