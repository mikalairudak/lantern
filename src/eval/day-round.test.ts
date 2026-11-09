// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { DAY_PROMPT_VERSION } from "@/lib/live/day-prompt";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { simulatedModel, type StreamPace } from "@/lib/stream/simulate-day-stream";
import type { CheckResult } from "@/lib/quality/checks";
import {
  baselineOf,
  dayBodiesOf,
  dayReport,
  dayRunLine,
  runDayRound,
  type BaselineRecord,
  type DayServices,
} from "./day-round";

const QUICK: Partial<StreamPace> = { deltaChars: 256 };
const LIVELY_KYOTO: DayRequest = { ...KYOTO_REQUEST, energy: "lively" };
// A written day's city in its own zone, with words its day does not have: the route writes it
// unsigned.
const PORTO: DayRequest = { ...KYOTO_REQUEST, city: "Porto", timezone: "Europe/Lisbon" };

/** A day that streams its dek and closes its stops empty, as day-v1 once did live. */
const EMPTY_DAY = { ...KYOTO_DAY.day, stops: [], alternatives: [] };

/** A day of the schema's shape that the normalizer can show none of: every name is blank. */
const UNSHOWABLE_DAY = {
  ...KYOTO_DAY.day,
  stops: KYOTO_DAY.day.stops.map((stop) => ({ ...stop, place: { ...stop.place, name: " " } })),
};

function services(day = KYOTO_DAY.day): DayServices {
  let lastId = 0;
  const finished = (written = KYOTO_DAY.day) =>
    simulatedModel({ day: written, ending: { kind: "finished" }, pace: QUICK });
  return {
    config: { kind: "ready", config: { visitorHashSalt: "test-salt" } },
    models: { day: finished(day), shadow: finished() },
    log: () => undefined,
    newId: () => `id-${++lastId}`,
    now: () => new Date("2026-10-30T10:00:00Z"),
    maxRetries: 0,
  };
}

function check(id: string, passed: boolean, value: number | null): CheckResult {
  return { id, kind: "scored", passed, value, threshold: null, findings: [] } as CheckResult;
}

describe("dayBodiesOf", () => {
  it("reads one request a line, blank lines aside", () => {
    const text = `${JSON.stringify(KYOTO_REQUEST)}\n\n${JSON.stringify(LIVELY_KYOTO)}\n`;

    expect(dayBodiesOf(text)).toEqual([KYOTO_REQUEST, LIVELY_KYOTO]);
  });

  it("stops at a line that is not a day request, by its number", () => {
    const text = `${JSON.stringify(KYOTO_REQUEST)}\n${JSON.stringify({ city: "Kyoto" })}`;

    expect(() => dayBodiesOf(text)).toThrow("Line 2 is not a day request");
  });
});

describe("baselineOf", () => {
  it("reads the route's records or rows exported from the log, by role and checks", () => {
    const rows = [
      { role: "day", checks: [check("shape", true, null)], cost_micro_usd: 84_840 },
      { role: "shadow", checks: null },
    ];

    expect(baselineOf(JSON.stringify(rows))).toEqual([
      { role: "day", checks: [check("shape", true, null)] },
      { role: "shadow", checks: null },
    ]);
  });

  it("reads an earlier round's day-runs.jsonl, each record with the request it answered", () => {
    const day = { role: "day", checks: [check("shape", true, null)], request: LIVELY_KYOTO };
    const lines = [
      JSON.stringify({ index: 1, body: LIVELY_KYOTO, day, shadow: null }),
      "",
      JSON.stringify({ index: 2, body: PORTO, day: null, shadow: null }),
    ];

    expect(baselineOf(lines.join("\n"))).toEqual([day]);
  });

  it("refuses what is not an array of records", () => {
    expect(() => baselineOf("{}")).toThrow("A baseline is a JSON array of records");
    expect(() => baselineOf(JSON.stringify([{ role: "day" }]))).toThrow(
      "Baseline record 1 has no role or no checks",
    );
  });
});

describe("runDayRound", () => {
  it("writes only the requests the model would, each a day and its shadow, scored", async () => {
    const lines: string[] = [];

    const round = await runDayRound(services(), [KANAZAWA_START_REQUEST, LIVELY_KYOTO, PORTO], {
      onRun: (run) => lines.push(dayRunLine(run)),
    });
    const [written, live, porto] = round.runs;

    expect(written).toMatchObject({ kind: "written", status: null, day: null });
    expect(porto).toMatchObject({ kind: "live", status: 200 });
    expect(porto?.day).toMatchObject({ role: "day", outcome: "complete" });
    // Kyoto's day is no written day's: signed by the round as the intake would sign it, so the
    // route writes it.
    expect(live).toMatchObject({ kind: "live", status: 200 });
    expect(live?.day).toMatchObject({ role: "day", outcome: "complete" });
    expect(live?.shadow).toMatchObject({ role: "shadow", outcome: "complete" });
    expect(live?.day?.checks?.length).toBeGreaterThan(0);
    expect(lines[0]).toBe("day 1 · Kanazawa 2026-11-07 calm: written, not sent");
    expect(lines[1]).toMatch(
      /^day 2 · Kyoto 2026-11-14 lively: complete \$0\.0000, shadow complete, failed: /,
    );
    expect(lines[2]).toMatch(/^day 3 · Porto 2026-11-14 calm: complete /);
  });

  it("reports each request and each check, beside a baseline's", async () => {
    const round = await runDayRound(services(), [LIVELY_KYOTO]);
    const baseline: BaselineRecord[] = [
      { role: "day", checks: [check("walk-radius", false, 0.5), check("day-flow", false, 9400.3)] },
      { role: "day", checks: [check("walk-radius", true, 0.9), check("day-flow", true, 2501.4)] },
      { role: "shadow", checks: [check("walk-radius", true, 1)] },
    ];

    const report = dayReport(round, baseline).join("\n");

    expect(report).toContain(`Day round: ${DAY_PROMPT_VERSION} on claude-sonnet-5-5`);
    expect(report).toContain("1 requests sent of 1");
    expect(report).toContain("Kyoto 2026-11-14 lively  complete");
    expect(report).toContain("before (3 records given) and now:");
    expect(report).toMatch(
      /walk-radius\s+1\/2 · 0\.70\s+1\/1 · 1\.00\s+1\/1 · 1\.00\s+1\/1 · 1\.00/,
    );
    expect(report).toMatch(/day-flow\s+1\/2 · 5951 m\s+1\/1 · \d+ m/);
    expect(report).toContain("What the slider and the swap can reach, on the days as shown:");
    expect(report).toMatch(/days\s+1\s+\d+\.\d\s+\d+ of \d+ \(\d+%\)\s+\d+ of \d+ \(\d+%\)/);
    expect(report).toMatch(/shadows\s+1\s+/);
  });

  it("counts a day the normalizer refused only on shape and normalizes, not as 0 or a pass", async () => {
    const round = await runDayRound(services(UNSHOWABLE_DAY), [LIVELY_KYOTO]);
    const [run] = round.runs;

    const report = dayReport(round).join("\n");

    expect(run?.day).toMatchObject({ outcome: "invalid" });
    // Scored on its own, the day nobody saw measures its stops' flow and passes it.
    expect(run?.day?.checks?.find(({ id }) => id === "day-flow")).toMatchObject({ passed: true });
    expect(report).toContain("A day the normalizer refused counts only on shape and normalizes.");
    expect(report).toMatch(/shape\s+1\/1\s+1\/1/);
    expect(report).toMatch(/normalizes\s+0\/1\s+1\/1/);
    expect(report).toMatch(/day-flow\s+1\/1 · \d+ m\n/);
    expect(report).toMatch(/energy-fit\s+\d\/1 · \d\.\d\d\n/);
  });

  // The schema asks for at least one stop since day-v3, so an empty day no longer parses.
  it("fails a day with no stops on its shape alone", async () => {
    const round = await runDayRound(services(EMPTY_DAY), [LIVELY_KYOTO]);
    const [run] = round.runs;

    expect(run?.day).toMatchObject({ outcome: "invalid" });
    expect(run?.day?.checks).toEqual([expect.objectContaining({ id: "shape", passed: false })]);
    expect(dayReport(round).join("\n")).toMatch(/shape\s+0\/1\s+1\/1/);
  });

  it("compares a round of a few requests with the same requests' records only", async () => {
    const round = await runDayRound(services(), [LIVELY_KYOTO]);
    const baseline: BaselineRecord[] = [
      { role: "day", checks: [check("walk-radius", true, 1)], request: LIVELY_KYOTO },
      { role: "day", checks: [check("walk-radius", false, 0.2)], request: PORTO },
      { role: "shadow", checks: [check("walk-radius", false, 0.4)], request: LIVELY_KYOTO },
    ];

    const report = dayReport(round, baseline).join("\n");

    expect(report).toContain("before (2 of 3 records given, for the requests sent) and now:");
    expect(report).toMatch(/walk-radius\s+1\/1 · 1\.00\s+1\/1 · 1\.00\s+0\/1 · 0\.40/);
  });

  it("sends nothing past the round's own cap, and says the route's answer", async () => {
    const round = await runDayRound(services(), [LIVELY_KYOTO], { capUsd: 0.01 });
    const [run] = round.runs;

    expect(run).toMatchObject({ kind: "live", status: 429, day: null, shadow: null });
    expect(dayRunLine(run!)).toBe(
      "day 1 · Kyoto 2026-11-14 lively: status 429, no shadow, failed: no day to score",
    );
    expect(dayReport(round).join("\n")).toContain("status 429");
  });
});
