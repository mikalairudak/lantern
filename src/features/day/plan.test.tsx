import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { dayContextOf } from "@/features/abacus/light";
import { itineraryOf } from "@/features/abacus/stop-row-examples";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { POLAR_NIGHT_DAY } from "@/lib/fixtures/edge/polar";
import { labelOf } from "./facts";
import { isGoldenAt, LightRail, sunsOf } from "./light-rail";
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
    expect(screen.getByRole("radio", { name: "calm" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "lively" }));
    expect(onChoose).not.toHaveBeenCalled();

    rerender(<PlanEnergy energy="calm" isEnabled onChoose={onChoose} />);
    await user.click(screen.getByRole("radio", { name: "calm" }));
    expect(onChoose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "lively" }));
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
