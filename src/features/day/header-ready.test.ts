import { describe, expect, it } from "vitest";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import type { PartialDay } from "@/lib/stream/outcome";
import { hasDayBegun, isHeaderStreamed, isSentenceStreamed } from "./header-ready";

const { assumptions, dek, stops } = LISBON_DAY.day;

describe("isSentenceStreamed", () => {
  it("is not before the stream has written anything", () => {
    expect(isSentenceStreamed(null, null)).toBe(false);
  });

  it("waits while Lantern's words are still arriving, the last of them not yet final", () => {
    const partial: PartialDay = { assumptions };

    expect(isSentenceStreamed(partial, null)).toBe(false);
  });

  it("is once the line about the day has begun, every word before it final", () => {
    expect(isSentenceStreamed({ assumptions, dek: "" }, null)).toBe(true);
    expect(isSentenceStreamed({ assumptions, dek: dek.slice(0, 40) }, null)).toBe(true);
  });

  it("is once the stream has ended, whatever it ended with", () => {
    expect(isSentenceStreamed(null, { kind: "unavailable" })).toBe(true);
  });
});

describe("isHeaderStreamed", () => {
  it("is not before the stream has written anything", () => {
    expect(isHeaderStreamed(null, null)).toBe(false);
  });

  it("waits while the line about the day is still arriving", () => {
    const partial: PartialDay = { assumptions, dek: dek.slice(0, 40) };

    expect(isHeaderStreamed(partial, null)).toBe(false);
  });

  it("is once the stream has moved past the line about the day", () => {
    const partial: PartialDay = { assumptions, dek, stops: stops.slice(0, 1) };

    expect(isHeaderStreamed(partial, null)).toBe(true);
  });

  it("is once the stream has ended, whatever it ended with", () => {
    expect(isHeaderStreamed(null, { kind: "unavailable" })).toBe(true);
  });
});

describe("hasDayBegun", () => {
  it("is not while the header is whole and its stops are open with none in them", () => {
    // An empty day reaches this too, and closes its stops with none.
    const partial: PartialDay = { assumptions, dek, stops: [] };

    expect(isHeaderStreamed(partial, null)).toBe(true);
    expect(hasDayBegun(partial, null)).toBe(false);
  });

  it("is once its first stop has begun", () => {
    const partial: PartialDay = { assumptions, dek, stops: stops.slice(0, 1) };

    expect(hasDayBegun(partial, null)).toBe(true);
  });

  it("is once the stream has ended, whatever it ended with", () => {
    expect(hasDayBegun(null, { kind: "unavailable" })).toBe(true);
  });
});
