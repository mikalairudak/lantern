import { describe, expect, it } from "vitest";
import { isLiveGeneration, liveConfigOf } from "./flag";

describe("isLiveGeneration", () => {
  it("is on only for the exact value 1", () => {
    expect(isLiveGeneration({ LIVE_GENERATION: "1" })).toBe(true);
  });

  it.each([undefined, "", "0", "true", "yes", " 1", "1 ", "on"])("is off for %j", (value) => {
    expect(isLiveGeneration({ LIVE_GENERATION: value })).toBe(false);
  });
});

describe("liveConfigOf", () => {
  it("is ready with a key and a salt", () => {
    expect(liveConfigOf({ ANTHROPIC_API_KEY: "sk-test", VISITOR_HASH_SALT: "pepper" })).toEqual({
      kind: "ready",
      config: { visitorHashSalt: "pepper" },
    });
  });

  it("names every variable a deploy left out or left blank", () => {
    expect(liveConfigOf({ VISITOR_HASH_SALT: "  " })).toEqual({
      kind: "misconfigured",
      missing: ["ANTHROPIC_API_KEY", "VISITOR_HASH_SALT"],
    });
  });

  it.each(["production", "preview"])(
    "asks %s for the database, so its instances never count in memory",
    (environment) => {
      const ready = { ANTHROPIC_API_KEY: "sk-test", VISITOR_HASH_SALT: "pepper" };

      expect(liveConfigOf({ ...ready, VERCEL_ENV: environment })).toEqual({
        kind: "misconfigured",
        missing: ["DATABASE_URL"],
      });
      expect(
        liveConfigOf({ ...ready, VERCEL_ENV: environment, DATABASE_URL: "postgresql://db" }).kind,
      ).toBe("ready");
    },
  );

  it("asks any production server for the database, on Vercel or not", () => {
    expect(
      liveConfigOf({
        ANTHROPIC_API_KEY: "sk-test",
        VISITOR_HASH_SALT: "pepper",
        NODE_ENV: "production",
      }),
    ).toEqual({ kind: "misconfigured", missing: ["DATABASE_URL"] });
  });

  it("lets a laptop count in memory, as one process holds the counts whole", () => {
    expect(
      liveConfigOf({
        ANTHROPIC_API_KEY: "sk-test",
        VISITOR_HASH_SALT: "pepper",
        VERCEL_ENV: "development",
      }).kind,
    ).toBe("ready");
  });
});
