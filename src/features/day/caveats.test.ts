import { describe, expect, it } from "vitest";
import { CAVEATS_KEY, forgetCaveats, keepCaveats, keepCaveatsOf, readCaveats } from "./caveats";
import type { DayStorage } from "./your-days";

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

const DAY = "3e5b7d9f-1a2c-4e6f-8b0d-2c4e6a8b0d1f";
const OTHER = "8a1f2b3c-4d5e-4f60-8172-93a4b5c6d7e8";

describe("a day's caveats on this device", () => {
  it("are read back for the day they were kept for, and for no other", () => {
    const storage = memoryStorage();

    keepCaveats(storage, DAY, ["she walks slowly", "vegetarian"]);

    expect(readCaveats(storage, DAY)).toEqual(["she walks slowly", "vegetarian"]);
    expect(readCaveats(storage, OTHER)).toEqual([]);
  });

  it("let a day with none go", () => {
    const storage = memoryStorage();

    keepCaveats(storage, DAY, ["she walks slowly"]);
    keepCaveats(storage, DAY, []);

    expect(readCaveats(storage, DAY)).toEqual([]);
    expect(storage.items.has(CAVEATS_KEY)).toBe(false);
  });

  it("are kept only for the days the list still holds", () => {
    const storage = memoryStorage();
    keepCaveats(storage, DAY, ["she walks slowly"]);
    keepCaveats(storage, OTHER, ["vegetarian"]);

    keepCaveatsOf(storage, new Set([OTHER]));

    expect(readCaveats(storage, DAY)).toEqual([]);
    expect(readCaveats(storage, OTHER)).toEqual(["vegetarian"]);
  });

  it("are forgotten with the visitor's days, and the key with them", () => {
    const storage = memoryStorage();
    keepCaveats(storage, DAY, ["she walks slowly"]);

    forgetCaveats(storage);

    expect(storage.items.has(CAVEATS_KEY)).toBe(false);
  });

  it("read as none from a list another version wrote, by hand, or a blocked storage", () => {
    const storage = memoryStorage();
    storage.items.set(CAVEATS_KEY, "not json");
    expect(readCaveats(storage, DAY)).toEqual([]);
    storage.items.set(CAVEATS_KEY, JSON.stringify([{ day: DAY, words: ["x"] }]));
    expect(readCaveats(storage, DAY)).toEqual([]);

    expect(readCaveats(BLOCKED, DAY)).toEqual([]);
    expect(() => keepCaveats(BLOCKED, DAY, ["x"])).not.toThrow();
    expect(() => forgetCaveats(BLOCKED)).not.toThrow();
    expect(readCaveats(null, DAY)).toEqual([]);
  });
});
