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

  it("reads any other text as the reader with live generation off does, saying nothing back", async () => {
    expect(await read("Bologna, with my dog")).toEqual({
      kind: "request",
      request: BOLOGNA_START_REQUEST,
      readings: [],
      unplaced: [],
      confirmed: [],
    });
    expect(await read("Paris")).toEqual({ kind: "unavailable" });
  });

  it("makes Lantern's words the text says the visitor's, as the start screen", async () => {
    expect(await read("Bologna, with friends, slow morning")).toMatchObject({
      request: BOLOGNA_START_REQUEST,
      unplaced: [],
      confirmed: ["start"],
    });
  });
});
