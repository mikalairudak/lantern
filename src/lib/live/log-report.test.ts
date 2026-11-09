// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ReportCommand } from "@/lib/db/report";
import { migratedDatabase, type TestDatabase } from "@/lib/fixtures/db/pglite";
import { LOG_REPORT_SECTIONS, runLogReport } from "./log-report";

const NEON_URL = "postgresql://lantern:p%40ss@ep-test-1234.us-east-1.aws.neon.tech/neondb";
const NOW = new Date("2026-11-19T12:00:00Z");

let database: TestDatabase;

beforeAll(async () => {
  database = await migratedDatabase();
});

beforeEach(async () => {
  await database.empty();
});

afterAll(async () => {
  await database.close();
});

interface Call {
  role?: "day" | "shadow" | "intake";
  prompt?: string;
  outcome?: string;
  salvaged?: boolean | null;
  costMicroUsd?: number | null;
  tokens?: [number, number] | null;
  msToFirstToken?: number | null;
  msToFinish?: number;
  checks?: object[] | null;
  repairs?: number | null;
  environment?: string;
  createdAt?: string;
  visitorText?: string | null;
  /** What a re-plan read, which only a re-plan's record holds. */
  context?: object | null;
}

async function seed({
  role = "day",
  prompt = "day-v8",
  outcome = "complete",
  salvaged = false,
  costMicroUsd = 76_000,
  tokens = [6_000, 6_400],
  msToFirstToken = 3_000,
  msToFinish = 48_000,
  checks = null,
  repairs = 0,
  environment = "production",
  createdAt = "2026-11-19T10:00:00Z",
  visitorText = null,
  context = null,
}: Call = {}): Promise<void> {
  await database.session.query(
    `INSERT INTO generation_log (id, environment, role, model, prompt_version, started_at,
       input_tokens, output_tokens, cost_micro_usd, ms_to_first_token, ms_to_finish, outcome,
       salvaged, repairs, checks, visitor_text, output_text, warnings, created_at, context)
     VALUES ($1::uuid, $2, $3, 'claude-sonnet-5-5', $4, $5::timestamptz, $6, $7, $8, $9, $10,
       $11, $12, $13, $14::jsonb, $15, 'the model wrote this', '[]'::jsonb, $5::timestamptz,
       $16::jsonb)`,
    [
      crypto.randomUUID(),
      environment,
      role,
      prompt,
      createdAt,
      tokens?.[0] ?? null,
      tokens?.[1] ?? null,
      costMicroUsd,
      msToFirstToken,
      msToFinish,
      outcome,
      salvaged,
      repairs,
      checks === null ? null : JSON.stringify(checks),
      visitorText,
      context === null ? null : JSON.stringify(context),
    ],
  );
}

function check(id: string, passed: boolean, value: number | null = null): object {
  return {
    id,
    kind: value === null ? "hard" : "scored",
    passed,
    value,
    threshold: null,
    findings: [],
  };
}

async function report(
  args: string[] = [],
): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const command: ReportCommand = {
    env: { DATABASE_URL: NEON_URL },
    args,
    connect: () => Promise.resolve({ session: database.session, close: () => Promise.resolve() }),
    now: NOW,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return { code: await runLogReport(command), out, err };
}

/** The lines of one section, from its title to the blank line after it. */
function sectionOf(out: readonly string[], title: string): string[] {
  const start = out.findIndex((line) => line.startsWith(title));
  const end = out.indexOf("", start);
  return out.slice(start, end === -1 ? undefined : end);
}

describe("pnpm log:report", () => {
  it("reads one environment's calls over the last seven days, by role and prompt", async () => {
    await seed({ msToFirstToken: 2_000, msToFinish: 40_000 });
    await seed({ msToFirstToken: 4_000, msToFinish: 60_000, costMicroUsd: 84_000 });
    await seed({ role: "shadow", costMicroUsd: 4_000, msToFirstToken: 900, msToFinish: 20_000 });
    await seed({ role: "intake", prompt: "intake-v3", outcome: "request", costMicroUsd: 300 });
    // Another environment, and a day before the span: neither is counted.
    await seed({ environment: "preview" });
    await seed({ createdAt: "2026-11-10T10:00:00Z" });

    const { code, out } = await report();

    expect(code).toBe(0);
    expect(out[1]).toBe("production, 2026-11-13 to 2026-11-19, in UTC");
    expect(sectionOf(out, "Calls, by role and prompt")).toEqual([
      "Calls, by role and prompt: cost in dollars, mean tokens, waits in seconds",
      "  call    prompt     calls  cost    in    out   first p50  first p90  end p50  end p90",
      "  day     day-v8     2      0.1600  6000  6400  3.0        3.8        50.0     58.0",
      "  intake  intake-v3  1      0.0003  6000  6400  3.0        3.0        48.0     48.0",
      "  shadow  day-v8     1      0.0040  6000  6400  0.9        0.9        20.0     20.0",
    ]);
  });

  it("counts how calls ended, a salvaged cut apart, and each check's share and mean", async () => {
    await seed({ checks: [check("shape", true), check("walk-radius", true, 0.9)] });
    await seed({ checks: [check("shape", true), check("walk-radius", false, 0.5)] });
    await seed({ outcome: "cut", salvaged: true, checks: [check("shape", true)] });
    await seed({ outcome: "cut", salvaged: false, checks: null });

    const { out } = await report();

    expect(sectionOf(out, "How calls ended")).toEqual([
      "How calls ended (a cut the salvage rule kept a day of, marked salvaged)",
      "  call  prompt  outcome        calls",
      "  day   day-v8  complete       2",
      "  day   day-v8  cut            1",
      "  day   day-v8  cut, salvaged  1",
    ]);
    expect(sectionOf(out, "Checks:")).toEqual([
      "Checks: the calls scored, the share passed and the mean measure",
      "  call  check        kind    scored  passed  share  mean",
      "  day   shape        hard    3       3       1.00",
      "  day   walk-radius  scored  2       1       0.50   0.70",
    ]);
  });

  it("tells re-plans apart, with the windows they kept and their repairs", async () => {
    // As the route records one: in the day's role, under its own prompt, with what it read.
    const replan = { prompt: "replan-v1", costMicroUsd: 20_000, context: { round: 1 } };
    await seed({ ...replan, repairs: 0, checks: [check("replan-windows", true)] });
    await seed({ ...replan, repairs: 3, checks: [check("replan-windows", false)] });
    await seed({ ...replan, outcome: "invalid", repairs: null, checks: null });

    const { out } = await report();

    expect(sectionOf(out, "Targeted re-plans")).toEqual([
      "Targeted re-plans: the windows kept as asked, and the merge's repairs",
      "  prompt     re-plans  windows kept  mean repairs",
      "  replan-v1  3         1             1.5",
    ]);
    expect(sectionOf(out, "Calls, by role and prompt")[2]).toMatch(
      /^ {2}replan +replan-v1 +3 +0\.0600/,
    );
  });

  it("adds up the spend by UTC day, counting the calls whose usage never came", async () => {
    await seed({ createdAt: "2026-11-18T23:30:00Z" });
    await seed({ createdAt: "2026-11-19T00:30:00Z", costMicroUsd: null, tokens: null });
    await seed({ createdAt: "2026-11-19T08:00:00Z" });

    const { out } = await report(["--days", "2"]);

    expect(sectionOf(out, "Spend by UTC day")).toEqual([
      "Spend by UTC day, in dollars (a call whose usage never came counts nothing here)",
      "  day         calls  no usage  cost",
      "  2026-11-18  1      0         0.0760",
      "  2026-11-19  2      1         0.0760",
    ]);
  });

  it("reads no column that may quote the visitor or the model's words", async () => {
    await seed({ role: "intake", prompt: "intake-v3", visitorText: "a slow Sunday with my ex" });

    const { out } = await report();

    expect(out.join("\n")).not.toContain("my ex");
    expect(out.join("\n")).not.toContain("the model wrote this");
    for (const { text } of LOG_REPORT_SECTIONS) {
      expect(text).not.toMatch(/\bvisitor_text\b|\boutput_text\b|\boutput\b|\berror\b/);
    }
  });

  it("says none for a section with nothing to read", async () => {
    const { out } = await report();

    expect(sectionOf(out, "Targeted re-plans")).toEqual([
      "Targeted re-plans: the windows kept as asked, and the merge's repairs",
      "  none",
    ]);
  });
});
