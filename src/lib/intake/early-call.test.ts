import { describe, expect, it } from "vitest";
import { EarlyCallGate, QUIET_DATABASE_MS } from "./early-call";

const START = new Date("2026-11-05T12:00:00.000Z");

function later(ms: number): Date {
  return new Date(START.getTime() + ms);
}

describe("EarlyCallGate", () => {
  it("lets a new process's first request call early, since it has never heard from the database", () => {
    expect(new EarlyCallGate().mayCallEarly(START)).toBe(true);
  });

  it("lets one of several requests at once call early, and the rest wait for the limits", () => {
    const gate = new EarlyCallGate();

    const answers = [START, START, later(1), later(QUIET_DATABASE_MS - 1)].map((now) =>
      gate.mayCallEarly(now),
    );

    expect(answers).toEqual([true, false, false, false]);
  });

  it("calls early again once the database has been quiet for four minutes", () => {
    const gate = new EarlyCallGate();
    gate.mayCallEarly(START);

    expect(gate.mayCallEarly(later(QUIET_DATABASE_MS))).toBe(true);
  });

  it("waits for the limits while the database has answered within four minutes", () => {
    const gate = new EarlyCallGate();
    gate.heardFromDatabase(START);

    expect(gate.mayCallEarly(later(QUIET_DATABASE_MS - 1))).toBe(false);
    expect(gate.mayCallEarly(later(QUIET_DATABASE_MS))).toBe(true);
  });

  it("keeps the latest answer when an older one is heard late", () => {
    const gate = new EarlyCallGate();
    gate.heardFromDatabase(later(60_000));
    gate.heardFromDatabase(START);

    expect(gate.mayCallEarly(later(QUIET_DATABASE_MS))).toBe(false);
  });
});
