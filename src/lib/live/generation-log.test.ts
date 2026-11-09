import { describe, expect, it } from "vitest";
import {
  InMemoryGenerationLog,
  tokensOf,
  warningLine,
  type GenerationRecord,
} from "./generation-log";

const RECORD: GenerationRecord = {
  id: "id-1",
  pairId: null,
  role: "intake",
  model: "claude-haiku-5-5",
  promptVersion: "intake-v0",
  startedAt: "2026-11-19T10:00:00.000Z",
  tokens: { input: 1_800, output: 150, thinking: null },
  costUsd: 0.000255,
  msToFirstToken: null,
  msToFinish: 900,
  finishReason: "stop",
  outcome: "request",
  salvaged: null,
  placeChecks: null,
  repairs: null,
  checks: null,
  visitorText: "Lisbon",
  request: null,
  outputText: "{}",
  warnings: [],
  requestId: "req_1",
  error: null,
};

describe("the in-memory generation log", () => {
  it("keeps every record in order", async () => {
    const log = new InMemoryGenerationLog();

    await log.record(RECORD);
    await log.record({ ...RECORD, id: "id-2" });

    expect(log.records.map(({ id }) => id)).toEqual(["id-1", "id-2"]);
  });

  it("keeps only the latest 500, so a long-running process does not grow without end", async () => {
    const log = new InMemoryGenerationLog();

    for (let i = 0; i < 501; i++) await log.record({ ...RECORD, id: `id-${i}` });

    expect(log.records).toHaveLength(500);
    expect(log.records[0]?.id).toBe("id-1");
  });
});

describe("tokensOf", () => {
  it("is null throughout when the provider reported no usage", () => {
    expect(tokensOf(undefined)).toEqual({ input: null, output: null, thinking: null });
  });
});

describe("warningLine", () => {
  it("writes a warning as one line the log can hold", () => {
    expect(warningLine({ type: "unsupported", feature: "temperature", details: "ignored" })).toBe(
      '{"type":"unsupported","feature":"temperature","details":"ignored"}',
    );
  });
});
