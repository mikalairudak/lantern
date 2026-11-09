// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { InMemoryGenerationLog } from "./generation-log";
import { InMemoryAppSpend, InMemoryVisitorLimits } from "./limits";
import { PostgresVisitorLimits } from "./postgres-stores";
import { storesFor } from "./stores";

const ON = { LIVE_GENERATION: "1", ANTHROPIC_API_KEY: "sk-test", VISITOR_HASH_SALT: "pepper" };

// What a kept day's page would load beyond the stores, were it to load the live routes' services.
const loaded = vi.hoisted(() => new Set<string>());
vi.mock("@ai-sdk/anthropic", async (original) => {
  loaded.add("the model's provider");
  return original();
});
vi.mock("@/lib/places/server", async (original) => {
  loaded.add("Geoapify's client");
  return original();
});

describe("the live routes' stores", () => {
  it("count and log in memory without a database, as on a laptop", () => {
    const stores = storesFor(ON);

    expect(stores.visitorLimits).toBeInstanceOf(InMemoryVisitorLimits);
    expect(stores.appSpend).toBeInstanceOf(InMemoryAppSpend);
    expect(stores.generationLog).toBeInstanceOf(InMemoryGenerationLog);
  });

  it("never count in memory on a production server without a database", async () => {
    const stores = storesFor({ ...ON, NODE_ENV: "production" });

    expect(stores.visitorLimits).toBeInstanceOf(PostgresVisitorLimits);
    await expect(stores.visitorLimits.take("a".repeat(64), "day", new Date())).rejects.toThrow(
      "DATABASE_URL is not set",
    );
    await expect(stores.appSpend.reserve(0.1, new Date())).rejects.toThrow(
      "DATABASE_URL is not set",
    );
  });

  it("let a kept day open without loading the model's provider or Geoapify's client", async () => {
    await import("./stored-days");

    expect([...loaded]).toEqual([]);
  });
});
