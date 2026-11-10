import { describe, expect, it } from "vitest";
import { KYOTO_DRAGGED } from "@/lib/fixtures/events";
import { InMemoryEventStore, newSalt, type EventEntry } from "./event-store";

const TODAY = "2026-10-30";
const TOMORROW = "2026-10-31";
const VISITOR = "a".repeat(64);
const OTHER_VISITOR = "b".repeat(64);

function entry(visitor: string, day: string = TODAY, id: string = crypto.randomUUID()): EventEntry {
  return { id, visitor, day, event: KYOTO_DRAGGED };
}

describe("a day's salt", () => {
  it("is 32 random bytes as hex, new each time", () => {
    expect(newSalt()).toMatch(/^[0-9a-f]{64}$/);
    expect(newSalt()).not.toBe(newSalt());
  });
});

describe("the in-memory event store", () => {
  it("keeps one salt through a day and makes a new one the next", async () => {
    const store = new InMemoryEventStore();

    const today = await store.saltOn(TODAY);

    expect(await store.saltOn(TODAY)).toBe(today);
    expect(await store.saltOn(TOMORROW)).not.toBe(today);
  });

  it("keeps events up to the visitor's limit, each visitor on their own", async () => {
    const store = new InMemoryEventStore({ perVisitor: 2, perApp: 10 });
    await store.saltOn(TODAY);

    const kept = [];
    for (let index = 0; index < 3; index += 1) kept.push(await store.record(entry(VISITOR)));

    expect(kept).toEqual([true, true, false]);
    expect(await store.record(entry(OTHER_VISITOR))).toBe(true);
    expect(store.entries).toHaveLength(3);
  });

  it("keeps no more than the app's limit, whoever sends them", async () => {
    const store = new InMemoryEventStore({ perVisitor: 10, perApp: 2 });
    await store.saltOn(TODAY);

    await store.record(entry(VISITOR));
    await store.record(entry(OTHER_VISITOR));

    expect(await store.record(entry("c".repeat(64)))).toBe(false);
  });

  it("starts the counts again on a new day, and refuses a day whose salt is gone", async () => {
    const store = new InMemoryEventStore({ perVisitor: 1, perApp: 10 });
    await store.saltOn(TODAY);
    await store.record(entry(VISITOR));

    await store.saltOn(TOMORROW);

    expect(await store.record(entry(VISITOR, TOMORROW))).toBe(true);
    expect(await store.record(entry(OTHER_VISITOR, TODAY))).toBe(false);
  });

  it("keeps only the latest 500", async () => {
    const store = new InMemoryEventStore({ perVisitor: 1_000, perApp: 1_000 });
    await store.saltOn(TODAY);

    for (let index = 0; index < 501; index += 1) {
      await store.record(entry(VISITOR, TODAY, `${index}`));
    }

    expect(store.entries).toHaveLength(500);
    expect(store.entries[0]?.id).toBe("1");
  });
});
