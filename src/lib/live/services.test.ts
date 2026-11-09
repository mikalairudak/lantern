// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EarlyCallGate } from "@/lib/intake/early-call";
import { placeVerifier, searchCities } from "@/lib/places/server";
import { PostgresAppSpend, PostgresGenerationLog, PostgresVisitorLimits } from "./postgres-stores";
import { liveDay, liveDayDeps, liveIntakeDeps } from "./services";
import { storesFor } from "./stores";

const ON = { LIVE_GENERATION: "1", ANTHROPIC_API_KEY: "sk-test", VISITOR_HASH_SALT: "pepper" };
const schedule = (): void => undefined;

function modelIdOf(model: unknown): unknown {
  return typeof model === "object" && model !== null && "modelId" in model ? model.modelId : model;
}

describe("the live routes' services", () => {
  it("give the routes nothing with the flag off, so they answer as on fixtures alone", () => {
    expect(liveDayDeps({ ...ON, LIVE_GENERATION: "0" }, schedule)).toBeNull();
    expect(liveIntakeDeps({}, schedule)).toBeNull();
  });

  it("give the day Sonnet 5.5 and its shadow Haiku 5.5, and the intake Haiku 5.5", () => {
    const day = liveDayDeps(ON, schedule);
    const intake = liveIntakeDeps(ON, schedule);

    expect(modelIdOf(day?.models.day)).toBe("claude-sonnet-5-5");
    expect(modelIdOf(day?.models.shadow)).toBe("claude-haiku-5-5");
    expect(modelIdOf(intake?.model)).toBe("claude-haiku-5-5");
  });

  it("hand the day route its live day only with the flag on", () => {
    expect(liveDay({}, schedule)).toBeNull();
    expect(liveDay(ON, schedule)).toEqual(expect.any(Function));
  });

  it("look the intake's cities up on Geoapify", () => {
    expect(liveIntakeDeps(ON, schedule)?.search).toBe(searchCities);
  });

  it("let the intake call early by one gate for the whole process", () => {
    const first = liveIntakeDeps(ON, schedule)?.earlyCalls;

    expect(first).toBeInstanceOf(EarlyCallGate);
    expect(liveIntakeDeps(ON, schedule)?.earlyCalls).toBe(first);
  });

  it("check the visitor's places on Geoapify while the day streams", () => {
    expect(liveDayDeps(ON, schedule)?.placeVerifier).toBe(placeVerifier);
  });

  it("count the day and the intake against the same limits and the same spend", () => {
    const day = liveDayDeps(ON, schedule);
    const intake = liveIntakeDeps(ON, schedule);

    expect(intake?.visitorLimits).toBe(day?.visitorLimits);
    expect(intake?.appSpend).toBe(day?.appSpend);
    expect(intake?.generationLog).toBe(day?.generationLog);
  });

  it("count and log in Postgres with a database, the same stores for the day and the intake", () => {
    const env = {
      ...ON,
      DATABASE_URL: "postgresql://lantern@db.test/lantern",
      VERCEL_ENV: "preview",
    };

    const day = liveDayDeps(env, schedule);
    const intake = liveIntakeDeps(env, schedule);

    expect(day?.visitorLimits).toBeInstanceOf(PostgresVisitorLimits);
    expect(day?.appSpend).toBeInstanceOf(PostgresAppSpend);
    expect(day?.generationLog).toBeInstanceOf(PostgresGenerationLog);
    expect(intake?.visitorLimits).toBe(day?.visitorLimits);
    expect(intake?.appSpend).toBe(day?.appSpend);
    expect(intake?.generationLog).toBe(day?.generationLog);
    expect(storesFor(ON).appSpend).not.toBe(day?.appSpend);
  });

  it("say which variables a deploy left out", () => {
    expect(liveDayDeps({ LIVE_GENERATION: "1" }, schedule)?.config).toEqual({
      kind: "misconfigured",
      missing: ["ANTHROPIC_API_KEY", "VISITOR_HASH_SALT"],
    });
  });

  it("time and name each call", () => {
    const deps = liveDayDeps(ON, schedule);

    expect(deps?.now()).toBeInstanceOf(Date);
    expect(deps?.newId()).not.toBe(deps?.newId());
  });
});
