// @vitest-environment node
import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { fakeClaude } from "@/lib/fixtures/live/mock-claude";
import { experimentLabel, NO_EXPERIMENT, shadowModelFor, VERSIONS_RULE } from "./shadow-experiment";

async function sentWith(experiment: Parameters<typeof shadowModelFor>[1]) {
  const claude = fakeClaude({ kind: "message", text: "{}", usage: { input: 10, output: 2 } });
  const base = claude.provider("claude-haiku-5-5");
  await generateText({
    model: shadowModelFor(base, experiment),
    instructions: "Plan the day.",
    prompt: "<request>{}</request>",
    maxRetries: 0,
  });
  return { body: claude.requests[0]!, base, model: shadowModelFor(base, experiment) };
}

describe("a shadow changed for one round", () => {
  it("is sent as production sends it when nothing is changed", async () => {
    const { body, base, model } = await sentWith(NO_EXPERIMENT);

    expect(model).toBe(base);
    expect(JSON.stringify(body)).not.toContain("effort");
    expect(JSON.stringify(body.system)).not.toContain("Before you write the alternatives");
  });

  it("sends the effort the round names", async () => {
    const { body } = await sentWith({ effort: "high", rule: null });

    expect(JSON.stringify(body)).toMatch(/"effort":"high"/);
    expect(JSON.stringify(body.system)).not.toContain("Before you write the alternatives");
  });

  it("says the versions rule after the day's own instructions, once", async () => {
    const { body } = await sentWith({ effort: null, rule: "versions" });
    const system = JSON.stringify(body.system);

    expect(system).toContain("Plan the day.");
    expect(system.indexOf("Plan the day.")).toBeLessThan(system.indexOf("Before you write"));
    expect(system.split("Before you write the alternatives")).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain("effort");
  });

  it("names what it changed for the round's report", () => {
    expect(experimentLabel(NO_EXPERIMENT)).toBeNull();
    expect(experimentLabel({ effort: "high", rule: null })).toBe("effort high");
    expect(experimentLabel({ effort: "high", rule: "versions" })).toBe(
      "effort high, the versions rule after the day's instructions",
    );
  });

  it("asks for nothing the day's own rules do not: an entry a stop, within the walk, one each side", () => {
    expect(VERSIONS_RULE).toContain("its own entry in alternatives");
    expect(VERSIONS_RULE).toContain("within 800 m");
    expect(VERSIONS_RULE).toContain(
      "A reflective stop gets only the livelier one, a social stop only the quieter one",
    );
  });
});
