import { describe, expect, it } from "vitest";
import {
  HOLD_TTL_MS,
  type AppSpend,
  type LimitKind,
  type SpendCaps,
  type VisitorLimits,
} from "./limits";

/**
 * What every store behind the limits must do, the in-memory ones and the Postgres adapters
 * alike: each adapter's test calls these with a factory for a fresh, empty store. Calls
 * arrive at once, as requests do, so checking and counting must be one step.
 */

const NOW = new Date("2026-11-19T10:00:00Z");
const LATER_THAT_DAY = new Date("2026-11-19T22:00:00Z");
const NIGHT = new Date("2026-11-19T23:59:59Z");
const NEXT_DAY = new Date("2026-11-20T00:00:00Z");
const NEXT_MONTH = new Date("2026-12-01T00:00:00Z");
const EARLIER_IN_THE_MONTH = (day: number): Date =>
  new Date(`2026-11-${String(day).padStart(2, "0")}T12:00:00Z`);

/** Visitors as the stores are given them: salted SHA-256 hashes, never an address. */
const VISITOR_A = "a".repeat(64);
const VISITOR_B = "b".repeat(64);

export function appSpendContract(name: string, make: (caps: SpendCaps) => AppSpend): void {
  describe(`${name}, as the app's spend`, () => {
    it("holds exactly one of three calls that reach the cap at once", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: null });

      const holds = await Promise.all([
        spend.reserve(0.6, NOW),
        spend.reserve(0.6, NOW),
        spend.reserve(0.6, NOW),
      ]);

      expect(holds.filter((hold) => hold !== null)).toHaveLength(1);
    });

    it("frees what a settled call did not spend", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: null });

      const first = await spend.reserve(0.6, NOW);
      if (first === null) throw new Error("The first call should fit");
      await spend.settle(first, 0.1);

      expect(await spend.reserve(0.6, LATER_THAT_DAY)).not.toBeNull();
    });

    it("frees all of a call never made", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: null });

      const first = await spend.reserve(1, NOW);
      if (first === null) throw new Error("The first call should fit");
      await spend.settle(first, 0);

      expect(await spend.reserve(1, NOW)).not.toBeNull();
    });

    it("counts the month across its days and stops at the monthly cap", async () => {
      const spend = make({ dailyUsd: 10, monthlyUsd: 95 });

      for (let day = 1; day <= 10; day++) {
        const held = await spend.reserve(9.5, EARLIER_IN_THE_MONTH(day));
        if (held === null) throw new Error(`Day ${day}'s call should fit`);
        await spend.settle(held, 9.5);
      }

      expect(await spend.reserve(0.1, NOW)).toBeNull();
    });

    it("counts in the month a hold still under way from the day before", async () => {
      const spend = make({ dailyUsd: 10, monthlyUsd: 1 });

      await spend.reserve(0.6, NIGHT);

      expect(await spend.reserve(0.6, NEXT_DAY)).toBeNull();
    });

    it("holds nothing in the day when the month refuses, nor in the month when the day does", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: 1.5 });

      expect(await spend.reserve(0.8, NIGHT)).not.toBeNull();
      // The day has room for 0.2 more and the month for 0.7.
      expect(await spend.reserve(0.5, NIGHT)).toBeNull();
      expect(await spend.reserve(0.8, NEXT_DAY)).toBeNull();

      expect(await spend.reserve(0.2, NIGHT)).not.toBeNull();
      expect(await spend.reserve(0.5, NEXT_DAY)).not.toBeNull();
    });

    it("settles a call in the day it was held, even when it ends after midnight", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: null });

      const held = await spend.reserve(0.5, NIGHT);
      if (held === null) throw new Error("The call should fit");
      await spend.settle(held, 0.1);

      expect(await spend.reserve(0.8, NIGHT)).not.toBeNull();
      expect(await spend.reserve(1, NEXT_DAY)).not.toBeNull();
    });

    it("stops counting a hold that is never settled once it expires", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: 1 });

      await spend.reserve(1, NOW);

      expect(await spend.reserve(1, new Date(NOW.getTime() + HOLD_TTL_MS - 1))).toBeNull();
      expect(await spend.reserve(1, new Date(NOW.getTime() + HOLD_TTL_MS))).not.toBeNull();
    });

    it("still counts what a call cost when it settles after its hold expired", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: null });
      const expired = new Date(NOW.getTime() + HOLD_TTL_MS);

      const held = await spend.reserve(1, NOW);
      if (held === null) throw new Error("The call should fit");
      await spend.reserve(0.1, expired);
      await spend.settle(held, 0.5);

      expect(await spend.reserve(0.5, expired)).toBeNull();
      expect(await spend.reserve(0.4, expired)).not.toBeNull();
    });

    it("turns a new day over at midnight UTC", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: null });

      await spend.reserve(1, NIGHT);

      expect(await spend.reserve(1, NEXT_DAY)).not.toBeNull();
    });

    it("turns a new month over on its first day", async () => {
      const spend = make({ dailyUsd: 1, monthlyUsd: 1.5 });

      expect(await spend.reserve(1, NIGHT)).not.toBeNull();
      expect(await spend.reserve(1, NEXT_DAY)).toBeNull();
      expect(await spend.reserve(1, NEXT_MONTH)).not.toBeNull();
    });
  });
}

export function visitorLimitsContract(
  name: string,
  make: (limits: Readonly<Record<LimitKind, number>>) => VisitorLimits,
): void {
  describe(`${name}, as the visitors' limits`, () => {
    it("lets exactly the limit's worth of calls through when they arrive at once", async () => {
      const limits = make({ day: 2, intake: 2 });

      const takes = await Promise.all([1, 2, 3].map(() => limits.take(VISITOR_A, "day", NOW)));

      expect(takes.filter((take) => take !== null)).toHaveLength(2);
    });

    it("lets a visitor use again a call that was given back", async () => {
      const limits = make({ day: 1, intake: 1 });

      const take = await limits.take(VISITOR_A, "day", NOW);
      if (take === null) throw new Error("The first call should be taken");
      await limits.giveBack(take);

      expect(await limits.take(VISITOR_A, "day", LATER_THAT_DAY)).not.toBeNull();
    });

    it("counts days and intake reads apart, and each visitor apart", async () => {
      const limits = make({ day: 1, intake: 1 });

      await limits.take(VISITOR_A, "day", NOW);

      expect(await limits.take(VISITOR_A, "day", NOW)).toBeNull();
      expect(await limits.take(VISITOR_A, "intake", NOW)).not.toBeNull();
      expect(await limits.take(VISITOR_B, "day", NOW)).not.toBeNull();
    });

    it("turns over at midnight UTC", async () => {
      const limits = make({ day: 1, intake: 1 });

      await limits.take(VISITOR_A, "day", NIGHT);

      expect(await limits.take(VISITOR_A, "day", NEXT_DAY)).not.toBeNull();
    });

    it("keeps a take given back after its day is over from adding to the new day's", async () => {
      const limits = make({ day: 1, intake: 1 });

      const yesterdays = await limits.take(VISITOR_A, "day", NIGHT);
      await limits.take(VISITOR_A, "day", NEXT_DAY);
      if (yesterdays === null) throw new Error("Yesterday's call should be taken");
      await limits.giveBack(yesterdays);

      expect(await limits.take(VISITOR_A, "day", NEXT_DAY)).toBeNull();
    });

    it("lets nothing through with a limit of none", async () => {
      const limits = make({ day: 0, intake: 0 });

      expect(await limits.take(VISITOR_A, "intake", NOW)).toBeNull();
    });
  });
}
