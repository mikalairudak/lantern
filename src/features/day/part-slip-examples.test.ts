import { describe, expect, it } from "vitest";
import { slipLinesOf } from "./part-slip-lines";
import { SLIP_EXAMPLES, type SlipExample } from "./part-slip-examples";

function exampleOf(start: string): SlipExample {
  const found = SLIP_EXAMPLES.find(({ label }) => label.startsWith(start));
  if (!found) throw new Error(`No example ${start}`);
  return found.example;
}

/** How a part's slip marks its lines, counted. */
function marksOf({ before, after, opens }: SlipExample) {
  const marks = slipLinesOf(before, after, opens).map(({ mark }) => mark.kind);
  return {
    new: marks.filter((kind) => kind === "new").length,
    stays: marks.filter((kind) => kind === "stays").length,
    moved: marks.filter((kind) => kind === "moved").length,
  };
}

describe("the part slip's examples", () => {
  it("mark Elche's two parts as its receipt counts them: three new stops, the garden staying", () => {
    const lunch = exampleOf("one stop");
    const evening = exampleOf("three");

    expect(lunch.fork.receipts.proposal.words).toBe("Dinner 21:00, not 18:15 · 3 new stops");
    expect(marksOf(lunch)).toEqual({ new: 1, stays: 0, moved: 0 });
    expect(marksOf(evening)).toEqual({ new: 2, stays: 1, moved: 0 });
  });

  it("mark Utrecht's morning as its receipt counts it: one new stop, two earlier", () => {
    const morning = exampleOf("two of the day's");

    expect(morning.fork.receipts.proposal.words).toBe(
      "Starts 07:30, not 10:00 · 1 new stop, 2 earlier",
    );
    expect(marksOf(morning)).toEqual({ new: 1, stays: 0, moved: 2 });
  });

  it("set sixteen stops on the whole day, against the day of twelve it was", () => {
    const whole = exampleOf("sixteen");

    expect(whole.after).toHaveLength(16);
    expect(whole.before).toHaveLength(12);
    expect(whole.fork.reach).toBe("whole");
  });

  it("start one part at the day's first stop and end another at its last", () => {
    const first = exampleOf("a part that starts");
    const last = exampleOf("a part that ends");

    expect(first.before[0]?.id).toBe("stop-0");
    expect(last.after.at(-1)?.id.startsWith("r1-")).toBe(true);
  });
});
