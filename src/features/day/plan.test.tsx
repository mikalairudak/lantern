import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { POLAR_NIGHT_DAY } from "@/lib/fixtures/edge/polar";
import { labelOf } from "./facts";
import { isGoldenAt, LightRail, sunLinesOf, sunsOf } from "./light-rail";
import { PlanEnergy } from "./plan-energy";
import { NO_LOCAL_WORDS, sentenceFactsOf } from "./sentence";
import { slotOf } from "./stream-ending";

const KYOTO_LIGHT = dayContextOf(itineraryOf(KYOTO_DAY));

describe("the plan's light", () => {
  it("finds the day's sunrise and sunset, and golden hour just before sunset", () => {
    const [rise, set] = sunsOf(KYOTO_LIGHT);
    expect(rise?.word).toBe("Sunrise");
    expect(set?.word).toBe("Sunset");
    expect(isGoldenAt(KYOTO_LIGHT, (set?.minute ?? 0) - 10)).toBe(true);
    expect(isGoldenAt(KYOTO_LIGHT, 12 * 60)).toBe(false);
  });

  it("names no sun on a day it never rises or sets", () => {
    const polar = dayContextOf(itineraryOf(POLAR_NIGHT_DAY));
    expect(sunsOf(polar).length).toBeLessThan(2);
  });

  it("draws a stretch as one line for each light, dotted after sunset, a bead at a stop", () => {
    const set = sunsOf(KYOTO_LIGHT)[1]?.minute ?? 0;
    const { container } = render(
      <LightRail daylight={KYOTO_LIGHT} from={set - 60} to={set + 60} hasBead />,
    );
    const lines = [...container.querySelectorAll("line")];
    expect(lines.some((line) => line.classList.contains("stroke-lamp"))).toBe(true);
    expect(lines.some((line) => line.getAttribute("stroke-dasharray") !== null)).toBe(true);
    expect(container.querySelector(".rounded-full")).not.toBeNull();
  });
});

describe("the plan's energy", () => {
  it("says the day's energy among the five, and moves the day to another only once it can", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const { rerender } = render(<PlanEnergy energy="calm" isEnabled={false} onChoose={onChoose} />);
    expect(screen.getByRole("button", { name: "calm" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "lively" }));
    expect(onChoose).not.toHaveBeenCalled();

    rerender(<PlanEnergy energy="calm" isEnabled onChoose={onChoose} />);
    await user.click(screen.getByRole("button", { name: "calm" }));
    expect(onChoose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "lively" }));
    expect(onChoose).toHaveBeenCalledWith("lively");
  });
});

describe("the headline under the first impression", () => {
  it("says an open company as a phrase, and today's question with the first impression off", () => {
    const facts = sentenceFactsOf(KYOTO_REQUEST, { company: null });
    const company = facts.company!;
    expect(labelOf(company, true)).toBe("with anyone");
    expect(labelOf(company)).toBe("with …?");
  });

  it("drops the hint at the page's first change of any kind", () => {
    expect(slotOf("done", null, NO_LOCAL_WORDS)).toEqual({ kind: "hint" });
    expect(slotOf("done", null, NO_LOCAL_WORDS, true)).toBeNull();
  });
});

describe("where the sun's lines stand on the plan", () => {
  const RISE = { minute: 7 * 60 + 43, word: "Sunrise" } as const;
  const SET = { minute: 17 * 60 + 51, word: "Sunset" } as const;
  const SPANS = [
    { from: 7 * 60 + 30, to: 8 * 60 + 15 },
    { from: 8 * 60 + 30, to: 9 * 60 + 30 },
    { from: 17 * 60, to: 17 * 60 + 40 },
    { from: 21 * 60, to: 23 * 60 },
  ];

  it("comes in with the stop after it, so nothing lands above a row already on the list", () => {
    const lines = sunLinesOf([RISE, SET], SPANS, true);
    // Sunrise falls in the first stop's visit: it stands over the second stop.
    expect(lines[1]?.lead.map(({ sun }) => sun.word)).toEqual(["Sunrise"]);
    // Sunset falls after the third stop ends: it stands over the fourth.
    expect(lines[3]?.lead.map(({ sun }) => sun.word)).toEqual(["Sunset"]);
    expect(lines.flatMap(({ trail }) => trail)).toEqual([]);
  });

  it("runs the rail on through each line, never back", () => {
    const lines = sunLinesOf([RISE, SET], SPANS, true);
    expect(lines[0]?.railTo).toBe(RISE.minute);
    expect(lines[1]?.lead[0]?.to).toBe(SPANS[1]!.from);
    expect(lines[2]?.railTo).toBe(SET.minute);
    expect(lines[3]?.lead[0]?.to).toBe(SPANS[3]!.from);
  });

  it("sets a sun past the last stop's start under it, once the day is whole", () => {
    const short = SPANS.slice(0, 3);
    expect(sunLinesOf([SET], short, false)[2]?.trail).toEqual([]);
    const whole = sunLinesOf([SET], short, true)[2]!;
    expect(whole.trail.map(({ sun }) => sun.word)).toEqual(["Sunset"]);
    expect(whole.railTo).toBe(SET.minute);
  });

  it("stands a sunrise over the first stop only when the day starts near it", () => {
    const early = [{ from: 8 * 60, to: 9 * 60 }];
    expect(sunLinesOf([RISE], early, true)[0]?.lead.map(({ sun }) => sun.word)).toEqual([
      "Sunrise",
    ]);
    const late = [{ from: 12 * 60, to: 13 * 60 }];
    expect(sunLinesOf([RISE], late, true)[0]?.lead).toEqual([]);
  });
});
