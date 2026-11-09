// @vitest-environment node
import { describe, expect, it } from "vitest";
import { proposalRunsOf } from "./proposal-path";

const ids = (...each: string[]) => each;
const set = (...each: string[]) => new Set(each);

describe("proposalRunsOf", () => {
  it("runs from the stop both share before a part, through the proposal, to the one after", () => {
    // The walk, the day's lunch and the proposal's, the basilica both share.
    const stops = ids("walk", "lunch", "arros", "basilica");

    expect(proposalRunsOf(stops, set("arros"), set("lunch"))).toEqual([[0, 2, 3]]);
  });

  it("runs once for each part the proposal rewrites, a stop both share between them", () => {
    const stops = ids("walk", "lunch", "arros", "basilica", "garden", "dinner", "tapas", "square");

    expect(proposalRunsOf(stops, set("arros", "tapas", "square"), set("lunch", "dinner"))).toEqual([
      [0, 2, 3],
      [4, 6, 7],
    ]);
  });

  it("starts at the proposal's first stop where its part opens the day", () => {
    const stops = ids("shoren", "honen", "garden");

    expect(proposalRunsOf(stops, set("shoren"), set("honen"))).toEqual([[0, 2]]);
  });

  it("draws nothing with no proposal, and passes by a stop still entering", () => {
    expect(proposalRunsOf(ids("a", "b"), set(), set())).toEqual([]);
    expect(proposalRunsOf(ids("a", "new", "b"), set("new"), set(), set("b"))).toEqual([[0, 1]]);
  });
});
