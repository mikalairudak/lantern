// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  dayRunsOf,
  goldenRequestsOf,
  placeChecksOf,
  roundTableMarkdown,
  roundTableOf,
  TABLE_END,
  TABLE_START,
  withTableIn,
  type RoundPlace,
  type RoundRequest,
  type RoundRun,
} from "./readme-table";

const KYOTO: RoundRequest = {
  city: "Kyoto",
  date: "2026-11-21",
  timezone: "Asia/Tokyo",
  citySource: "chosen",
  energy: "calm",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};
const LISBON: RoundRequest = { ...KYOTO, city: "Lisbon", timezone: "Europe/Lisbon" };

interface Check {
  id: string;
  kind: "hard" | "scored";
  passed: boolean;
  value: number | null;
}

const hard = (id: string, passed = true): Check => ({ id, kind: "hard", passed, value: null });
const scored = (id: string, value: number, passed = true): Check => ({
  id,
  kind: "scored",
  passed,
  value,
});

/** A day the normalizer kept, and its day flow measured. */
const SHOWN = [hard("shape"), hard("normalizes"), scored("day-flow", 4000)];

type RoundRecord = NonNullable<RoundRun["day"]>;

function record(overrides: Partial<RoundRecord> = {}): RoundRecord {
  return {
    model: "claude-sonnet-5-5",
    promptVersion: "day-v7",
    startedAt: "2026-10-31T14:21:53.011Z",
    costUsd: 0.09,
    msToFirstToken: 1000,
    msToFinish: 48_000,
    outcome: "complete",
    checks: SHOWN,
    ...overrides,
  };
}

function shadow(overrides: Partial<RoundRecord> = {}): RoundRecord {
  return record({ model: "claude-haiku-5-5", costUsd: 0.003, msToFinish: 20_000, ...overrides });
}

const run = (body: RoundRequest, day: RoundRecord | null, ofShadow: RoundRecord | null) => ({
  body,
  day,
  shadow: ofShadow,
});

const place = (
  role: RoundPlace["role"],
  byName: "verified" | "unverified",
  area: "verified" | "unverified" | null = null,
): RoundPlace => ({ role, byName: { kind: byName }, area: area === null ? null : { kind: area } });

function jsonLines(rows: readonly unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

describe("reading a round's records", () => {
  it("reads each run's request, day and shadow, and leaves what it does not read", () => {
    const line = { index: 1, kind: "live", status: 200, ...run(KYOTO, record(), shadow()) };
    const [read] = dayRunsOf(`${JSON.stringify({ ...line, day: { ...line.day, id: "x" } })}\n\n`);
    expect(read).toEqual(run(KYOTO, record(), shadow()));
  });

  it("refuses a file with no runs, a line that is not JSON, and a record missing a field", () => {
    expect(() => dayRunsOf("\n")).toThrow("holds no runs");
    expect(() => dayRunsOf("{")).toThrow("day-runs.jsonl, line 1, is not JSON");
    const unfinished = { body: KYOTO, day: { ...record(), msToFinish: undefined }, shadow: null };
    expect(() => dayRunsOf(jsonLines([run(KYOTO, null, null), unfinished]))).toThrow(
      "day-runs.jsonl, line 2, is not a round's record",
    );
  });

  it("reads each place's role and checks, and the golden set's requests", () => {
    const checked = { ...place("day", "unverified", "verified"), path: "stops[0].place" };
    expect(placeChecksOf(JSON.stringify(checked))).toEqual([
      place("day", "unverified", "verified"),
    ]);
    expect(goldenRequestsOf(jsonLines([KYOTO, LISBON]))).toEqual([KYOTO, LISBON]);
  });
});

describe("the round as a table", () => {
  it("gives each model its days, places, cost and times", () => {
    const runs = [
      run(KYOTO, record({ msToFirstToken: 900, msToFinish: 40_000 }), shadow()),
      run(LISBON, record({ msToFirstToken: 1300, msToFinish: 60_000, costUsd: 0.11 }), shadow()),
      run(KYOTO, record({ outcome: "cut", msToFirstToken: null, msToFinish: 50_000 }), null),
    ];
    const places = [
      place("day", "verified"),
      place("day", "unverified", "verified"),
      place("day", "verified", "unverified"),
      place("shadow", "unverified"),
    ];
    const [day, ofShadow] = roundTableOf(runs, places, []).models;
    expect(day).toEqual({
      role: "day",
      models: ["claude-sonnet-5-5"],
      requested: 3,
      complete: 2,
      places: {
        byName: { verified: 1, checked: 1 },
        mealsByArea: { verified: 1, checked: 2 },
      },
      meanCostUsd: (0.09 + 0.11 + 0.09) / 3,
      medianMsToFirstToken: 1100,
      medianMsToFinish: 50_000,
    });
    expect(ofShadow).toMatchObject({
      complete: 2,
      requested: 3,
      places: { byName: { verified: 0, checked: 1 }, mealsByArea: { verified: 0, checked: 0 } },
    });
  });

  it("counts a day the normalizer refused only on shape and normalizes", () => {
    const refused = [hard("shape"), hard("normalizes", false), scored("day-flow", 0)];
    const runs = [run(KYOTO, record(), null), run(LISBON, record({ checks: refused }), null)];
    const checks = roundTableOf(runs, null, []).checks;
    expect(checks.map(({ id, kind, tallies }) => [id, kind, tallies.day, tallies.shadow])).toEqual([
      ["shape", "hard", { passed: 2, scored: 2, mean: null }, null],
      ["normalizes", "hard", { passed: 1, scored: 2, mean: null }, null],
      ["day-flow", "scored", { passed: 1, scored: 1, mean: 4000 }, null],
    ]);
  });

  it("tells the golden set from another round", () => {
    const golden = [KYOTO, LISBON];
    const of = (bodies: RoundRequest[]) =>
      roundTableOf(
        bodies.map((body) => run(body, record(), shadow())),
        null,
        golden,
      ).summary;
    expect(of([LISBON, KYOTO])).toMatchObject({ isGoldenSet: true, requests: 2 });
    expect(of([KYOTO, KYOTO])).toMatchObject({ isGoldenSet: false, distinctRequests: 1 });
    expect(of([KYOTO])).toMatchObject({ isGoldenSet: false, cities: ["Kyoto"] });
    expect(roundTableOf([run(KYOTO, record(), null)], null, []).summary.isGoldenSet).toBe(false);
  });

  it("dates the round by its first call, in UTC", () => {
    const runs = [
      run(KYOTO, record({ startedAt: "2026-11-01T00:10:00.000Z" }), null),
      run(LISBON, record({ startedAt: "2026-10-31T23:50:00.000Z" }), null),
    ];
    expect(roundTableOf(runs, null, []).summary.date).toBe("2026-10-31");
    expect(roundTableOf([run(KYOTO, null, null)], null, []).summary.date).toBeNull();
  });
});

describe("the table as Markdown", () => {
  const runs = [
    run(KYOTO, record(), shadow()),
    run(LISBON, record({ checks: [...SHOWN, scored("walk-radius", 0.875, false)] }), shadow()),
    run(LISBON, record(), shadow({ checks: null, outcome: "invalid", msToFirstToken: null })),
  ];

  it("writes a row for each model and each check, and a line on the round", () => {
    const lines = roundTableMarkdown(roundTableOf(runs, [place("day", "verified")], [KYOTO]));
    expect(lines).toEqual([
      "| Model | Role | Days complete | Places by name | Meals by area | Mean cost per day | Median to first token | Median to finish |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| claude-sonnet-5-5 | day | 3 of 3 | 1 of 1 (100%) | 0 of 0 | $0.0900 | 1.0 s | 48.0 s |",
      "| claude-haiku-5-5 | shadow | 2 of 3 | 0 of 0 | 0 of 0 | $0.0030 | 1.0 s | 20.0 s |",
      "",
      "| Check | Kind | Day: passed | Day: mean | Shadow: passed | Shadow: mean |",
      "| --- | --- | --- | --- | --- | --- |",
      "| shape | hard | 3 of 3 |  | 2 of 2 |  |",
      "| normalizes | hard | 3 of 3 |  | 2 of 2 |  |",
      "| day-flow | scored | 3 of 3 | 4000 m | 2 of 2 | 4000 m |",
      "| walk-radius | scored | 0 of 1 | 0.88 |  |  |",
      "",
      "Round of 2026-10-31 on day-v7: the day on claude-sonnet-5-5, its shadow on claude-haiku-5-5; 3 requests (2 distinct) in Kyoto and Lisbon, not the golden set.",
    ]);
  });

  it("says when no place was checked, names the golden set, and closes on a note", () => {
    const golden = [KYOTO, LISBON];
    const goldenRuns = golden.map((body) => run(body, record(), shadow()));
    const lines = roundTableMarkdown(roundTableOf(goldenRuns, null, golden), "First of its kind.");
    expect(lines[2]).toContain("| not checked | not checked |");
    expect(lines.at(-1)).toBe(
      "Round of 2026-10-31 on day-v7: the day on claude-sonnet-5-5, its shadow on claude-haiku-5-5; the golden set's 2 requests. First of its kind.",
    );
  });

  it("leaves a cell empty where a round recorded nothing", () => {
    const lines = roundTableMarkdown(roundTableOf([run(KYOTO, null, null)], null, []));
    expect(lines[2]).toBe("|  | day | 0 of 1 | not checked | not checked |  |  |  |");
    expect(lines.at(-1)).toContain("Round of an unknown date");
    expect(lines.at(-1)).toContain("1 request in Kyoto");
  });
});

describe("writing the table into the README", () => {
  const readme = `# Lantern\n\n${TABLE_START}\nold table\n${TABLE_END}\n\n## Stack\n`;

  it("replaces what stands between the markers and nothing else", () => {
    expect(withTableIn(readme, ["| a |", "| - |"])).toBe(
      `# Lantern\n\n${TABLE_START}\n\n| a |\n| - |\n\n${TABLE_END}\n\n## Stack\n`,
    );
  });

  it("refuses a README without both markers in order", () => {
    expect(() => withTableIn("# Lantern\n", [])).toThrow("README.md has no");
    expect(() => withTableIn(`${TABLE_END}\n${TABLE_START}`, [])).toThrow("README.md has no");
  });
});
