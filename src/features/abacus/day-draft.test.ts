import { parsePartialJson } from "ai";
import { describe, expect, it } from "vitest";
import { revealedOf } from "@/features/itinerary/revealed";
import { CURATED_DAYS } from "@/lib/fixtures/curated/curated-days";
import { EDGE_DAYS, REPAIRED_DAY } from "@/lib/fixtures/edge/edge-days";
import { START_DAYS } from "@/lib/days/written/start-days";
import { normalizeDay } from "@/lib/normalizer/normalize";
import {
  lightOf,
  noneAsNull,
  type DayRequest,
  type GeneratedDay,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { DEFAULT_PACE, dayText } from "@/lib/stream/simulate-day-stream";
import {
  alternativesOf,
  completeDraftOf,
  draftDayOf,
  openableStopsOf,
  wholeStopsOf,
  wordsWrittenStopsOf,
  type DayDraft,
  type StopDraft,
} from "./day-draft";

interface Fixture {
  label: string;
  request: DayRequest;
  day: GeneratedDay;
}

const FIXTURES: readonly Fixture[] = [
  ...CURATED_DAYS.map(({ request, day }) => ({ label: request.city, request, day })),
  ...EDGE_DAYS.map(({ edge, request, day }) => ({ label: edge, request, day })),
];

/** Every id the chart lays out by: stops, their places and their versions. */
function idsOf(draft: DayDraft): string[] {
  return draft.stops.flatMap((stop) => [
    stop.id,
    stop.primary.id,
    ...stop.alternatives.map(({ id }) => id),
  ]);
}

/**
 * Each place's id, keyed by where the place is: the normalizer trims names and reorders
 * versions, but never moves a place.
 */
function idsByPlace(draft: DayDraft): Map<string, string> {
  return new Map(
    draft.stops.flatMap((stop) =>
      [stop.primary, ...stop.alternatives].map(({ id, coordinates }) => [
        `${coordinates?.lat},${coordinates?.lng}`,
        id,
      ]),
    ),
  );
}

function itineraryOf({ request, day }: Fixture): Itinerary {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`The fixture does not normalize: ${normalized.reason}`);
  return normalized.itinerary;
}

/** The last draft the stream gives before the day switches to its itinerary. */
async function streamedDraftOf(fixture: Fixture): Promise<DayDraft> {
  const { value } = await parsePartialJson(dayText(fixture.day));
  const itinerary = itineraryOf(fixture);
  return draftDayOf(revealedOf(value as PartialDay, { kind: "complete", itinerary }));
}

describe("completeDraftOf", () => {
  it.each(FIXTURES.map((fixture) => [fixture.label, fixture] as const))(
    "gives every place on %s the id it streamed with, so nothing remounts when it completes",
    async (_label, fixture) => {
      const streamed = idsByPlace(await streamedDraftOf(fixture));
      const completed = idsByPlace(completeDraftOf(itineraryOf(fixture)));
      const shared = [...completed.keys()].filter((place) => streamed.has(place));

      // The normalizer may drop a stop or a version the stream showed; it never gives a
      // place the stream showed another id.
      expect(shared.length).toBeGreaterThan(0);
      shared.forEach((place) => expect(completed.get(place)).toBe(streamed.get(place)));
    },
  );

  it.each(CURATED_DAYS.map((curated) => [curated.request.city, curated] as const))(
    "draws %s with the same stops and versions it streamed",
    async (_city, { request, day }) => {
      const fixture = { label: request.city, request, day };
      const streamed = await streamedDraftOf(fixture);
      const completed = completeDraftOf(itineraryOf(fixture));

      expect(idsOf(completed).sort()).toEqual(idsOf(streamed).sort());
      expect(completed).toMatchObject({ writing: null, isComplete: true, dek: streamed.dek });
    },
  );
});

describe("the versions a day's stream draws", () => {
  /** Every version the stream draws on its way, a token-sized delta apart, by id. */
  async function drawnVersionsOf(day: GeneratedDay): Promise<Set<string>> {
    const text = dayText(day);
    const drawn = new Set<string>();
    // Versions are written after every stop, under the day's last key.
    for (
      let at = text.indexOf('"alternatives"');
      at <= text.length;
      at += DEFAULT_PACE.deltaChars
    ) {
      const { value } = await parsePartialJson(text.slice(0, at));
      const draft = draftDayOf(revealedOf((value ?? {}) as PartialDay, null));
      draft.stops.forEach((stop) => stop.alternatives.forEach(({ id }) => drawn.add(id)));
    }
    return drawn;
  }

  const PLAYED = [...CURATED_DAYS, ...START_DAYS].map(({ request, day }) => ({
    label: request.city,
    request,
    day,
  }));

  // A version the finished day drops would leave the chart as the day lands, a bead fading
  // with no hand on the page: Kanazawa's start drew four past the walk from their stops.
  it.each(PLAYED.map((fixture) => [fixture.label, fixture] as const))(
    "never draws a version on %s that leaves as the day lands",
    async (_label, fixture) => {
      const drawn = await drawnVersionsOf(fixture.day);
      const kept = new Set(idsOf(completeDraftOf(itineraryOf(fixture))));

      expect(drawn.size).toBeGreaterThan(0);
      expect([...drawn].filter((id) => !kept.has(id))).toEqual([]);
    },
  );

  const stopAt = (lat: number, name: string): StopDraft => ({
    id: `stop-${name}`,
    startTime: "10:00",
    durationMinutes: 60,
    primary: {
      id: `stop-${name}:p`,
      name,
      coordinates: { lat, lng: 135.7 },
      sensory: { energy: "calm" },
    },
    alternatives: [],
    selectedPlaceId: `stop-${name}:p`,
  });
  const optionAt = (lat: number | undefined, name: string) => ({
    name,
    coordinates: { lat, lng: 135.7 },
    sensory: { energy: "lively" as const },
  });

  it("draws a version within the walk, and none past it, nor one spelled as a stop of the day", () => {
    const stop = stopAt(35, "Honen-in");
    const day = [stop, stopAt(35.001, "Nishiki Market")];
    // 0.005° of latitude is about 556 m; 0.01° about 1,112 m, past the 800 m walk.
    const options = [
      optionAt(35.005, "Near"),
      optionAt(35.01, "Far"),
      optionAt(35, "Nishiki market"),
    ];

    expect(alternativesOf(stop, options, day).map(({ name }) => name)).toEqual(["Near"]);
  });

  it("draws no more versions than the normalizer keeps", () => {
    const stop = stopAt(35, "Honen-in");
    const options = [optionAt(35, "One"), optionAt(35, "Two"), optionAt(35, "Three")];

    expect(alternativesOf(stop, options, [stop]).map(({ name }) => name)).toEqual(["One", "Two"]);
  });
});

describe("draftDayOf", () => {
  const place = { name: "Honen-in" };

  it("places a stop timed without its leading zero as the normalizer will, while it streams", async () => {
    const fixture = { label: REPAIRED_DAY.edge, ...REPAIRED_DAY };
    const streamed = await streamedDraftOf(fixture);
    const completed = completeDraftOf(itineraryOf(fixture));

    expect(REPAIRED_DAY.day.stops[0]?.startTime).toBe("9:45");
    expect(streamed.stops[0]).toMatchObject({ id: "stop-0", startTime: "09:45" });
    expect(completed.stops[0]).toMatchObject({ id: "stop-0", startTime: "09:45" });
  });

  it("weighs a place's energy only once its best window is written, the last its row shows", () => {
    const sensory = {
      energy: "calm",
      acoustic: "hushed",
      crowd: "sparse",
      texture: "Brooms on the stone path",
    } as const;
    const unlit: PartialDay = {
      stops: [{ startTime: "07:30", durationMinutes: 45, place: { ...place, sensory } }],
    };
    const lit: PartialDay = {
      stops: [
        {
          startTime: "07:30",
          durationMinutes: 45,
          place: {
            ...place,
            sensory,
            light: { exposure: "open", orientation: "none", bestWindow: "none", note: "Flat" },
          },
        },
      ],
    };

    const [waiting] = draftDayOf(revealedOf(unlit, null)).stops;
    const [weighed] = draftDayOf(revealedOf(lit, null)).stops;

    expect(waiting?.primary.sensory).toEqual({
      acoustic: "hushed",
      crowd: "sparse",
      texture: "Brooms on the stone path",
    });
    expect(weighed?.primary.sensory?.energy).toBe("calm");
    expect(weighed?.primary.light?.bestWindow).toBeNull();
  });

  it("leaves out a stop whose time is not a time of day", () => {
    const day: PartialDay = {
      stops: [
        { startTime: "noon", durationMinutes: 60, place },
        { startTime: "13:00", durationMinutes: 60, place },
      ],
    };

    const draft = draftDayOf(revealedOf(day, null));

    expect(draft.stops.map(({ id, startTime }) => ({ id, startTime }))).toEqual([
      { id: "stop-1", startTime: "13:00" },
    ]);
  });
});

// Parsing the stream at hundreds of lengths takes about a second alone, but past Vitest's
// 5 s default when e2e or another session's gate shares the CPU.
const EVERY_LENGTH_TIMEOUT_MS = 20_000;

describe("wordsWrittenStopsOf", () => {
  const kyoto = FIXTURES[0];
  if (!kyoto) throw new Error("No curated day to stream");
  const text = dayText(kyoto.day);
  const draftAt = async (length: number): Promise<DayDraft> => {
    const { value } = await parsePartialJson(text.slice(0, length));
    return draftDayOf(revealedOf((value ?? {}) as PartialDay, null));
  };
  /** Everything a stop's row shows, as far as the stream has written it. */
  const rowOf = ({ primary }: StopDraft) => ({
    name: primary.name,
    kind: primary.kind,
    neighborhood: primary.neighborhood,
    energy: primary.sensory?.energy,
    texture: primary.sensory?.texture,
    bestWindow: primary.light?.bestWindow,
  });

  it(
    "lets a stop in only once all its row shows is final, the stops in order",
    { timeout: EVERY_LENGTH_TIMEOUT_MS },
    async () => {
      const finals = kyoto.day.stops.map(({ place }) => ({
        name: place.name,
        kind: place.kind,
        neighborhood: place.neighborhood,
        energy: place.sensory.energy,
        texture: place.sensory.texture,
        bestWindow: noneAsNull(place.light.bestWindow),
      }));
      const stopsEnd = text.indexOf('"alternatives"');
      const heldBack = new Set<string>();
      for (let length = 0; length <= stopsEnd; length += 7) {
        const { stops } = await draftAt(length);
        const written = wordsWrittenStopsOf(stops);
        // The first stops, in order, each as it will stay.
        expect(written, `at ${length}`).toEqual(stops.slice(0, written.length));
        written.forEach((stop, index) =>
          expect(rowOf(stop), `at ${length}`).toEqual(finals[index]),
        );
        const writing = stops[written.length];
        if (writing) heldBack.add(writing.id);
      }
      // Every stop is held back for a while once placed, as its words are written.
      expect(heldBack.size).toBe(kyoto.day.stops.length);
    },
  );

  it("is the same list once every stop is written", () => {
    const { stops } = completeDraftOf(itineraryOf(kyoto));
    expect(wordsWrittenStopsOf(stops)).toBe(stops);
  });
});

describe("wholeStopsOf", () => {
  const kyoto = FIXTURES[0];
  if (!kyoto) throw new Error("No curated day to stream");
  const text = dayText(kyoto.day);
  const draftAt = async (length: number): Promise<DayDraft> => {
    const { value } = await parsePartialJson(text.slice(0, length));
    return draftDayOf(revealedOf((value ?? {}) as PartialDay, null));
  };
  /** What a stop's sheet says of its place, down to the last line the stream writes of it. */
  const sheetOf = ({ primary }: StopDraft) => ({
    name: primary.name,
    neighborhood: primary.neighborhood,
    summary: primary.summary,
    aesthetic: primary.aesthetic,
    sensory: primary.sensory,
    light: primary.light,
  });

  it.each([7, 23])(
    "counts only stops whose every line is final, at every %i characters",
    async (step) => {
      const finals = kyoto.day.stops.map(({ place }) => ({
        name: place.name,
        neighborhood: place.neighborhood,
        summary: place.summary,
        aesthetic: place.aesthetic,
        sensory: place.sensory,
        // As the app reads it: a direction or window the place has none of is null.
        light: lightOf(place.light),
      }));
      const stopsEnd = text.indexOf('"alternatives"');
      let wasWhole = 0;
      for (let length = 0; length <= text.length; length += step) {
        const draft = await draftAt(length);
        const whole = wholeStopsOf(draft);
        draft.stops
          .slice(0, whole)
          .forEach((stop, index) => expect(sheetOf(stop), `at ${length}`).toEqual(finals[index]));
        // The stop being written is never whole until the stops have all been written.
        if (length < stopsEnd) expect(whole, `at ${length}`).toBeLessThan(kyoto.day.stops.length);
        // A stop once whole stays so.
        expect(whole, `at ${length}`).toBeGreaterThanOrEqual(wasWhole);
        wasWhole = whole;
      }
      expect(wasWhole).toBe(kyoto.day.stops.length);
    },
  );

  it("counts every stop of a complete day", () => {
    const draft = completeDraftOf(itineraryOf(kyoto));
    expect(wholeStopsOf(draft)).toBe(draft.stops.length);
  });
});

describe("openableStopsOf", () => {
  const revealedAt = async (text: string, length: number) => {
    const { value } = await parsePartialJson(text.slice(0, length));
    return revealedOf((value ?? {}) as PartialDay, null);
  };

  it.each(FIXTURES.map((fixture) => [fixture.label, fixture] as const))(
    "opens only stops the finished %s shows as they were written, its hours too",
    async (_label, fixture) => {
      const text = dayText(fixture.day);
      const finals = new Map(itineraryOf(fixture).stops.map((stop) => [stop.id, stop]));
      for (let length = 0; length <= text.length; length += 41) {
        const revealed = await revealedAt(text, length);
        const draft = draftDayOf(revealed);
        for (const id of openableStopsOf(revealed.day, draft)) {
          const stop = draft.stops.find((each) => each.id === id);
          const final = finals.get(id);
          expect(final, `${id} at ${length}`).toBeDefined();
          expect(
            { start: stop?.startTime, minutes: stop?.durationMinutes, name: stop?.primary.name },
            `${id} at ${length}`,
          ).toEqual({
            start: final?.startTime,
            minutes: final?.durationMinutes,
            name: final?.primary.name,
          });
        }
      }
    },
  );

  it("opens every whole stop of a day written cleanly", async () => {
    const kyoto = FIXTURES[0];
    if (!kyoto) throw new Error("No curated day to stream");
    const text = dayText(kyoto.day);
    // Its versions begun, so its last stop is whole too.
    const revealed = await revealedAt(text, text.indexOf('"alternatives"') + 1500);
    const draft = draftDayOf(revealed);
    expect(wholeStopsOf(draft)).toBe(kyoto.day.stops.length);
    expect([...openableStopsOf(revealed.day, draft)]).toEqual(draft.stops.map(({ id }) => id));
  });

  it("keeps a stop the finished day repairs shut until it is complete", async () => {
    const text = dayText(REPAIRED_DAY.day);
    const revealed = await revealedAt(text, text.indexOf('"alternatives"') + 300);
    // Of eight stops one is written as it will stay: the rest are reformatted, trimmed, cut
    // short where the next starts, out of order, rounded or clamped.
    expect([...openableStopsOf(revealed.day, draftDayOf(revealed))]).toEqual(["stop-3"]);
  });
});
