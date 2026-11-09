// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DAY_INSTRUCTIONS, DAY_PROMPT_VERSION, dayPromptFor } from "@/lib/live/day-prompt";
import {
  REPLAN_INSTRUCTIONS,
  REPLAN_PROMPT_VERSION,
  replanPromptFor,
  type ReplanPromptInput,
} from "@/lib/live/replan-prompt";
import type { DayRequest } from "./itinerary.schema";

/**
 * The day's and the re-plan's prompts, pinned character for character for two fixed requests.
 * They are written from this folder's limits and rules (`EARLY_START_BY`, `SWAP_RADIUS_METERS`
 * and the rest), so moving or renaming one must leave every word the model reads as it was. A
 * change the model should read is a new prompt version, and its snapshot is written again with
 * it: `pnpm vitest run -u src/lib/schema/prompt-text.test.ts`.
 */

const CALM_KYOTO: DayRequest = {
  city: "Kyoto",
  date: "2026-11-14",
  timezone: "Asia/Tokyo",
  citySource: "chosen",
  energy: "calm",
  energySource: "chosen",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

const LIVELY_LISBON: DayRequest = {
  city: "Lisbon",
  date: "2026-12-06",
  timezone: "Europe/Lisbon",
  citySource: "assumed",
  energy: "lively",
  energySource: "assumed",
  travel: "on-foot",
  start: null,
  dinner: "late",
  end: null,
  company: "friends",
};

const KYOTO_EARLY_START: ReplanPromptInput = {
  request: { ...CALM_KYOTO, start: "early" },
  changed: "start",
  // Lantern assumed the day's travel, dinner and end, and asked who comes along.
  facts: {
    energy: { value: "calm", source: "chosen" },
    travel: { value: "on-foot", source: "assumed" },
    start: { value: "early", source: "chosen" },
    dinner: { value: "early", source: "assumed" },
    end: { value: "early", source: "assumed" },
    company: { value: null, source: "asked" },
  },
  kept: [
    {
      startTime: "10:15",
      durationMinutes: 75,
      name: "Kiyomizu-dera",
      kind: "sacred",
      neighborhood: "Higashiyama",
      coordinates: { lat: 34.9949, lng: 135.785 },
      energy: "calm",
    },
    {
      startTime: "12:00",
      durationMinutes: 60,
      name: "Obanzai along Pontocho",
      kind: "food",
      neighborhood: "Nakagyo",
      coordinates: { lat: 35.0046, lng: 135.7705 },
      energy: "balanced",
    },
  ],
  windows: [
    {
      after: null,
      before: { startTime: "10:15", name: "Kiyomizu-dera" },
      dayStartsAt: "07:30",
      dayEndsAt: null,
      oldStops: [{ name: "Coffee on Sanjo-dori", kind: "coffee" }],
    },
  ],
  keptFlowMeters: 1_760,
};

const LISBON_LATE_END: ReplanPromptInput = {
  request: { ...LIVELY_LISBON, end: "late" },
  changed: "end",
  // The visitor chose every word but the start, which Lantern assumed.
  facts: {
    energy: { value: "lively", source: "assumed" },
    travel: { value: "on-foot", source: "chosen" },
    start: { value: "slow", source: "assumed" },
    dinner: { value: "late", source: "chosen" },
    end: { value: "late", source: "chosen" },
    company: { value: "friends", source: "chosen" },
  },
  kept: [
    {
      startTime: "19:00",
      durationMinutes: 45,
      name: "Miradouro de Santa Catarina",
      kind: "viewpoint",
      neighborhood: "Santa Catarina",
      coordinates: { lat: 38.7096, lng: -9.1476 },
      energy: "lively",
    },
    {
      startTime: "21:00",
      durationMinutes: 90,
      name: "Petiscos on Rua das Flores",
      kind: "food",
      neighborhood: "Chiado",
      coordinates: { lat: 38.7106, lng: -9.1435 },
      energy: "social",
    },
  ],
  windows: [
    {
      after: { endTime: "22:30", name: "Petiscos on Rua das Flores" },
      before: null,
      dayStartsAt: null,
      dayEndsAt: "01:00",
      oldStops: [{ name: "Ginjinha on Largo de São Domingos", kind: "bar" }],
    },
  ],
  keptFlowMeters: 4_250,
};

describe("the words the model reads", () => {
  it("are the day's instructions as pinned", () => {
    expect({ version: DAY_PROMPT_VERSION, instructions: DAY_INSTRUCTIONS }).toMatchSnapshot();
  });

  it.each([
    ["a calm Kyoto day with every word open", CALM_KYOTO],
    ["a lively Lisbon day with words chosen and assumed", LIVELY_LISBON],
  ])("are the day's prompt as pinned for %s", (_name, request) => {
    expect(dayPromptFor(request)).toMatchSnapshot();
  });

  it("are the re-plan's instructions as pinned", () => {
    expect({ version: REPLAN_PROMPT_VERSION, instructions: REPLAN_INSTRUCTIONS }).toMatchSnapshot();
  });

  it.each([
    ["the Kyoto day changed to an early start", KYOTO_EARLY_START],
    ["the Lisbon day changed to a late end", LISBON_LATE_END],
  ])("are the re-plan's prompt as pinned for %s", (_name, input) => {
    expect(replanPromptFor(input)).toMatchSnapshot();
  });
});
