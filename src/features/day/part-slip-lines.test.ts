import { describe, expect, it } from "vitest";
import type { StopDraft } from "@/features/abacus/day-draft";
import { WHOLE_DAY_WINDOW } from "@/features/abacus/replan-frame";
import { heldLinesOf, partsOf, slipFootOf, slipLinesOf } from "./part-slip-lines";

/** A stop at a place, as far as the slip reads it. */
function stopAt(
  id: string,
  startTime: string,
  durationMinutes: number,
  name: string,
  kind = "museum",
): StopDraft {
  return {
    id,
    startTime,
    durationMinutes,
    primary: { id: `${id}:p`, name, kind: kind as never },
    alternatives: [],
    selectedPlaceId: `${id}:p`,
  };
}

const COFFEE = stopAt("stop-0", "10:00", 60, "Coffee on the Oudegracht", "coffee");
const TOWER = stopAt("stop-1", "11:15", 75, "Domtoren", "viewpoint");

describe("slipLinesOf", () => {
  it("marks a place the part does not have as new, with what it is and until when", () => {
    const park = stopAt("r1-stop-2", "10:00", 90, "Park Lepelenburg", "garden");

    expect(slipLinesOf([COFFEE, TOWER], [park], null)).toEqual([
      {
        id: "r1-stop-2",
        time: "10:00",
        name: "Park Lepelenburg",
        mark: { kind: "new", what: "garden\u00a0· until\u00a011:30" },
      },
    ]);
  });

  it("names a meal by its hour, as the plan's rows do", () => {
    const lunch = stopAt("r1-stop-0", "13:15", 90, "Arròs on Passeig de l'Estació", "food");

    expect(slipLinesOf([], [lunch], null)[0]?.mark).toEqual({
      kind: "new",
      what: "lunch\u00a0· until\u00a014:45",
    });
  });

  it("marks a place kept at its hour as staying, and one at another hour with the hour it had", () => {
    const earlier = stopAt("r1-stop-0", "07:30", 45, "Coffee on the Oudegracht", "coffee");
    const same = stopAt("stop-1", "11:15", 60, "Domtoren", "viewpoint");

    expect(slipLinesOf([COFFEE, TOWER], [earlier, same], null).map(({ mark }) => mark)).toEqual([
      { kind: "moved", hour: "10:00" },
      { kind: "stays" },
    ]);
  });

  it("finds a place by its spelling, not its id, and takes each of the part's stops once", () => {
    const square = stopAt("stop-0", "09:00", 30, "Plaça de Baix", "walk");
    const twice = [
      stopAt("stop-0", "09:00", 30, "plaça de baix", "walk"),
      stopAt("stop-1", "12:00", 30, "Plaça de Baix", "walk"),
    ];

    expect(slipLinesOf([square], twice, null).map(({ mark }) => mark)).toEqual([
      { kind: "stays" },
      { kind: "new", what: "walk\u00a0· until\u00a012:30" },
    ]);
  });

  it("reads the place the stop's plan shows, a version where it names one", () => {
    const swapped: StopDraft = {
      ...COFFEE,
      alternatives: [{ id: "stop-0:a1", name: "Domtoren", sensory: { energy: "calm" } }],
      selectedPlaceId: "stop-0:a1",
    };

    expect(slipLinesOf([TOWER], [swapped], null)[0]?.name).toBe("Domtoren");
  });
});

describe("slipLinesOf past midnight", () => {
  // The cocktails before the part end at a quarter to one, on the day's running clock.
  const OPENS = 24 * 60 + 45;
  const RIVER = stopAt("stop-2", "01:00", 180, "Late drinks on the river", "bar");

  it("times a part that opens after midnight on the day's clock: a meal there is a late supper", () => {
    const supper = stopAt("r1-stop-0", "00:50", 40, "Tinned fish on Pink Street", "food");

    expect(slipLinesOf([RIVER], [supper], OPENS)[0]).toEqual({
      id: "r1-stop-0",
      time: "00:50",
      name: "Tinned fish on Pink Street",
      mark: { kind: "new", what: "late supper\u00a0· until\u00a001:30" },
    });
  });

  it("keeps a stop at its hour past midnight, whichever stop heads each version's part", () => {
    const cocktails = stopAt("stop-1", "23:30", 60, "Cocktails in Príncipe Real", "bar");
    const river = stopAt("stop-2", "00:45", 120, "Late drinks on the river", "bar");
    const supper = stopAt("r1-stop-0", "00:15", 30, "Tinned fish on Pink Street", "food");

    expect(
      slipLinesOf([cocktails, river], [supper, river], 23 * 60).map(({ mark }) => mark),
    ).toEqual([{ kind: "new", what: "late supper\u00a0· until\u00a000:45" }, { kind: "stays" }]);
    expect(slipFootOf([cocktails, river], [supper, river], "part", 23 * 60)).toBe(
      "in place of 23:30",
    );
  });
});

describe("slipLinesOf as the stream writes", () => {
  it("keeps a drawn line's mark when a later stop at the same place arrives", () => {
    const square = stopAt("stop-0", "15:00", 30, "Plaça de Baix", "walk");
    const earlier = stopAt("r1-stop-0", "14:00", 30, "Plaça de Baix", "walk");
    const atItsHour = stopAt("r1-stop-1", "15:00", 30, "Plaça de Baix", "walk");

    const drawn = slipLinesOf([square], [earlier], null)[0]?.mark;
    const after = slipLinesOf([square], [earlier, atItsHour], null).map(({ mark }) => mark);

    expect(drawn).toEqual({ kind: "moved", hour: "15:00" });
    expect(after).toEqual([drawn, { kind: "new", what: "walk\u00a0· until\u00a015:30" }]);
  });
});

describe("slipFootOf", () => {
  it("names the hours the other version takes, those not kept at their own hour", () => {
    const stays = stopAt("stop-0", "10:00", 60, "Coffee on the Oudegracht", "coffee");
    const park = stopAt("r1-stop-1", "11:15", 90, "Park Lepelenburg", "garden");

    expect(slipFootOf([COFFEE, TOWER], [stays, park], "part", null)).toBe("in place of 11:15");
  });

  it("joins two hours with and, and three with a comma before", () => {
    const third = stopAt("stop-2", "12:45", 60, "Pancakes on the Domplein", "food");

    expect(slipFootOf([COFFEE, TOWER], [], "part", null)).toBe("in place of 10:00 and 11:15");
    expect(slipFootOf([COFFEE, TOWER, third], [], "part", null)).toBe(
      "in place of 10:00, 11:15 and 12:45",
    );
  });

  it("says the whole day for a whole day's, and nothing where every stop stays", () => {
    expect(slipFootOf([COFFEE], [COFFEE], "whole", null)).toBe("in place of the whole day");
    expect(slipFootOf([COFFEE], [COFFEE], "part", null)).toBeNull();
  });
});

describe("heldLinesOf", () => {
  it("holds a line for each of the part's stops and one more, and one each for a whole day", () => {
    expect(heldLinesOf(1, "part")).toBe(2);
    expect(heldLinesOf(9, "whole")).toBe(9);
  });
});

describe("partsOf", () => {
  it("gives each window the stops that start inside it, and a whole day's window all of them", () => {
    const lunch = stopAt("stop-2", "12:45", 60, "Pancakes on the Domplein", "food");
    const stops = [COFFEE, TOWER, lunch];

    expect(partsOf(stops, [{ opens: null, closes: 12 * 60 + 45 }])).toEqual([[COFFEE, TOWER]]);
    expect(partsOf(stops, [{ opens: 12 * 60 + 30, closes: null }])).toEqual([[lunch]]);
    expect(partsOf(stops, [WHOLE_DAY_WINDOW])).toEqual([stops]);
  });
});
