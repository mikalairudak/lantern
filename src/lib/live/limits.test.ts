import { describe, expect, it } from "vitest";
import {
  APP_SPEND_CAPS,
  giveBackHeld,
  InMemoryAppSpend,
  InMemoryVisitorLimits,
  VISITOR_DAILY_LIMITS,
  type AppSpend,
} from "./limits";
import { appSpendContract, visitorLimitsContract } from "./limits-contract";

const MORNING = new Date("2026-11-19T08:00:00Z");
const NIGHT = new Date("2026-11-19T23:59:59Z");
const NEXT_DAY = new Date("2026-11-20T00:00:00Z");

async function takeAll(limits: InMemoryVisitorLimits, times: number, at = MORNING) {
  const taken: boolean[] = [];
  for (let i = 0; i < times; i++) taken.push((await limits.take("visitor-a", "day", at)) !== null);
  return taken;
}

appSpendContract("InMemoryAppSpend", (caps) => new InMemoryAppSpend(caps));
visitorLimitsContract("InMemoryVisitorLimits", (limits) => new InMemoryVisitorLimits(limits));

describe("the visitor's limits", () => {
  it("are 10 model days and 20 intake reads a day, the owner's numbers", () => {
    expect(VISITOR_DAILY_LIMITS).toEqual({ day: 10, intake: 20 });
  });

  it("let a visitor take today's and no more", async () => {
    const limits = new InMemoryVisitorLimits({ day: 2, intake: 1 });

    expect(await takeAll(limits, 3)).toEqual([true, true, false]);
  });
});

describe("the app's spend", () => {
  it("is capped at $10 a day and $95 a month, under production's $100 workspace limit", () => {
    expect(APP_SPEND_CAPS).toEqual({ dailyUsd: 10, monthlyUsd: 95 });
  });

  it("holds a call's worst case until the cap has no room for the next", async () => {
    const spend = new InMemoryAppSpend({ dailyUsd: 1, monthlyUsd: null });

    expect(await spend.reserve(0.6, MORNING)).not.toBeNull();
    expect(await spend.reserve(0.6, MORNING)).toBeNull();
    expect(spend.spentOn(MORNING)).toBeCloseTo(0.6, 10);
  });

  it("settles a call in the day it was held, even when it ends after midnight", async () => {
    const spend = new InMemoryAppSpend({ dailyUsd: 1, monthlyUsd: null });

    const held = await spend.reserve(0.5, NIGHT);
    if (held === null) throw new Error("The call should fit");
    await spend.settle(held, 0.1);

    expect(spend.spentOn(NIGHT)).toBeCloseTo(0.1, 10);
    expect(spend.spentOn(NEXT_DAY)).toBe(0);
  });
});

describe("giveBackHeld", () => {
  it("returns the take and settles each reservation at what its call spent", async () => {
    const spend = new InMemoryAppSpend({ dailyUsd: 1, monthlyUsd: null });
    const limits = new InMemoryVisitorLimits({ day: 1, intake: 1 });
    const take = await limits.take("visitor-a", "day", MORNING);
    const unused = await spend.reserve(0.5, MORNING);
    const used = await spend.reserve(0.3, MORNING);
    if (unused === null || used === null) throw new Error("Both calls should fit");

    const failures = await giveBackHeld(
      {
        take,
        reservations: [
          { reservation: unused, spentUsd: 0 },
          { reservation: used, spentUsd: 0.01 },
        ],
      },
      { visitorLimits: limits, appSpend: spend },
    );

    expect(failures).toEqual([]);
    expect(spend.spentOn(MORNING)).toBeCloseTo(0.01, 10);
    expect(await limits.take("visitor-a", "day", MORNING)).not.toBeNull();
  });

  it("gives back what it can, and hands over what a store refused", async () => {
    const limits = new InMemoryVisitorLimits({ day: 1, intake: 1 });
    const take = await limits.take("visitor-a", "day", MORNING);
    const down = new Error("The store is down");
    const broken: AppSpend = {
      reserve: () => Promise.reject(down),
      settle: () => Promise.reject(down),
    };

    const failures = await giveBackHeld(
      {
        take,
        reservations: [{ reservation: { id: "hold-1", usd: 1, day: "", month: "" }, spentUsd: 0 }],
      },
      { visitorLimits: limits, appSpend: broken },
    );

    expect(failures).toEqual([down]);
    expect(await limits.take("visitor-a", "day", MORNING)).not.toBeNull();
  });
});
