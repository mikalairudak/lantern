// @vitest-environment node
import { neonConfig } from "@neondatabase/serverless";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { neonSql } from "./sql";

const CONNECTION_STRING = "postgresql://lantern:s3cret@ep-test-1234.us-east-1.aws.neon.tech/neondb";

interface SentRequest {
  body: unknown;
  isolationLevel: string | null;
  hasSignal: boolean;
}

let sent: SentRequest[];
let answer: () => Promise<Response>;
const originalFetch: unknown = neonConfig.fetchFunction;

/** Neon's answer to one statement, rows as arrays of text as its HTTP endpoint sends them. */
function resultOf(name: string, values: string[]) {
  return {
    command: "SELECT",
    rowCount: values.length,
    rowAsArray: true,
    fields: [{ name, dataTypeID: 23 }],
    rows: values.map((value) => [value]),
  };
}

beforeEach(() => {
  sent = [];
  answer = () => Promise.reject(new TypeError("fetch failed"));
  // Neon's driver posts each request to the database's HTTP endpoint; this answers in its place.
  neonConfig.fetchFunction = (_url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    sent.push({
      body: JSON.parse(String(init.body)),
      isolationLevel: headers.get("Neon-Batch-Isolation-Level"),
      hasSignal: init.signal instanceof AbortSignal,
    });
    return answer();
  };
});

afterEach(() => {
  neonConfig.fetchFunction = originalFetch;
});

describe("Postgres on Neon over HTTP", () => {
  it("connects to nothing until the first query", () => {
    neonSql(CONNECTION_STRING);

    expect(sent).toEqual([]);
  });

  it("sends a statement with its parameters, with a time limit, and resolves with its rows", async () => {
    answer = () => Promise.resolve(Response.json(resultOf("count", ["3"])));

    const rows = await neonSql(CONNECTION_STRING).query("SELECT $1::integer AS count", [3]);

    expect(rows).toEqual([{ count: 3 }]);
    expect(sent).toEqual([
      {
        body: { query: "SELECT $1::integer AS count", params: ["3"] },
        isolationLevel: null,
        hasSignal: true,
      },
    ]);
  });

  it("sends a transaction as one READ COMMITTED request, and resolves with each one's rows", async () => {
    answer = () =>
      Promise.resolve(
        Response.json({ results: [resultOf("a", ["1"]), resultOf("b", ["2", "3"])] }),
      );

    const results = await neonSql(CONNECTION_STRING).transaction([
      { text: "SELECT 1 AS a" },
      { text: "SELECT $1::integer AS b", params: [2] },
    ]);

    expect(results).toEqual([[{ a: 1 }], [{ b: 2 }, { b: 3 }]]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.isolationLevel).toBe("ReadCommitted");
    expect(sent[0]?.hasSignal).toBe(true);
  });

  it("fails the query when the database cannot be reached", async () => {
    await expect(neonSql(CONNECTION_STRING).query("SELECT 1")).rejects.toThrow(
      "Error connecting to database",
    );
    await expect(neonSql(CONNECTION_STRING).transaction([{ text: "SELECT 1" }])).rejects.toThrow(
      "Error connecting to database",
    );
  });

  it("never repeats the connection string in an error", async () => {
    const mistyped = "s3cret-password, pasted where the URL goes";

    const failure = neonSql(mistyped).query("SELECT 1");

    await expect(failure).rejects.toThrow("[DATABASE_URL]");
    await expect(failure).rejects.not.toThrow("s3cret");
  });

  it("never repeats the password either, as written in the string or decoded", async () => {
    answer = () =>
      Promise.reject(new Error('password "p@ss word" (p%40ss%20word) failed for "lantern"'));
    const sql = neonSql("postgresql://lantern:p%40ss%20word@ep-test-1234.neon.tech/neondb");

    const failure = sql.query("SELECT 1");

    await expect(failure).rejects.toThrow(
      'password "[DATABASE_URL]" ([DATABASE_URL]) failed for "lantern"',
    );
  });
});
