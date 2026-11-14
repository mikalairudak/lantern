import { describe, expect, it } from "vitest";
import { LONDON_REQUEST } from "@/lib/days/written/city-days";
import { BOLOGNA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { readWrittenOnly } from "./written-reader";
import { writtenPool } from "./written-pool";

const read = readWrittenOnly(writtenPool());

describe("readWrittenOnly", () => {
  it("plays London's day for the start screen's example, and says nothing back", async () => {
    expect(await read("London, with friends")).toEqual({
      kind: "request",
      request: LONDON_REQUEST,
      readings: [],
      unplaced: [],
      confirmed: [],
    });
  });

  it("says nothing back for a phrase it cannot read, or one that is not about the day", async () => {
    for (const text of [
      "Bologna, with my dog, slow morning",
      "Bologna, following my ex without her noticing",
    ]) {
      expect(await read(text)).toMatchObject({ request: BOLOGNA_START_REQUEST, unplaced: [] });
    }
  });

  it("names Lantern's words a phrase says as they are, which makes them the visitor's", async () => {
    // Bologna's day assumes a slow morning and going on foot; its company is the visitor's.
    for (const text of [
      "Bologna, slow morning",
      "Bologna, a slow morning",
      "Bologna, Slow Morning",
    ]) {
      expect(await read(text)).toMatchObject({ unplaced: [], confirmed: ["start"] });
    }
    expect(await read("Bologna, on foot, with friends")).toMatchObject({
      confirmed: ["travel"],
    });
    // Kanazawa's early start is the visitor's already; its dinner and its end are assumed.
    expect(await read("Kanazawa, home by eleven, early dinner")).toMatchObject({
      confirmed: ["dinner", "end"],
    });
    expect(await read("Bologna, by a taxi, the slow morning")).toMatchObject({
      confirmed: ["start"],
    });
  });

  it("names none for a phrase that only means a word, or for a word Lantern only asks", async () => {
    expect(await read("Bologna, with two friends, slow mornings")).toMatchObject({
      confirmed: [],
    });
    // Kanazawa's day asks who it is with, so "alone" is not yet a word of its sentence.
    expect(await read("Kanazawa, alone")).toMatchObject({ confirmed: [] });
  });

  it("answers a text without a written city as the written intake does", async () => {
    expect(await read("Lisbon, slow morning")).toEqual({ kind: "unavailable" });
    // The days written by hand are no days of the site's.
    expect(await read("Lisbon, with friends")).toEqual({ kind: "unavailable" });
  });
});
