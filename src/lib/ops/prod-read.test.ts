// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MigrationConnection } from "@/lib/db/migrate";
import { migratedDatabase, type TestDatabase } from "@/lib/fixtures/db/pglite";
import {
  MAX_PROMPTED_ROWS,
  PROD_REPORTS,
  READER_ROLE,
  logsInAsReader,
  namesADatabase,
  promptedQueryOf,
  runProdRead,
} from "./prod-read";

const ROLE_SQL = fileURLToPath(new URL("../../../db/roles/lantern-reader.sql", import.meta.url));
const PASSWORD = "n0t-a-real-Pa55word";
const READER_URL = `postgresql://${READER_ROLE}:${PASSWORD}@ep-test-1234.us-east-1.aws.neon.tech/neondb?sslmode=require`;
const OWNER_URL = `postgresql://neondb_owner:${PASSWORD}@ep-test-1234.us-east-1.aws.neon.tech/neondb`;
const NOW = new Date("2026-11-19T12:00:00Z");
const VISITOR_WORDS = "my sister's address is 12 Elm Street";

let database: TestDatabase;

beforeAll(async () => {
  database = await migratedDatabase();
  const [current] = await database.session.query<{ name: string }>(
    "SELECT quote_ident(current_database()) AS name",
  );
  const roleSql = await readFile(ROLE_SQL, "utf8");
  // PGlite's database has its own name; production's is the one the file names.
  await database.session.exec(
    roleSql.replace("ON DATABASE neondb", `ON DATABASE ${current?.name ?? "postgres"}`),
  );
});

beforeEach(async () => {
  await database.empty();
  await seed();
});

afterAll(async () => {
  await database.close();
});

/** One row in every table the role reads, each holding what it must never print. */
async function seed(): Promise<void> {
  const { session } = database;
  await session.query(
    `INSERT INTO generation_log (id, environment, role, model, prompt_version, started_at,
       ms_to_finish, outcome, visitor_text, request, output_text, output, warnings, error,
       context, cost_micro_usd, created_at)
     VALUES
       ($1::uuid, 'production', 'intake', 'claude-haiku-5-5', 'intake-v3', $3::timestamptz,
        900, 'unavailable', $4, NULL, $4, $5::jsonb, '[]'::jsonb, $6::jsonb, NULL, 2000,
        $3::timestamptz),
       ($2::uuid, 'production', 'day', 'claude-sonnet-5-5', 'replan-v1', $3::timestamptz,
        40000, 'complete', NULL, '{"city": "Kyoto"}'::jsonb, 'a day', '{}'::jsonb, '[]'::jsonb,
        NULL, '{"itinerary": {}}'::jsonb, 78000, $3::timestamptz)`,
    [
      crypto.randomUUID(),
      "00000000-0000-4000-8000-000000000001",
      "2026-11-19T10:00:00Z",
      VISITOR_WORDS,
      JSON.stringify({ city: "Elm Street", unplaced: [VISITOR_WORDS] }),
      JSON.stringify({ message: VISITOR_WORDS }),
    ],
  );
  await session.query(
    `INSERT INTO app_spend (bucket, spent_micro_usd)
     VALUES ('day:2026-11-10', 1000), ('day:2026-11-19', 80000), ('month:2026-11', 80000)`,
  );
  await session.query(
    `INSERT INTO visitor_counters (visitor_key, utc_day, kind, count)
     VALUES (repeat('a', 64), '2026-11-19', 'day', 1)`,
  );
  await session.query(
    `INSERT INTO event_days (environment, utc_day, salt, events)
     VALUES ('production', '2026-11-19', repeat('5', 64), 1)`,
  );
  await session.query(
    `INSERT INTO product_events (id, environment, utc_day, visitor_key, kind, city, via, written)
     VALUES ($1::uuid, 'production', '2026-11-19', repeat('b', 64), 'day-opened', 'kyoto',
       'quick-start', true)`,
    [crypto.randomUUID()],
  );
}

interface Run {
  code: number;
  out: string;
  err: string;
  connectedWith: string[];
}

/** Runs the command against PGlite, every query in it as `lantern_reader`. */
async function read(
  args: readonly string[],
  { keychain }: { keychain: string | undefined } = { keychain: READER_URL },
): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const connectedWith: string[] = [];
  const connect = async (connectionString: string): Promise<MigrationConnection> => {
    connectedWith.push(connectionString);
    await database.session.exec(`SET ROLE ${READER_ROLE}`);
    return {
      session: database.session,
      close: async () => {
        await database.session.exec("RESET ROLE");
      },
    };
  };
  const code = await runProdRead({
    args,
    readConnectionString: async () => keychain,
    connect,
    now: NOW,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { code, out: out.join("\n"), err: err.join("\n"), connectedWith };
}

/** One statement run directly as the role, outside the command: what the grants allow. */
async function asReader(text: string): Promise<void> {
  await database.session.exec(`SET ROLE ${READER_ROLE}`);
  try {
    await database.session.exec(text);
  } finally {
    await database.session.exec("RESET ROLE");
  }
}

describe("pnpm prod:read", () => {
  it.each(Object.keys(PROD_REPORTS))(
    "reads the %s report as lantern_reader, quoting no visitor",
    async (name) => {
      const run = await read([name]);

      expect(run.err).toBe("");
      expect(run.code).toBe(0);
      expect(run.out).toContain("Target: ep-test-1234.us-east-1.aws.neon.tech/neondb");
      expect(run.out).toContain("(the Keychain, as lantern_reader)");
      expect(run.out).not.toContain(PASSWORD);
      expect(run.out).not.toContain("Elm Street");
      expect(run.out).not.toContain("5555");
    },
  );

  it("shows each day's spend beside its day calls and addresses", async () => {
    const run = await read(["spend", "--days", "2"]);

    expect(run.out).toMatch(/2026-11-19\s+0\.08\s+1\s+1/);
    expect(run.out).not.toContain("2026-11-10");
    expect(run.out).toMatch(/2026-11\s+0\.08\s+0\.08/);
  });

  it("lists the re-plans production kept, for S1's check", async () => {
    const run = await read(["replans"]);

    expect(run.out).toMatch(/00000000-0000-4000-8000-000000000001\s+2026-11-19 10:00\s+complete/);
  });

  it("never uses a string that logs in as another role, the owner's included", async () => {
    const run = await read(["log"], { keychain: OWNER_URL });

    expect(run.code).toBe(1);
    expect(run.err).toContain("does not log in as lantern_reader, so it is not used");
    expect(run.err).not.toContain(PASSWORD);
    expect(run.connectedWith).toEqual([]);
  });

  it("never connects with a string that names no database, as one cut short does", async () => {
    const cut = READER_URL.slice(0, READER_URL.indexOf("/neondb"));
    const run = await read(["log"], { keychain: cut });

    expect(run.code).toBe(1);
    expect(run.err).toContain("names no database after its host");
    expect(run.err).not.toContain(PASSWORD);
    expect(run.connectedWith).toEqual([]);
  });

  it("says how to add the Keychain item when there is none", async () => {
    const run = await read(["log"], { keychain: undefined });

    expect(run.code).toBe(1);
    expect(run.err).toContain('No Keychain item "lantern-prod-reader"');
    expect(run.connectedWith).toEqual([]);
  });

  it("names the reports when asked for one it does not have", async () => {
    const run = await read(["visitors"]);

    expect(run.code).toBe(1);
    expect(run.err).toContain('No report "visitors".');
    expect(run.err).toContain("<log|events|spend|replans|migrations>");
    expect(run.connectedWith).toEqual([]);
  });

  describe("a query typed at the prompt", () => {
    it("prints its own columns, at most 200 rows", async () => {
      const run = await read(["sql", "SELECT n FROM generate_series(1, 300) AS n;"]);

      expect(run.code).toBe(0);
      expect(run.out).toContain(`At most ${MAX_PROMPTED_ROWS} rows\n  n\n  1\n  2`);
      expect(run.out).toMatch(/\n {2}200$/);
    });

    it("prints jsonb as JSON, a timestamp as ISO, and null as nothing", async () => {
      const run = await read([
        "sql",
        `SELECT '{"itinerary": {"stops": 2}}'::jsonb AS context,
           '2026-11-19T10:00:00Z'::timestamptz AS at, NULL::text AS nothing`,
      ]);

      expect(run.out).toContain('{"itinerary":{"stops":2}}  2026-11-19T10:00:00.000Z');
      expect(run.out).not.toContain("[object Object]");
    });

    it("escapes the control characters a stranger's text could send to the terminal", async () => {
      // OSC 52 asks a terminal to write to the clipboard; ESC and BEL frame it. Each ';' is
      // chr(59), since the command refuses a ';' anywhere but at the end.
      const run = await read([
        "sql",
        `SELECT 'kept' || chr(27) || ']52' || chr(59) || 'c' || chr(59) || 'aGk=' || chr(7)
           || chr(10) || 'stop' AS summary,
           jsonb_build_object('name', 'a' || chr(27) || '[2J') AS context`,
      ]);

      expect(run.out).toContain("kept\\u001b]52;c;aGk=\\u0007\\u000astop");
      expect(run.out).toContain('{"name":"a\\u001b[2J"}');
      expect(run.out).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
    });

    it("reads $1 as the environment and $2 as the first day", async () => {
      const run = await read([
        "sql",
        "SELECT $1::text AS environment, $2::date::text AS since",
        "--environment",
        "preview",
        "--days",
        "3",
      ]);

      expect(run.out).toMatch(/preview\s+2026-11-17/);
    });

    it.each([
      ["UPDATE app_spend SET spent_micro_usd = 0", "Only a SELECT or a WITH is read."],
      ["SELECT 1; DELETE FROM app_spend", "One statement only"],
      ["", "Only a SELECT or a WITH is read."],
    ])("refuses %j before it connects", async (text, reason) => {
      const run = await read(["sql", text]);

      expect(run.code).toBe(1);
      expect(run.err).toContain(reason);
      expect(run.connectedWith).toEqual([]);
    });

    it("cannot write through a WITH, and the row stays", async () => {
      const run = await read([
        "sql",
        "WITH gone AS (DELETE FROM app_spend RETURNING bucket) SELECT bucket FROM gone",
      ]);

      expect(run.code).toBe(1);
      expect(run.err).toMatch(/^Not read: /);
      const rows = await database.session.query("SELECT bucket FROM app_spend");
      expect(rows).toHaveLength(3);
    });

    it.each([
      "SELECT visitor_text FROM generation_log",
      "SELECT output_text FROM generation_log",
      "SELECT output->>'city' AS city FROM generation_log",
      "SELECT error FROM generation_log",
      "SELECT * FROM generation_log",
      "SELECT salt FROM event_days",
    ])("is refused by the role: %s", async (text) => {
      const run = await read(["sql", text]);

      expect(run.code).toBe(1);
      expect(run.err).toMatch(/^Not read: permission denied/);
      expect(run.out).not.toContain("Elm Street");
    });
  });
});

describe("the role, as db/roles/lantern-reader.sql grants it", () => {
  it.each([
    "INSERT INTO app_spend (bucket, spent_micro_usd) VALUES ('day:2026-11-20', 1)",
    "UPDATE visitor_counters SET count = 0",
    "DELETE FROM generation_log",
    "TRUNCATE product_events",
    "CREATE TABLE notes (body text)",
    "DROP TABLE spend_holds",
  ])("cannot write, even outside a read-only transaction: %s", async (text) => {
    await expect(asReader(text)).rejects.toThrow(/permission denied|must be owner/);
  });

  it("reads the columns a report needs", async () => {
    await expect(
      asReader("SELECT id, outcome, checks, request, context FROM generation_log"),
    ).resolves.toBeUndefined();
  });
});

describe("what is read as lantern_reader", () => {
  it("names a database only with a path after the host", () => {
    expect(namesADatabase(READER_URL)).toBe(true);
    expect(namesADatabase(READER_URL.replace("/neondb", "/"))).toBe(false);
    expect(namesADatabase("not a url")).toBe(false);
  });

  it("is only a string for that role", () => {
    expect(logsInAsReader(READER_URL)).toBe(true);
    expect(logsInAsReader(OWNER_URL)).toBe(false);
    expect(logsInAsReader(READER_URL.replace("postgresql:", "https:"))).toBe(false);
    expect(logsInAsReader("not a url")).toBe(false);
  });

  it("wraps a typed query so it can only be one read", () => {
    const query = promptedQueryOf("  with x as (select 1 as n) select n from x ;  ");

    expect(query).toEqual({
      kind: "query",
      section: {
        title: "At most 200 rows",
        text: "SELECT * FROM (\nwith x as (select 1 as n) select n from x\n) AS prompted LIMIT 200",
      },
    });
  });
});
