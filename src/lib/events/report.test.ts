// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MigrationSession } from "@/lib/db/migrate";
import { migratedDatabase, type TestDatabase } from "@/lib/fixtures/db/pglite";
import { KYOTO_DRAGGED, KYOTO_ON_CHART } from "@/lib/fixtures/events";
import type { ProductEvent } from "./event.schema";
import { columnsOf } from "./postgres-event-store";
import { runEventsReport, SHARE_MIN_VISITORS, type ReportCommand } from "./report";

const NEON_URL = "postgresql://lantern:p%40ss@ep-test-1234.us-east-1.aws.neon.tech/neondb";
const NOW = new Date("2026-10-30T12:00:00Z");
const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

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

async function seed(
  visitor: string,
  event: ProductEvent,
  { day = "2026-10-30", environment = "production" } = {},
): Promise<void> {
  const { city, via, written, outcome, stage, word, view, answer, control } = columnsOf(event);
  await database.session.query(
    `INSERT INTO product_events
      (id, environment, utc_day, visitor_key, kind, city, via, written, outcome, stage, word, view,
       answer, control)
     VALUES ($1::uuid, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      crypto.randomUUID(),
      environment,
      day,
      visitor,
      event.kind,
      city,
      via,
      written,
      outcome,
      stage,
      word,
      view,
      answer,
      control,
    ],
  );
}

/**
 * An event kept before its kind told the way in and the view, or a word changed before it told
 * the control: the city alone, and the word if it has one.
 */
async function seedUntold(
  visitor: string,
  kind: string,
  { word = null }: { word?: string | null } = {},
): Promise<void> {
  await database.session.query(
    `INSERT INTO product_events (id, environment, utc_day, visitor_key, kind, city, word)
     VALUES ($1::uuid, 'production', '2026-10-30', $2, $3, 'kyoto', $4)`,
    [crypto.randomUUID(), visitor, kind, word],
  );
}

async function seedCall(
  role: "day" | "intake",
  outcome: string,
  {
    request = null,
    output = null,
    environment = "production",
  }: {
    request?: unknown;
    output?: unknown;
    environment?: string;
  },
): Promise<void> {
  await database.session.query(
    `INSERT INTO generation_log (id, environment, role, model, prompt_version, started_at,
       ms_to_finish, outcome, request, output_text, output, warnings)
     VALUES ($1::uuid, $2, $3, 'claude-sonnet-5-5', 'v0', $4::timestamptz, 1000, $5,
       $6::jsonb, '', $7::jsonb, '[]'::jsonb)`,
    [
      crypto.randomUUID(),
      environment,
      role,
      NOW.toISOString(),
      outcome,
      request === null ? null : JSON.stringify(request),
      output === null ? null : JSON.stringify(output),
    ],
  );
}

interface Run {
  code: number;
  out: string[];
  err: string[];
}

async function report(
  args: string[] = [],
  env: Record<string, string> = { DATABASE_URL: NEON_URL },
  connect: ReportCommand["connect"] = () =>
    Promise.resolve({ session: database.session, close: () => Promise.resolve() }),
): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runEventsReport({
    env,
    args,
    connect,
    now: NOW,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { code, out, err };
}

describe("pnpm events:report", () => {
  it("prints the counts of one environment over the last 30 days", async () => {
    const pressedKyoto = {
      kind: "day-opened",
      city: "kyoto",
      via: "pressed",
      written: true,
    } as const;
    const onChart = { city: "kyoto", via: "pressed", written: true, view: "chart" } as const;
    const asList = { city: "kyoto", via: "link", written: true, view: "read" } as const;
    await seed(A, { kind: "home-viewed" });
    // Twice in a day is one visitor; the same key on another day is another.
    await seed(B, { kind: "home-viewed" });
    await seed(B, { kind: "home-viewed" });
    await seed(B, { kind: "home-viewed" }, { day: "2026-10-29" });
    await seed(A, pressedKyoto);
    await seed(A, pressedKyoto);
    await seed(B, { ...pressedKyoto, via: "link" });
    await seed(B, { kind: "day-opened", city: "sao-paulo", via: "typed", written: false });
    await seed(A, { kind: "day-ended", ...onChart, outcome: "complete" });
    await seed(B, { kind: "day-ended", ...asList, outcome: "complete" });
    await seed(B, {
      kind: "day-left",
      city: "sao-paulo",
      via: "typed",
      written: false,
      stage: "before-first-stop",
    });
    await seed(A, { kind: "intake-ended", outcome: "request" });
    await seed(B, { kind: "intake-ended", outcome: "unavailable" });
    await seed(A, { kind: "curve-dragged", ...onChart });
    await seed(A, { kind: "menu-opened", ...onChart });
    await seed(A, { kind: "word-changed", city: "kyoto", word: "energy", control: "headline" });
    await seed(A, { kind: "word-changed", city: "kyoto", word: "energy", control: "headline" });
    await seed(B, { kind: "word-changed", city: "kyoto", word: "energy", control: "bar" });
    await seed(B, { kind: "word-changed", city: "kyoto", word: "city", control: "headline" });
    await seedUntold(C, "word-changed", { word: "energy" });
    await seed(A, { kind: "day-read-to-end", ...onChart });
    await seed(A, { kind: "route-opened", ...onChart });
    await seed(A, { kind: "calendar-saved", ...onChart });
    await seed(B, { kind: "route-opened", ...asList });
    await seedUntold(C, "route-opened");
    // Another environment, and a day before the span: neither is counted.
    await seed(A, { ...pressedKyoto, city: "lisbon" }, { environment: "preview" });
    await seed(A, { ...pressedKyoto, city: "lisbon" }, { day: "2026-09-30" });
    await seedCall("day", "invalid", { request: { city: "Porto" } });
    await seedCall("day", "complete", { request: { city: "Kyoto" } });
    await seedCall("day", "aborted", { request: { city: "Bergen" } });
    await seedCall("day", "invalid", { request: { city: "Bergen" }, environment: "preview" });
    await seedCall("intake", "unavailable", { output: { city: "Oslo" } });
    await seedCall("intake", "unavailable", { output: { city: null } });
    await seedCall("intake", "request", { output: { city: "Kyoto" } });

    const { code, out, err } = await report();

    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(out).toEqual([
      "Target: ep-test-1234.us-east-1.aws.neon.tech/neondb (DATABASE_URL)",
      "production, 2026-10-01 to 2026-10-30, in UTC",
      "",
      "From the start screen to a day taken along, by way in (visitors, once a UTC day)",
      "  step         via       visitors",
      "  home viewed            3",
      "  day opened   link      1",
      "  day opened   pressed   1",
      "  day opened   typed     1",
      "  day ended    link      1",
      "  day ended    pressed   1",
      "  taken along  link      1",
      "  taken along  not told  1",
      "  taken along  pressed   1",
      "",
      // A day taken along with no day opened that way, as one kept before events told the
      // way in, counts in no group here.
      "Days taken along, by way in (visitors who opened a day that way, and of them who took one along; a share from 30)",
      "  via      opened  taken along  share",
      "  link     1       1            n < 30",
      "  pressed  1       1            n < 30",
      "  typed    1       0            n < 30",
      "",
      "Days taken along, by view (visitors whose day ended in that view, and of them who did each in it; a share from 30)",
      "  view   ended  read to end  taken along  share",
      "  chart  1      1            1            n < 30",
      "  read   1      0            1            n < 30",
      "",
      'Days answered, by view (visitors whose day ended in that view, and of them who answered "Would you follow this day?"; a share of yes from 30 answers)',
      "  view   ended  answered  yes  not quite  yes share",
      "  chart  1      0         0    0          n < 30",
      "  read   1      0         0    0          n < 30",
      "",
      "Days opened, by city (a visitor counts once a UTC day)",
      "  city       opened  visitors",
      "  kyoto      3       2",
      "  sao-paulo  1       1",
      "",
      "How days were reached",
      "  via      day      opened",
      "  pressed  written  2",
      "  link     written  1",
      "  typed    model    1",
      "",
      "How attempts ended",
      "  attempt    outcome      times",
      "  day        complete     2",
      "  text read  request      1",
      "  text read  unavailable  1",
      "",
      "Whether visitors waited",
      "  day      wait                    days",
      "  model    left before-first-stop  1",
      "  written  stayed to the end       2",
      "",
      // A word changed before the control was told is counted apart from the two.
      "Gestures",
      "  gesture        word    control   times",
      "  word-changed   energy  headline  2",
      "  curve-dragged                    1",
      "  menu-opened                      1",
      "  word-changed   city    headline  1",
      "  word-changed   energy  bar       1",
      "  word-changed   energy  not told  1",
      "",
      "Days taken along (each way counts once a day opened)",
      "  way             days",
      "  route-opened    3",
      "  calendar-saved  1",
      "",
      "Days opened again by the same visitor on the same UTC day",
      "  city   visitors",
      "  kyoto  1",
      "",
      "Cities Lantern could not do (from the generation log)",
      "  city   times",
      "  oslo   1",
      "  porto  1",
    ]);
  });

  it("says none for a section with nothing to count, and reads the span asked for", async () => {
    await seed(A, KYOTO_DRAGGED, { day: "2026-10-29" });

    const { out } = await report(["--environment", "production", "--days", "1"]);

    expect(out[1]).toBe("production, 2026-10-30 to 2026-10-30, in UTC");
    expect(out).toContain("  none");
    expect(out.filter((line) => line.trimStart().startsWith("curve-dragged"))).toEqual([]);
  });

  it(`gives a share only to a group of at least ${SHARE_MIN_VISITORS} visitors, and counts below it`, async () => {
    const visitor = (index: number) => index.toString(16).padStart(64, "0");
    const pressed = { city: "kyoto", via: "pressed", written: true } as const;
    const typed = { city: "kyoto", via: "typed", written: false } as const;
    // As many pressed a written day and read it on the chart as a share needs, three of them
    // taking it along; one fewer typed theirs and read it as a list, two taking it along.
    for (let index = 0; index < SHARE_MIN_VISITORS; index += 1) {
      await seed(visitor(index), { kind: "day-opened", ...pressed });
      await seed(visitor(index), { kind: "day-ended", ...pressed, view: "chart", outcome: "cut" });
      if (index < 3) await seed(visitor(index), { kind: "link-shared", ...pressed, view: "chart" });
    }
    for (let index = 100; index < 100 + SHARE_MIN_VISITORS - 1; index += 1) {
      await seed(visitor(index), { kind: "day-opened", ...typed });
      await seed(visitor(index), { kind: "day-ended", ...typed, view: "read", outcome: "cut" });
      if (index < 102) await seed(visitor(index), { kind: "route-opened", ...typed, view: "read" });
    }

    const { out } = await report();

    expect(out).toContain(`  pressed  ${SHARE_MIN_VISITORS}      3            10%`);
    expect(out).toContain(`  typed    ${SHARE_MIN_VISITORS - 1}      2            n < 30`);
    expect(out).toContain(`  chart  ${SHARE_MIN_VISITORS}     0            3            10%`);
    expect(out).toContain(
      `  read   ${SHARE_MIN_VISITORS - 1}     0            2            n < 30`,
    );
  });

  it("counts a day taken along only in the view and way in its visitor's day ended and opened in", async () => {
    const visitor = (index: number) => index.toString(16).padStart(64, "0");
    // Each opened a day as pressed and ended it on the chart, then took one along as reached
    // by its link and read as a list: in neither group is that a day taken along.
    for (let index = 0; index < SHARE_MIN_VISITORS; index += 1) {
      await seed(visitor(index), {
        kind: "day-opened",
        city: "kyoto",
        via: "pressed",
        written: true,
      });
      await seed(visitor(index), {
        kind: "day-ended",
        city: "kyoto",
        via: "pressed",
        written: true,
        view: "chart",
        outcome: "complete",
      });
      await seed(visitor(index), { kind: "link-shared", ...KYOTO_ON_CHART, view: "read" });
    }
    // One more ended a day as a list and took nothing along.
    await seed(visitor(100), {
      kind: "day-ended",
      ...KYOTO_ON_CHART,
      view: "read",
      outcome: "cut",
    });

    const { out } = await report();

    expect(out).toContain(`  pressed  ${SHARE_MIN_VISITORS}      0            0%`);
    expect(out).toContain(`  chart  ${SHARE_MIN_VISITORS}     0            0            0%`);
    expect(out).toContain("  read   1      0            0            n < 30");
    expect(out.some((line) => /\d{3,}%/.test(line))).toBe(false);
  });

  it("counts the answers beside the days ended in their view, with a share of yes only from enough answers", async () => {
    const visitor = (index: number) => index.toString(16).padStart(64, "0");
    const ended = {
      kind: "day-ended",
      ...KYOTO_ON_CHART,
      view: "read",
      outcome: "complete",
    } as const;
    // Three ended a day on the plan: two answered yes, one not quite; one more ended it unanswered.
    for (const [index, answer] of [
      [0, "yes"],
      [1, "yes"],
      [2, "not-quite"],
    ] as const) {
      await seed(visitor(index), ended);
      await seed(visitor(index), { kind: "day-answered", ...KYOTO_ON_CHART, view: "read", answer });
    }
    await seed(visitor(3), ended);
    // One more answered two days that UTC day, one each way: counted once, in both answers.
    await seed(visitor(4), ended);
    await seed(visitor(4), {
      kind: "day-answered",
      ...KYOTO_ON_CHART,
      view: "read",
      answer: "yes",
    });
    await seed(visitor(4), {
      kind: "day-answered",
      ...KYOTO_ON_CHART,
      view: "read",
      answer: "not-quite",
    });

    const { out } = await report();

    const row = out.find((line) => /^\s+read\s+5\s+4\s+3\s+2\s+n < 30/.test(line));
    expect(row).toBeDefined();
  });

  it("reads inside a read-only transaction, and ends it", async () => {
    const statements: string[] = [];
    const recording: MigrationSession = {
      exec: (text) => {
        statements.push(text);
        return database.session.exec(text);
      },
      query: (text, params) => {
        statements.push(text.trim().split(/\s+/)[0] ?? "");
        return database.session.query(text, params);
      },
    };

    await report([], { DATABASE_URL: NEON_URL }, () =>
      Promise.resolve({ session: recording, close: () => Promise.resolve() }),
    );

    expect(statements[0]).toBe("BEGIN READ ONLY");
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(new Set(statements.slice(1, -1))).toEqual(new Set(["SELECT"]));
  });

  it.each([
    [["--days", "0"], "--days is a whole number from 1 to 3650."],
    [["--days", "a week"], "--days is a whole number from 1 to 3650."],
    [
      ["--environment", "prod; DROP TABLE product_events"],
      "--environment names one, such as production, preview or development.",
    ],
  ])("refuses %j", async (args, message) => {
    const { code, err } = await report(args);

    expect(code).toBe(1);
    expect(err).toEqual([message]);
  });

  it("asks for a connection string, and refuses one that is not a URL", async () => {
    expect((await report([], {})).err).toEqual([
      "Set DATABASE_URL_UNPOOLED, or DATABASE_URL, to the database to read.",
    ]);
    expect((await report([], { DATABASE_URL: "p@ss, pasted where the URL goes" })).err).toEqual([
      "DATABASE_URL is not a valid URL.",
    ]);
  });

  it("never prints the password when the database fails", async () => {
    const refused = (): Promise<never> =>
      Promise.reject(new Error('password "p@ss" (p%40ss) was refused'));

    const { code, err } = await report([], { DATABASE_URL: NEON_URL }, refused);

    expect(code).toBe(1);
    expect(err).toEqual(['Not read: password "[DATABASE_URL]" ([DATABASE_URL]) was refused']);
  });
});
