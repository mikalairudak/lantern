import { describe, expect, it } from "vitest";
import { KYOTO_REQUEST, LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import {
  forgetYourDay,
  forgetYourDays,
  keepYourDay,
  readYourDays,
  restateYourDay,
  YOUR_DAYS_KEPT,
  YOUR_DAYS_KEY,
  type DayStorage,
  type YourDay,
} from "./your-days";
import { keepCaveats, readCaveats } from "./caveats";

/** A browser's storage held in a map. */
function memoryStorage(): DayStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

/** A storage that throws on every call, as a blocked one does. */
const BLOCKED: DayStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

function dayOf(id: string, change: Partial<YourDay> = {}): YourDay {
  return {
    id,
    request: KYOTO_REQUEST,
    startedAt: "2026-10-31T18:00:00.000Z",
    energies: ["calm", "reflective"],
    ending: "writing",
    seconds: null,
    ...change,
  };
}

describe("the visitor's days", () => {
  it("keeps each day first, and a day kept again once, at the top", () => {
    const storage = memoryStorage();
    keepYourDay(storage, dayOf("a"));
    keepYourDay(storage, dayOf("b", { request: LISBON_REQUEST }));
    keepYourDay(storage, dayOf("a", { ending: "written", seconds: 41 }));

    const days = readYourDays(storage);
    expect(days.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(days[0]).toMatchObject({ ending: "written", seconds: 41 });
  });

  it(`keeps the newest ${YOUR_DAYS_KEPT}`, () => {
    const storage = memoryStorage();
    for (let at = 0; at < YOUR_DAYS_KEPT + 3; at += 1) keepYourDay(storage, dayOf(`day-${at}`));

    const days = readYourDays(storage);
    expect(days).toHaveLength(YOUR_DAYS_KEPT);
    expect(days[0]?.id).toBe(`day-${YOUR_DAYS_KEPT + 2}`);
  });

  it("says how a day it holds now stands in its place, and adds none it does not hold", () => {
    const storage = memoryStorage();
    keepYourDay(storage, dayOf("a"));
    keepYourDay(storage, dayOf("b"));
    restateYourDay(storage, dayOf("a", { ending: "written", seconds: 46 }));
    restateYourDay(storage, dayOf("someone else's"));

    const days = readYourDays(storage);
    expect(days.map(({ id }) => id)).toEqual(["b", "a"]);
    expect(days[1]).toMatchObject({ ending: "written", seconds: 46 });
  });

  it("forgets a re-plan let go, and nothing for one the list does not hold", () => {
    const storage = memoryStorage();
    keepYourDay(storage, dayOf("a"));
    keepYourDay(storage, dayOf("a2"));

    forgetYourDay(storage, "a2");
    forgetYourDay(storage, "never");

    expect(readYourDays(storage).map(({ id }) => id)).toEqual(["a"]);
  });

  it("keeps a day's caveats as long as its row, gone with it", () => {
    const storage = memoryStorage();
    keepYourDay(storage, dayOf("a"));
    keepCaveats(storage, "a", ["she walks slowly"]);
    expect(readCaveats(storage, "a")).toEqual(["she walks slowly"]);

    forgetYourDay(storage, "a");
    expect(readCaveats(storage, "a")).toEqual([]);
  });

  it(`lets a day's caveats go with its row past the newest ${YOUR_DAYS_KEPT}, and with them all`, () => {
    const storage = memoryStorage();
    keepYourDay(storage, dayOf("oldest"));
    keepCaveats(storage, "oldest", ["she walks slowly"]);
    keepYourDay(storage, dayOf("kept"));
    keepCaveats(storage, "kept", ["vegetarian"]);
    for (let day = 0; day < YOUR_DAYS_KEPT - 1; day += 1) keepYourDay(storage, dayOf(`d${day}`));

    expect(readCaveats(storage, "oldest")).toEqual([]);
    expect(readCaveats(storage, "kept")).toEqual(["vegetarian"]);

    forgetYourDays(storage);
    expect(readCaveats(storage, "kept")).toEqual([]);
  });

  it("forgets them all", () => {
    const storage = memoryStorage();
    keepYourDay(storage, dayOf("a"));
    forgetYourDays(storage);

    expect(readYourDays(storage)).toEqual([]);
  });

  it("reads a list it cannot trust as no days", () => {
    const storage = memoryStorage();
    for (const kept of ["not json", '{"id":"a"}', '[{"id":"a"}]']) {
      storage.items.set(YOUR_DAYS_KEY, kept);
      expect(readYourDays(storage)).toEqual([]);
    }
  });

  // Rows as browsers hold them under this key, written out so that a change to the request's
  // shape or to a word's values fails here: a new shape takes a new key, or the days already
  // kept stop reading. The first has every word left to Lantern, the others every word said.
  it("reads the rows browsers already hold under this key", () => {
    const storage = memoryStorage();
    const left =
      '{"id":"3e5b7d9f-1a2c-4e6f-8b0d-2c4e6a8b0d1f","request":{"city":"Kyoto",' +
      '"date":"2026-11-14","timezone":"Asia/Tokyo","citySource":"chosen","energy":"calm",' +
      '"energySource":"chosen","travel":null,"start":null,"dinner":null,"end":null,' +
      '"company":null},"startedAt":"2026-10-31T18:00:00.000Z",' +
      '"energies":["calm","reflective"],"ending":"written","seconds":41}';
    const said = (words: string, energy: string, ending: string) =>
      '{"id":"7a9c1e3b-5d7f-4a2c-9e1b-3d5f7a9c1e3b","request":{"city":"Elche",' +
      `"date":"2026-11-14","timezone":"Europe/Madrid","citySource":"assumed","energy":"${energy}",` +
      `"energySource":"assumed",${words}},"startedAt":"2026-10-31T18:00:00.000Z",` +
      `"energies":["${energy}"],"ending":"${ending}","seconds":null}`;
    const rows = [
      left,
      said(
        '"travel":"on-foot","start":"early","dinner":"early","end":"evening","company":"alone"',
        "balanced",
        "writing",
      ),
      said(
        '"travel":"transit","start":"slow","dinner":"late","end":"early","company":"partner"',
        "lively",
        "cut",
      ),
      said(
        '"travel":"taxi","start":"slow","dinner":"late","end":"late","company":"family"',
        "social",
        "failed",
      ),
      said(
        '"travel":"taxi","start":"slow","dinner":"late","end":"late","company":"friends"',
        "reflective",
        "written",
      ),
    ];
    storage.items.set(YOUR_DAYS_KEY, `[${rows.join(",")}]`);

    expect(YOUR_DAYS_KEY).toBe("lantern.days.v1");
    expect(readYourDays(storage)).toHaveLength(rows.length);
  });

  it("lets go of a row it cannot read, and keeps the days beside it", () => {
    const storage = memoryStorage();
    const halfWritten = { ...dayOf("b"), energies: ["cal"] };
    storage.items.set(YOUR_DAYS_KEY, JSON.stringify([halfWritten, dayOf("a")]));

    expect(readYourDays(storage).map(({ id }) => id)).toEqual(["a"]);
    // The next day kept writes the list as it was read: the days beside the row stay.
    expect(keepYourDay(storage, dayOf("c")).map(({ id }) => id)).toEqual(["c", "a"]);
  });

  it("keeps nothing, and breaks nothing, where the browser keeps nothing", () => {
    expect(readYourDays(null)).toEqual([]);
    expect(readYourDays(BLOCKED)).toEqual([]);
    expect(keepYourDay(BLOCKED, dayOf("a")).map(({ id }) => id)).toEqual(["a"]);
    expect(() => forgetYourDays(BLOCKED)).not.toThrow();
  });
});
