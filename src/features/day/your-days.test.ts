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

  it("keeps nothing, and breaks nothing, where the browser keeps nothing", () => {
    expect(readYourDays(null)).toEqual([]);
    expect(readYourDays(BLOCKED)).toEqual([]);
    expect(keepYourDay(BLOCKED, dayOf("a")).map(({ id }) => id)).toEqual(["a"]);
    expect(() => forgetYourDays(BLOCKED)).not.toThrow();
  });
});
