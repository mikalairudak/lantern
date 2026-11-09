// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { goldenReplansOf } from "@/lib/fixtures/replan/golden-replans";
import { replanPromptOf } from "@/lib/live/replan-prompt";
import { picksIssueOf, ReplanRequestSchema, requestMismatchOf, withPicks } from "./request";
import { replanPlanOf } from "./windows";

const GOLDEN = goldenReplansOf(
  readFileSync(new URL("../fixtures/replan/golden-replans.jsonl", import.meta.url), "utf8"),
);

/** Company's windows on the written days, for the round that measures them. */
const WINDOWS = goldenReplansOf(
  readFileSync(new URL("../fixtures/replan/golden-windows.jsonl", import.meta.url), "utf8"),
);

describe("the targeted re-plan's golden set", () => {
  it("holds the four cases the contract names, and an end home by eight and a start around picks", () => {
    expect(GOLDEN.map(({ changed }) => changed)).toEqual([
      "start",
      "start",
      "dinner",
      "end",
      "end",
      "start",
    ]);
    expect(GOLDEN.filter(({ picks }) => Object.keys(picks).length > 0)).toHaveLength(1);
  });

  it.each(GOLDEN.map((golden) => [golden.name, golden] as const))(
    "%s: reads the windows a careful reader marks",
    (_name, { itinerary, request, changed, windows }) => {
      expect(replanPlanOf(itinerary, request, changed)).toEqual({ kind: "targeted", windows });
    },
  );

  it.each(GOLDEN.map((golden) => [golden.name, golden] as const))(
    "%s: is a request the route takes, and a prompt that names every kept stop as it is shown",
    (_name, { itinerary, request, changed, windows, dayRequest, picks }) => {
      const id = crypto.randomUUID();
      const body = { basis: { kind: "kept", id }, request, changed, round: 1, picks };
      expect(ReplanRequestSchema.safeParse(body).success).toBe(true);
      expect(requestMismatchOf(request, dayRequest)).toBeNull();
      expect(picksIssueOf(itinerary, picks)).toBeNull();

      const shown = withPicks(itinerary, picks);
      const prompt = replanPromptOf({ itinerary: shown, request, changed, windows });
      const kept = shown.stops.filter(
        (_, index) => !windows.some(({ from, to }) => index >= from && index <= to),
      );
      for (const stop of kept) {
        const place = [stop.primary, ...stop.alternatives].find(
          ({ id: placeId }) => placeId === stop.selectedPlaceId,
        );
        expect(prompt).toContain(JSON.stringify(place?.name));
        if (place !== stop.primary) expect(prompt).not.toContain(JSON.stringify(stop.primary.name));
      }
    },
  );
});

describe("the windows set", () => {
  it("sends company on the written days, eight calls in all, travel changing the word alone", () => {
    expect(new Set(WINDOWS.map(({ changed }) => changed))).toEqual(new Set(["company"]));
    expect(WINDOWS.reduce((sum, { runs }) => sum + runs, 0)).toBe(8);
  });

  it.each(
    WINDOWS.filter(({ windowsFrom }) => windowsFrom === "route").map(
      (golden) => [golden.name, golden] as const,
    ),
  )("%s: marks the windows the route reads", (_name, { itinerary, request, changed, windows }) => {
    expect(replanPlanOf(itinerary, request, changed)).toEqual({ kind: "targeted", windows });
  });

  it.each(
    WINDOWS.filter(({ windowsFrom }) => windowsFrom === "hand").map(
      (golden) => [golden.name, golden] as const,
    ),
  )(
    "%s: marks by hand windows the route would not write into",
    (_name, { itinerary, request, changed, windows }) => {
      expect(replanPlanOf(itinerary, request, changed).kind).not.toBe("targeted");
      for (const { from, to } of windows) {
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeGreaterThanOrEqual(from);
        expect(to).toBeLessThan(itinerary.stops.length);
      }
    },
  );

  it.each(WINDOWS.map((golden) => [golden.name, golden] as const))(
    "%s: is a request the route takes",
    (_name, { itinerary, request, changed, dayRequest, picks }) => {
      const body = {
        basis: { kind: "kept", id: crypto.randomUUID() },
        request,
        changed,
        round: 1,
        picks,
      };
      expect(ReplanRequestSchema.safeParse(body).success).toBe(true);
      expect(requestMismatchOf(request, dayRequest)).toBeNull();
      expect(picksIssueOf(itinerary, picks)).toBeNull();
      expect(request[changed]).not.toBe(dayRequest[changed]);
    },
  );
});

/** The lines of a set's file, as the round reads them. */
function linesOf(file: string): string[] {
  return readFileSync(new URL(`../fixtures/replan/${file}`, import.meta.url), "utf8")
    .trim()
    .split("\n");
}

describe("the company set", () => {
  it("sends company's cases of the windows set and a start and a dinner of the golden set, ten calls, each line as its source has it", () => {
    const company = linesOf("golden-company.jsonl");
    const windows = linesOf("golden-windows.jsonl").filter((line) =>
      WINDOWS.some(({ name, changed }) => changed === "company" && line.includes(`"${name}"`)),
    );
    const golden = linesOf("golden-replans.jsonl");

    expect(company).toEqual([...windows, golden[0], golden[2]]);
    const cases = goldenReplansOf(company.join("\n"));
    expect(cases.map(({ changed }) => changed)).toEqual([
      "company",
      "company",
      "company",
      "company",
      "start",
      "dinner",
    ]);
    expect(cases.reduce((sum, { runs }) => sum + runs, 0)).toBe(10);
  });
});

describe("the start and company set", () => {
  it("sends the golden set's slow start made early three times, Bologna's family twice and Nafplio's friends once, each as its source has it but its runs", () => {
    const [start, bologna, nafplio] = linesOf("golden-start-company.jsonl");
    const golden = linesOf("golden-replans.jsonl");
    const windows = linesOf("golden-windows.jsonl");

    expect(start).toBe(golden[0]?.replace('"outputText":', '"runs":3,"outputText":'));
    expect(bologna).toBe(windows.find((line) => line.includes('"name":"Bologna\'s company')));
    expect(nafplio).toBe(
      windows
        .find((line) => line.includes('"name":"Nafplio\'s company'))
        ?.replace('"runs":2', '"runs":1'),
    );
    const cases = goldenReplansOf([start, bologna, nafplio].join("\n"));
    expect(cases.map(({ changed, runs }) => `${changed} ${runs}`)).toEqual([
      "start 3",
      "company 2",
      "company 1",
    ]);
  });
});
