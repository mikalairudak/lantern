// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSameRequest } from "@/lib/days/request";
import { dayBodiesOf } from "@/eval/day-round";
import { dayKindOf } from "@/eval/round";
import { goldenRequestsOf } from "@/eval/readme-table";

/**
 * The day eval's golden set (`docs/harness.md`, "Golden set") lives in `golden-days.jsonl`
 * alone, one `/api/day` body a line, so a new set replaces the file and nothing else: the day
 * round reads it as `EVAL_DAY_BODIES`, and `pnpm eval:table` tells a round of it by its bodies.
 */
const GOLDEN_TEXT = readFileSync(new URL("./golden-days.jsonl", import.meta.url), "utf8");
const GOLDEN = dayBodiesOf(GOLDEN_TEXT);

describe("the day eval's golden set", () => {
  it("is a file of day requests the day round reads", () => {
    expect(GOLDEN.length).toBeGreaterThan(0);
  });

  it("asks for each day once", () => {
    const repeated = GOLDEN.filter((body, index) =>
      GOLDEN.slice(0, index).some((earlier) => isSameRequest(earlier, body)),
    );
    expect(repeated).toEqual([]);
  });

  it("sends every request to the model, none answered by a written day", () => {
    expect(GOLDEN.filter((body) => dayKindOf(body) === "written")).toEqual([]);
  });

  it("is read by the table's script as the round reads it", () => {
    expect(goldenRequestsOf(GOLDEN_TEXT)).toEqual(GOLDEN);
  });
});
