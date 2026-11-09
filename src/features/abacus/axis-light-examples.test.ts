import { describe, expect, it } from "vitest";
import { LIGHT_DAYS, LIGHT_STATES, stillOf } from "./axis-light-examples";

describe("the axis light's examples", () => {
  it.each(LIGHT_DAYS.map((day) => [day.label, day] as const))(
    "draws %s whole on the page's frame, its last stop the one a cell opens",
    async (_label, day) => {
      const still = await stillOf(day, "whole");

      expect(still.draft.isComplete).toBe(true);
      expect(still.at).toBeNull();
      expect(still.subject).toBe(still.draft.stops.length - 1);
      expect(still.frame.kind).toBe("page");
    },
  );

  it.each(LIGHT_DAYS.map((day) => [day.label, day] as const))(
    "catches %s being written, from its first stop, with stops or versions still to come",
    async (_label, day) => {
      const still = await stillOf(day, "writing");
      const whole = await stillOf(day, "whole");

      expect(still.draft.isComplete).toBe(false);
      expect(still.at).not.toBeNull();
      expect(still.draft.stops[0]?.id).toBe("stop-0");
      expect(still.draft.stops.length).toBeLessThanOrEqual(whole.draft.stops.length);
      expect(still.frame.kind).toBe("page");
    },
  );

  it("stops a long day's stream once its middle stop is written, before the next is placed", async () => {
    const kyoto = LIGHT_DAYS.find((day) => day.label === "Kyoto")!;
    const still = await stillOf(kyoto, "writing");

    expect(still.draft.stops).toHaveLength(Math.floor(kyoto.fixture.day.stops.length / 2) + 1);
  });

  it("works a day out once for every cell it is in", () => {
    const [kyoto] = LIGHT_DAYS;
    expect(stillOf(kyoto!, "whole")).toBe(stillOf(kyoto!, "whole"));
  });

  it("puts the day whole first, the view the visual baseline shoots", () => {
    expect(LIGHT_STATES.map((state) => state.key)).toEqual(["whole", "writing", "open"]);
  });
});
