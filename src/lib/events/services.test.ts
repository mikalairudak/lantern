// @vitest-environment node
import { neonConfig } from "@neondatabase/serverless";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LiveEnv } from "@/lib/live/flag";
import { answerEventRequest } from "./answer-event-request";
import { InMemoryEventStore } from "./event-store";
import { PostgresEventStore } from "./postgres-event-store";
import { eventDepsOf, eventStoreFor } from "./services";

const NEON_URL = "postgresql://lantern:s3cret@ep-test-1234.us-east-1.aws.neon.tech/neondb";
const DRAGGED = JSON.stringify({ kind: "curve-dragged", city: "kyoto" });

function beacon(): Request {
  return new Request("http://lantern.test/api/events", {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin", "x-real-ip": "203.0.113.7" },
    body: DRAGGED,
  });
}

/** Sends one event through the deployment's own dependencies, logging into `lines`. */
async function send(env: LiveEnv, lines: string[] = []): Promise<number> {
  const deps = { ...eventDepsOf(env), log: (event: string) => void lines.push(event) };
  return (await answerEventRequest(beacon(), deps)).status;
}

describe("the events route's store", () => {
  it("counts in memory on a laptop without a database", async () => {
    expect(eventStoreFor({ NODE_ENV: "development" })).toBeInstanceOf(InMemoryEventStore);
    expect(await send({ NODE_ENV: "development" })).toBe(204);
  });

  it("is made once per process for each database and environment", () => {
    const env = { DATABASE_URL: NEON_URL, VERCEL_ENV: "preview" };

    expect(eventStoreFor(env)).toBe(eventStoreFor({ ...env }));
    expect(eventStoreFor(env)).not.toBe(eventStoreFor({ ...env, VERCEL_ENV: "production" }));
  });

  it.each([{ VERCEL_ENV: "production" }, { VERCEL_ENV: "preview" }, { NODE_ENV: "production" }])(
    "keeps no event on a deploy without a database, and logs each (%o)",
    async (env) => {
      const lines: string[] = [];

      expect(eventStoreFor(env)).toBeInstanceOf(PostgresEventStore);
      expect(await send(env, lines)).toBe(204);
      expect(lines).toEqual(["event-not-kept"]);
    },
  );
});

describe("the events route with live generation off", () => {
  const originalFetch: unknown = neonConfig.fetchFunction;
  let sent: string[];

  beforeEach(() => {
    sent = [];
    neonConfig.fetchFunction = (_url: string, init: { body?: string }) => {
      sent.push(init.body ?? "");
      return Promise.reject(new TypeError("fetch failed"));
    };
  });

  afterEach(() => {
    neonConfig.fetchFunction = originalFetch;
  });

  it("asks only DATABASE_URL, and names its environment in what it writes", async () => {
    // No LIVE_GENERATION, no Claude key, no visitor salt: only the database.
    const env = { DATABASE_URL: NEON_URL, VERCEL_ENV: "production" };

    expect(eventStoreFor(env)).toBeInstanceOf(PostgresEventStore);
    expect(await send(env)).toBe(204);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('"production"');
  });

  it("names a laptop's events development", async () => {
    await send({ DATABASE_URL: NEON_URL, NODE_ENV: "development" });

    expect(sent[0]).toContain('"development"');
  });
});
