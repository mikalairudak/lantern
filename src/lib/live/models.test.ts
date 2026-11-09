import type { LanguageModelUsage } from "ai";
import { describe, expect, it } from "vitest";
import {
  costOf,
  DAY_INPUT_TOKENS_CEILING,
  DAY_MAX_OUTPUT_TOKENS,
  MODEL_IDS,
  providerOptionsFor,
  SHADOW_MAX_OUTPUT_TOKENS,
  worstCaseUsd,
} from "./models";

function usage(input: number, output: number, thinking?: number): LanguageModelUsage {
  return {
    inputTokens: input,
    inputTokenDetails: { noCacheTokens: input, cacheReadTokens: 0, cacheWriteTokens: 0 },
    outputTokens: output,
    outputTokenDetails: { textTokens: output - (thinking ?? 0), reasoningTokens: thinking },
    totalTokens: input + output,
  };
}

describe("the models", () => {
  it("are Sonnet 5.5 for the day and Haiku 5.5 for the shadow and the intake", () => {
    expect(MODEL_IDS).toEqual({
      day: "claude-sonnet-5-5",
      shadow: "claude-haiku-5-5",
      intake: "claude-haiku-5-5",
    });
  });

  it("send thinking off by the name each model accepts, and nothing else", () => {
    expect(providerOptionsFor("day")).toEqual({
      anthropic: { thinking: { type: "between_tools" } },
    });
    expect(providerOptionsFor("shadow")).toEqual({ anthropic: { thinking: { type: "disabled" } } });
    expect(providerOptionsFor("intake")).toEqual({ anthropic: { thinking: { type: "disabled" } } });
  });
});

describe("costOf", () => {
  // The first live key's Kyoto day (`docs/harness.md`, "The first live key"): the price table
  // matches what the provider's usage came to, to the micro-dollar the log recorded.
  it("prices the first live day on Sonnet as the log recorded it, 77,780 micro-dollars", () => {
    expect(costOf("claude-sonnet-5-5", usage(6_695, 6_439))).toBeCloseTo(0.07778, 10);
  });

  it("prices its shadow on Haiku, cut at 8,000 tokens, at 4,670 micro-dollars rounded", () => {
    expect(costOf("claude-haiku-5-5", usage(6_695, 8_000))).toBeCloseTo(0.0046695, 10);
  });

  it("charges thinking as output, since it is billed as output", () => {
    expect(costOf("claude-sonnet-5-5", usage(0, 1_000, 600))).toBeCloseTo(0.01, 10);
  });

  it("is unknown when the provider reported no usage", () => {
    expect(costOf("claude-sonnet-5-5", undefined)).toBeNull();
    expect(costOf("claude-sonnet-5-5", { ...usage(1, 1), outputTokens: undefined })).toBeNull();
  });
});

describe("the day calls' output caps", () => {
  it("are 12,000 tokens for the day and for the shadow, the owner's choice", () => {
    expect(DAY_MAX_OUTPUT_TOKENS).toBe(12_000);
    expect(SHADOW_MAX_OUTPUT_TOKENS).toBe(12_000);
  });
});

describe("worstCaseUsd", () => {
  it("holds fourteen cents for a day on Sonnet: its input ceiling and its output cap", () => {
    expect(
      worstCaseUsd(MODEL_IDS.day, DAY_INPUT_TOKENS_CEILING, DAY_MAX_OUTPUT_TOKENS),
    ).toBeCloseTo(0.14, 10);
  });

  it("holds a day's input above the most a day has read on record", () => {
    // `day-v8`'s golden round, 2026-10-31: 8,503 to 8,517 tokens a day.
    const MOST_DAY_INPUT_RECORDED = 8_517;

    expect(DAY_INPUT_TOKENS_CEILING).toBeGreaterThan(MOST_DAY_INPUT_RECORDED);
  });

  it("holds under a cent for the shadow on Haiku", () => {
    expect(
      worstCaseUsd(MODEL_IDS.shadow, DAY_INPUT_TOKENS_CEILING, SHADOW_MAX_OUTPUT_TOKENS),
    ).toBeCloseTo(0.007, 10);
  });
});
