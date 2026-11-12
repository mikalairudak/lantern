// @vitest-environment node
import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { BANNED_PHRASES } from "@/lib/quality/banned-phrases";
import { fakeClaude } from "@/lib/fixtures/live/mock-claude";
import { dayModelFor, dayRuleLabel, UNDATED_RULE, type DayRule } from "./written-day-rule";

async function sentWith(rule: DayRule | null) {
  const claude = fakeClaude({ kind: "message", text: "{}", usage: { input: 10, output: 2 } });
  const base = claude.provider("claude-sonnet-5-5");
  const model = dayModelFor(base, rule);
  await generateText({
    model,
    instructions: "Plan the day.",
    prompt: "<request>{}</request>",
    maxRetries: 0,
  });
  return { body: claude.requests[0]!, base, model };
}

describe("a day written for the site to keep", () => {
  it("is sent as production sends it when the round names no rule", async () => {
    const { body, base, model } = await sentWith(null);

    expect(model).toBe(base);
    expect(JSON.stringify(body.system)).not.toContain("kept and shown again");
  });

  it("says the undated rule after the day's own instructions, once, and changes nothing else", async () => {
    const { body } = await sentWith("undated");
    const system = JSON.stringify(body.system);

    expect(system.indexOf("Plan the day.")).toBeLessThan(system.indexOf("kept and shown again"));
    expect(system.split("kept and shown again")).toHaveLength(2);
    expect(JSON.stringify(body.messages)).toContain("<request>{}</request>");
    expect(JSON.stringify(body.messages)).not.toContain("kept and shown again");
  });

  it("asks for no month, no season and no clock time for the sun, and still for the light", () => {
    expect(UNDATED_RULE).toContain("Never name the month or the season");
    expect(UNDATED_RULE).toContain("Never give a clock time for sunrise, sunset or dark");
    expect(UNDATED_RULE).toContain("Say what the light does at the place and the hour");
  });

  it("names no phrase the day's banned list holds, so the rule cannot teach one", () => {
    const rule = UNDATED_RULE.toLowerCase();
    expect(BANNED_PHRASES.filter((phrase) => rule.includes(phrase.toLowerCase()))).toEqual([]);
  });

  it("names what it changed for the round's report", () => {
    expect(dayRuleLabel(null)).toBeNull();
    expect(dayRuleLabel("undated")).toBe("the undated rule after the day's instructions");
  });
});
