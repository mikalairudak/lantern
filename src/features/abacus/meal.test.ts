import { describe, expect, it } from "vitest";
import { MEAL_WORDS } from "@/lib/schema/itinerary.schema";
import { kindWordOf, mealAt, mealWordOf } from "./meal";

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("mealAt", () => {
  it.each([
    [at(8, 30), "breakfast"],
    [at(10, 59), "breakfast"],
    [at(11), "lunch"],
    [at(14, 59), "lunch"],
    [at(15), "snack"],
    [at(17), "snack"],
    [at(18), "dinner"],
    [at(23, 30), "dinner"],
  ])("says a meal starting at minute %i is %s", (start, meal) => {
    expect(mealAt(start)).toBe(meal);
  });

  it("says a meal past midnight, on the day's running clock, is a late supper, never breakfast", () => {
    expect(mealAt(at(24, 30))).toBe("late supper");
    expect(mealAt(at(26))).toBe("late supper");
  });

  // A meal's name never says the meal its row says under it; the name's check reads this list.
  it("says only meals the meal-name check knows, at every hour of the running clock", () => {
    const HOURS_OF_THE_RUNNING_CLOCK = 30;
    for (let hour = 0; hour < HOURS_OF_THE_RUNNING_CLOCK; hour++) {
      const meal = mealAt(at(hour));
      expect(MEAL_WORDS.some((word) => meal.split(" ").includes(word))).toBe(true);
    }
  });
});

describe("mealWordOf", () => {
  it("says a café and a bar at any hour", () => {
    expect(mealWordOf("coffee", at(8))).toBe("café");
    expect(mealWordOf("coffee", at(16))).toBe("café");
    expect(mealWordOf("bar", at(13))).toBe("bar");
    expect(mealWordOf("bar", at(25))).toBe("bar");
  });

  it("says a food stop's meal, or food while its start is not known", () => {
    expect(mealWordOf("food", at(20, 15))).toBe("dinner");
    expect(mealWordOf("food", undefined)).toBe("food");
  });
});

describe("kindWordOf", () => {
  it("says a place to eat or drink around by its meal, café or bar", () => {
    expect(kindWordOf("food", at(13, 5))).toBe("lunch");
    expect(kindWordOf("coffee", at(9))).toBe("café");
    expect(kindWordOf("bar", at(18, 30))).toBe("bar");
  });

  it("says any other place by its kind, and one not written yet by nothing", () => {
    expect(kindWordOf("sacred", at(11, 40))).toBe("sacred");
    expect(kindWordOf("market", undefined)).toBe("market");
    expect(kindWordOf(undefined, undefined)).toBeUndefined();
  });
});
