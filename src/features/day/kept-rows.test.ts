import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readKeptRows } from "./kept-rows";

const KEY = "rows";
const storageOf = (kept: string) => ({
  getItem: (key: string) => (key === KEY ? kept : null),
  setItem: () => undefined,
  removeItem: () => undefined,
});

describe("readKeptRows", () => {
  it("lets a row go alone when reading it throws, and keeps the rows beside it", () => {
    const schema = z.strictObject({ id: z.string() }).refine(({ id }) => {
      if (id === "b") throw new Error("This row cannot be read");
      return true;
    });

    const rows = readKeptRows(storageOf('[{"id":"a"},{"id":"b"},{"id":"c"}]'), KEY, schema);

    expect(rows).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("reads a value that is no list, or no value, as no rows", () => {
    const schema = z.strictObject({ id: z.string() });

    for (const kept of ["", "not json", "null", '{"id":"a"}']) {
      expect(readKeptRows(storageOf(kept), KEY, schema)).toEqual([]);
    }
    expect(readKeptRows(null, KEY, schema)).toEqual([]);
  });
});
