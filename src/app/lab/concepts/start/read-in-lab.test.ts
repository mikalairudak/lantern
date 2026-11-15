import { describe, expect, it } from "vitest";
import { BOLOGNA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { writtenPool } from "@/features/day/written-pool";
import { CANNED_READINGS, readInLab } from "./read-in-lab";

const read = readInLab(writtenPool(), 0);

describe("readInLab", () => {
  it("reads a canned text as the intake would", async () => {
    expect(await read("A quiet day with my kids, nothing too early")).toBe(
      CANNED_READINGS["a quiet day with my kids, nothing too early"],
    );
    expect(await read("somewhere by the sea with the kids")).toBe(
      CANNED_READINGS["somewhere by the sea with the kids"],
    );
  });

  it("dates a canned request on today in its city, as the intake dates a text that names no day", async () => {
    // Half past six in the morning in UTC on a Sunday: still Saturday evening in Oregon.
    const sundayMorningUtc = () => new Date("2026-11-15T06:30:00Z");
    const readThen = readInLab(writtenPool(), 0, sundayMorningUtc);

    expect(await readThen("portland, out late with friends")).toMatchObject({
      kind: "request",
      request: { city: "Portland", timezone: "America/Los_Angeles", date: "2026-11-14" },
    });
    const laterThatDay = readInLab(writtenPool(), 0, () => new Date("2026-11-15T18:00:00Z"));
    expect(await laterThatDay("portland, out late with friends")).toMatchObject({
      request: { date: "2026-11-15" },
    });
  });

  it("reads any other text as the reader with live generation off does, saying nothing back", async () => {
    expect(await read("Bologna, with my dog")).toEqual({
      kind: "request",
      request: BOLOGNA_START_REQUEST,
      readings: [],
      unplaced: [],
      confirmed: [],
    });
    expect(await read("Lisbon")).toEqual({ kind: "unavailable" });
  });

  it("makes Lantern's words the text says the visitor's, as the start screen", async () => {
    expect(await read("Bologna, with friends, slow morning")).toMatchObject({
      request: BOLOGNA_START_REQUEST,
      unplaced: [],
      confirmed: ["start"],
    });
  });
});
