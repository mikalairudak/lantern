import { z } from "zod";
import { measureOf, tallyOf, type CheckTally } from "./tally.ts";

/**
 * The README's quality table (`pnpm eval:table`): a recorded day round, read from its
 * `day-runs.jsonl` and, when its places were checked, its `place-checks.jsonl`, as a row for
 * each model and a row for each check, counted as the round's own report counts them
 * (`tally.ts`). It reads only what the round saved, and calls nothing. Plain Node runs
 * the script, so this file imports nothing of the app's but the tally.
 */

const ROLES = ["day", "shadow"] as const;
type Role = (typeof ROLES)[number];

/** A request as the round saved it; its words are read only to tell requests apart. */
const RequestSchema = z.object({
  city: z.string(),
  date: z.string(),
  timezone: z.string(),
  citySource: z.string(),
  energy: z.string(),
  energySource: z.string(),
  travel: z.string().nullable(),
  start: z.string().nullable(),
  dinner: z.string().nullable(),
  end: z.string().nullable(),
  company: z.string().nullable(),
});
export type RoundRequest = z.infer<typeof RequestSchema>;

const CheckSchema = z.object({
  id: z.string(),
  kind: z.enum(["hard", "scored"]),
  passed: z.boolean(),
  value: z.number().nullable(),
});

/** A day or shadow's record (`GenerationRecord`), the fields the table reads. */
const RecordSchema = z.object({
  model: z.string(),
  promptVersion: z.string(),
  startedAt: z.string(),
  costUsd: z.number().nullable(),
  msToFirstToken: z.number().nullable(),
  msToFinish: z.number(),
  outcome: z.string(),
  checks: z.array(CheckSchema).nullable(),
});
type RoundRecord = z.infer<typeof RecordSchema>;

/** One line of `day-runs.jsonl` (`DayRoundRun`): a request, its day and its shadow. */
const RunSchema = z.object({
  body: RequestSchema,
  day: RecordSchema.nullable(),
  shadow: RecordSchema.nullable(),
});
export type RoundRun = z.infer<typeof RunSchema>;

const VerdictSchema = z.object({ kind: z.enum(["verified", "unverified"]) });

/** One line of `place-checks.jsonl` (`CheckedPlace`): whose place it is, and its checks. */
const PlaceSchema = z.object({
  role: z.enum(ROLES),
  area: VerdictSchema.nullable(),
  byName: VerdictSchema,
});
export type RoundPlace = z.infer<typeof PlaceSchema>;

function jsonLinesOf<Schema extends z.ZodType>(
  text: string,
  schema: Schema,
  file: string,
): z.infer<Schema>[] {
  return text
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== "")
    .map(({ line, number }) => {
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch {
        throw new Error(`${file}, line ${number}, is not JSON`);
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new Error(
          `${file}, line ${number}, is not a round's record: ${parsed.error.message}`,
        );
      }
      return parsed.data;
    });
}

/** A round's `day-runs.jsonl`; a round with no runs has no table to write. */
export function dayRunsOf(text: string): RoundRun[] {
  const runs = jsonLinesOf(text, RunSchema, "day-runs.jsonl");
  if (runs.length === 0) throw new Error("day-runs.jsonl holds no runs");
  return runs;
}

/** A round's `place-checks.jsonl`. */
export function placeChecksOf(text: string): RoundPlace[] {
  return jsonLinesOf(text, PlaceSchema, "place-checks.jsonl");
}

/** The golden set's requests (`src/lib/fixtures/live/golden-days.jsonl`), to tell a round of it by. */
export function goldenRequestsOf(text: string): RoundRequest[] {
  return jsonLinesOf(text, RequestSchema, "golden-days.jsonl");
}

/** Places of one sort the round checked, and how many of them the route would show verified. */
export interface PlaceCount {
  verified: number;
  checked: number;
}

/**
 * A role's places, told apart as the route checks them: a named place by its name, a meal by
 * its area. Apart, because the meals confirm nearly always and would carry a share of both.
 */
export interface PlaceCounts {
  byName: PlaceCount;
  mealsByArea: PlaceCount;
}

export interface ModelRow {
  role: Role;
  /** The models the role's records name: one, unless the round's records were mixed. */
  models: string[];
  requested: number;
  /** Days the model finished whole (outcome `complete`). */
  complete: number;
  /** Null when the round checked no place. */
  places: PlaceCounts | null;
  meanCostUsd: number | null;
  medianMsToFirstToken: number | null;
  medianMsToFinish: number | null;
}

export interface CheckRow {
  id: string;
  kind: "hard" | "scored";
  tallies: Record<Role, CheckTally | null>;
}

export interface RoundSummary {
  /** The day the round's first call started, in UTC. */
  date: string | null;
  promptVersions: string[];
  requests: number;
  distinctRequests: number;
  /** In the order the requests named them. */
  cities: string[];
  /** Whether the round sent the golden set's requests, each once, and nothing else. */
  isGoldenSet: boolean;
}

export interface RoundTable {
  models: ModelRow[];
  checks: CheckRow[];
  summary: RoundSummary;
}

function recordsOf(runs: readonly RoundRun[], role: Role): RoundRecord[] {
  return runs.flatMap((run) => {
    const record = run[role];
    return record === null ? [] : [record];
  });
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function meanOf(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function medianOf(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  const upper = sorted[Math.floor(sorted.length / 2)];
  if (upper === undefined) return null;
  const lower = sorted[Math.ceil(sorted.length / 2) - 1] ?? upper;
  return (lower + upper) / 2;
}

function placeCountOf(verdicts: readonly ("verified" | "unverified")[]): PlaceCount {
  return {
    verified: verdicts.filter((kind) => kind === "verified").length,
    checked: verdicts.length,
  };
}

function placeCountsOf(places: readonly RoundPlace[]): PlaceCounts {
  return {
    byName: placeCountOf(
      places.flatMap(({ area, byName }) => (area === null ? [byName.kind] : [])),
    ),
    mealsByArea: placeCountOf(places.flatMap(({ area }) => (area === null ? [] : [area.kind]))),
  };
}

function modelRowOf(
  runs: readonly RoundRun[],
  places: readonly RoundPlace[] | null,
  role: Role,
): ModelRow {
  const records = recordsOf(runs, role);
  const ofRole = places?.filter((place) => place.role === role) ?? null;
  return {
    role,
    models: distinct(records.map(({ model }) => model)),
    requested: runs.length,
    complete: records.filter(({ outcome }) => outcome === "complete").length,
    places: ofRole === null ? null : placeCountsOf(ofRole),
    meanCostUsd: meanOf(records.flatMap(({ costUsd }) => (costUsd === null ? [] : [costUsd]))),
    medianMsToFirstToken: medianOf(
      records.flatMap(({ msToFirstToken }) => (msToFirstToken === null ? [] : [msToFirstToken])),
    ),
    medianMsToFinish: medianOf(records.map(({ msToFinish }) => msToFinish)),
  };
}

/** Every check the records carry, in the order the checks run, tallied for each role. */
function checkRowsOf(runs: readonly RoundRun[]): CheckRow[] {
  const records = ROLES.flatMap((role) => recordsOf(runs, role));
  const checks = records.flatMap(({ checks }) => checks ?? []);
  return distinct(checks.map(({ id }) => id)).map((id) => ({
    id,
    kind: checks.find((check) => check.id === id)?.kind ?? "hard",
    tallies: {
      day: tallyOf(recordsOf(runs, "day"), id),
      shadow: tallyOf(recordsOf(runs, "shadow"), id),
    },
  }));
}

/** A request's words in one string, so two requests for the same day compare equal. */
function requestKeyOf(request: RoundRequest): string {
  return JSON.stringify(RequestSchema.keyof().options.map((field) => request[field]));
}

function summaryOf(runs: readonly RoundRun[], golden: readonly RoundRequest[]): RoundSummary {
  const records = ROLES.flatMap((role) => recordsOf(runs, role));
  const keys = runs.map(({ body }) => requestKeyOf(body));
  const goldenKeys = golden.map(requestKeyOf);
  const starts = records.map(({ startedAt }) => startedAt).sort();
  return {
    date: starts[0]?.slice(0, "YYYY-MM-DD".length) ?? null,
    promptVersions: distinct(records.map(({ promptVersion }) => promptVersion)),
    requests: runs.length,
    distinctRequests: distinct(keys).length,
    cities: distinct(runs.map(({ body }) => body.city)),
    isGoldenSet:
      golden.length > 0 &&
      keys.length === goldenKeys.length &&
      distinct(keys).length === keys.length &&
      goldenKeys.every((key) => keys.includes(key)),
  };
}

/** A recorded round as the README's table, given the golden set to tell it by. */
export function roundTableOf(
  runs: readonly RoundRun[],
  places: readonly RoundPlace[] | null,
  golden: readonly RoundRequest[],
): RoundTable {
  return {
    models: ROLES.map((role) => modelRowOf(runs, places, role)),
    checks: checkRowsOf(runs),
    summary: summaryOf(runs, golden),
  };
}

const PERCENT = 100;
const MS_PER_SECOND = 1000;

function markdownRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function markdownTable(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  return [markdownRow(header), markdownRow(header.map(() => "---")), ...rows.map(markdownRow)];
}

function placesCell(places: PlaceCount | null): string {
  if (places === null) return "not checked";
  const { verified, checked } = places;
  const of = `${verified} of ${checked}`;
  return checked === 0 ? of : `${of} (${Math.round((verified / checked) * PERCENT)}%)`;
}

function dollarsCell(amount: number | null): string {
  return amount === null ? "" : `$${amount.toFixed(4)}`;
}

function secondsCell(ms: number | null): string {
  return ms === null ? "" : `${(ms / MS_PER_SECOND).toFixed(1)} s`;
}

function passedCell(tally: CheckTally | null): string {
  return tally === null ? "" : `${tally.passed} of ${tally.scored}`;
}

function meanCell(id: string, tally: CheckTally | null): string {
  return tally?.mean == null ? "" : measureOf(id, tally.mean);
}

/** "Kyoto, Alicante and Lisbon". */
function listOf(items: readonly string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function requestsOf({ requests, distinctRequests, cities, isGoldenSet }: RoundSummary): string {
  if (isGoldenSet) return `the golden set's ${requests} requests`;
  const repeats = distinctRequests < requests ? ` (${distinctRequests} distinct)` : "";
  const counted = `${requests} ${requests === 1 ? "request" : "requests"}`;
  return `${counted}${repeats} in ${listOf(cities)}, not the golden set`;
}

function summaryLine(table: RoundTable, note: string): string {
  const { summary } = table;
  const modelsOf = (role: Role) =>
    listOf(table.models.find((row) => row.role === role)?.models ?? []);
  const line = `Round of ${summary.date ?? "an unknown date"} on ${listOf(summary.promptVersions)}: the day on ${modelsOf("day")}, its shadow on ${modelsOf("shadow")}; ${requestsOf(summary)}.`;
  return note === "" ? line : `${line} ${note}`;
}

/** The table as Markdown lines: each model, each check, and a line on the round. */
export function roundTableMarkdown(table: RoundTable, note = ""): string[] {
  return [
    ...markdownTable(
      [
        "Model",
        "Role",
        "Days complete",
        "Places by name",
        "Meals by area",
        "Mean cost per day",
        "Median to first token",
        "Median to finish",
      ],
      table.models.map((row) => [
        listOf(row.models),
        row.role,
        `${row.complete} of ${row.requested}`,
        placesCell(row.places?.byName ?? null),
        placesCell(row.places?.mealsByArea ?? null),
        dollarsCell(row.meanCostUsd),
        secondsCell(row.medianMsToFirstToken),
        secondsCell(row.medianMsToFinish),
      ]),
    ),
    "",
    ...markdownTable(
      ["Check", "Kind", "Day: passed", "Day: mean", "Shadow: passed", "Shadow: mean"],
      table.checks.map(({ id, kind, tallies }) => [
        id,
        kind,
        passedCell(tallies.day),
        meanCell(id, tallies.day),
        passedCell(tallies.shadow),
        meanCell(id, tallies.shadow),
      ]),
    ),
    "",
    summaryLine(table, note),
  ];
}

export const TABLE_START = "<!-- eval-table:start -->";
export const TABLE_END = "<!-- eval-table:end -->";

/** The README with the table between its markers, in place of whatever stood there. */
export function withTableIn(readme: string, lines: readonly string[]): string {
  const start = readme.indexOf(TABLE_START);
  const end = readme.indexOf(TABLE_END);
  if (start === -1 || end < start) {
    throw new Error(`README.md has no ${TABLE_START} and ${TABLE_END} to write the table between`);
  }
  return `${readme.slice(0, start + TABLE_START.length)}\n\n${lines.join("\n")}\n\n${readme.slice(end)}`;
}
