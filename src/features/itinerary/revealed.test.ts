import { parsePartialJson } from "ai";
import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { GROWING_TEXT_KEYS, revealedOf } from "./revealed";

const DAY = KYOTO_DAY.day;
const TEXT = dayText(DAY);
const normalized = normalizeDay(KYOTO_DAY.request, DAY);
if (!normalized.ok) throw new Error(`The Kyoto day should normalize: ${normalized.reason}`);
const ITINERARY = normalized.itinerary;
// Parsing the stream at hundreds of lengths takes about a second alone, but past Vitest's
// 5 s default when e2e or another session's gate shares the CPU.
const EVERY_LENGTH_TIMEOUT_MS = 20_000;

/** What partial JSON makes of the stream up to the end of `marker`'s first occurrence. */
async function partialThrough(marker: string, from = 0): Promise<PartialDay> {
  const at = TEXT.indexOf(marker, from);
  if (at < 0) throw new Error(`"${marker}" is not in the Kyoto stream`);
  return partialAt(at + marker.length);
}

async function partialAt(length: number): Promise<PartialDay> {
  const { value } = await parsePartialJson(TEXT.slice(0, length));
  return value as PartialDay;
}

type Leaf = [path: string, value: unknown, field: string | undefined];

/** Every value that holds nothing else, with its path and the field it sits under. */
function leavesOf(value: unknown, path: string[] = [], field?: string): Leaf[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leavesOf(item, [...path, String(index)], field));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leavesOf(child, [...path, key], key));
  }
  return [[path.join("."), value, field]];
}

function finalAt(path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((value, step) => (value as Record<string, unknown>)[step], DAY);
}

describe("revealedOf while the day streams", () => {
  it(
    "never shows a value it will take back: atoms as written, free text as a start of it",
    { timeout: EVERY_LENGTH_TIMEOUT_MS },
    async () => {
      // Every few characters, and at each one of the first stop, where every kind of value
      // ends at least once.
      const firstStopEnd = TEXT.indexOf('"startTime"', TEXT.indexOf('"startTime"') + 1);
      const lengths = Array.from({ length: TEXT.length }, (_, index) => index + 1).filter(
        (length) => length < firstStopEnd || length % 7 === 0,
      );
      for (const length of lengths) {
        const { day } = revealedOf(await partialAt(length), null);
        for (const [path, value, field] of leavesOf(day)) {
          const final = finalAt(path);
          if (typeof value === "string" && field !== undefined && GROWING_TEXT_KEYS.has(field)) {
            expect(String(final).startsWith(value), `${path} at ${length}`).toBe(true);
          } else {
            expect(value, `${path} at ${length}`).toEqual(final);
          }
        }
      }
    },
  );

  it("shows an assumption once the next one has started, not while its word is half written", async () => {
    expect(revealedOf(await partialThrough('"travel":"on-f'), null).day.assumptions).toEqual({});
    expect(revealedOf(await partialThrough('"start":"ea'), null).day.assumptions).toEqual({
      travel: "on-foot",
    });
  });

  it("holds the open question back until the line about the day starts", async () => {
    // Partial JSON repairs a half-written "nu" to null, so null is not final on its own.
    const halfNull = revealedOf(await partialThrough('"company":nu'), null);
    const dekStarted = revealedOf(await partialThrough('"dek":"Honen'), null);

    expect(halfNull.day.assumptions).not.toHaveProperty("company");
    expect(dekStarted.day.assumptions?.company).toBeNull();
    expect(dekStarted.day.dek).toBe("Honen");
    expect(dekStarted.activePath).toBe("dek");
  });

  it("keeps a coordinate out until the field after it starts", async () => {
    const midLongitude = revealedOf(await partialThrough('"lng":135.79'), null);
    const sensoryStarted = revealedOf(await partialThrough('"sensory":{'), null);

    expect(midLongitude.day.stops?.[0]?.place?.coordinates).toEqual({ lat: 35.0234 });
    expect(sensoryStarted.day.stops?.[0]?.place?.coordinates).toEqual({
      lat: 35.0234,
      lng: 135.7974,
    });
  });

  it("names the text being written, down to an item of a list of words", async () => {
    const summary = revealedOf(await partialThrough('"summary":"The grounds'), null);
    const tag = revealedOf(await partialThrough('"aesthetic":["thatch","mo'), null);

    expect(summary.activePath).toBe("stops.0.place.summary");
    expect(summary.day.stops?.[0]?.place?.summary).toBe("The grounds");
    expect(tag.activePath).toBe("stops.0.place.aesthetic.1");
    expect(tag.day.stops?.[0]?.place?.aesthetic).toEqual(["thatch", "mo"]);
  });

  it("writes nothing while the stream sits between two values", async () => {
    const revealed = revealedOf(await partialThrough('"durationMinutes":4'), null);

    expect(revealed.activePath).toBeNull();
    expect(revealed.day.stops?.[0]).toEqual({ startTime: "07:30" });
  });

  it("has nothing to show before the first token", () => {
    expect(revealedOf(null, null)).toEqual({ day: {}, activePath: null, isComplete: false });
  });

  it("leaves the partial it is given as it was", async () => {
    const partial = await partialThrough('"travel":"on-f');
    const before = structuredClone(partial);

    revealedOf(partial, null);
    expect(partial).toEqual(before);
  });
});

describe("revealedOf once the stream has ended", () => {
  it("shows a complete day whole", async () => {
    const revealed = revealedOf(await partialAt(TEXT.length), {
      kind: "complete",
      itinerary: ITINERARY,
    });

    expect(revealed).toEqual({ day: DAY, activePath: null, isComplete: true });
  });

  it.each<DayOutcome>([
    { kind: "cut", itinerary: ITINERARY },
    { kind: "cut", itinerary: null },
    { kind: "disconnected", itinerary: ITINERARY },
    { kind: "disconnected", itinerary: null },
    { kind: "refused" },
    { kind: "invalid", reason: "no stop could be shown", isEmpty: false },
  ])("draws nothing from the partial after $kind: the outcome decides", async (outcome) => {
    // Cut short, the last words would read as finished; a refusal never shows a partial.
    for (const marker of ['"kind":"sacr', '"summary":"The grounds', '"dek":"Honen']) {
      expect(revealedOf(await partialThrough(marker), outcome)).toEqual({
        day: {},
        activePath: null,
        isComplete: false,
      });
    }
  });

  it.each<DayOutcome>([{ kind: "unavailable" }, { kind: "limited" }])(
    "has nothing to show when $kind",
    (outcome) => {
      expect(revealedOf(null, outcome)).toEqual({ day: {}, activePath: null, isComplete: false });
    },
  );
});

describe("GROWING_TEXT_KEYS", () => {
  it("is every plain text field of the generated day, read from its schema, but the clock time", () => {
    expect([...GROWING_TEXT_KEYS].sort()).toEqual(
      ["aesthetic", "dek", "name", "neighborhood", "note", "reason", "summary", "texture"].sort(),
    );
  });
});
