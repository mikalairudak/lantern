import { describe, expect, it } from "vitest";
import { formatClock, minutesOf, parseClock, runningSpans } from "./clock";

describe("clock times", () => {
  it("converts between HH:mm and minutes after midnight", () => {
    expect(minutesOf("07:45")).toBe(465);
    expect(formatClock(465)).toBe("07:45");
    expect(formatClock(minutesOf("21:00"))).toBe("21:00");
  });

  it("reads the next day's clock past midnight", () => {
    expect(formatClock(1440)).toBe("00:00");
    expect(formatClock(1486)).toBe("00:46");
  });

  it("reads a time as a model may write it, and nothing that is not a time of day", () => {
    expect(parseClock("9:45")).toBe(585);
    expect(parseClock(" 09:45 ")).toBe(585);
    expect(parseClock("09:45:30")).toBe(585);
    expect(parseClock("09:")).toBeNull();
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("09:60")).toBeNull();
    expect(parseClock("noon")).toBeNull();
  });
});

describe("running spans", () => {
  const stop = (startTime: string, durationMinutes = 30) => ({ startTime, durationMinutes });

  it("run on past midnight after a late evening, and stay there", () => {
    expect(runningSpans([stop("23:00", 60), stop("00:15"), stop("01:00", 90)])).toEqual([
      { from: 1380, to: 1440 },
      { from: 1455, to: 1485 },
      { from: 1500, to: 1590 },
    ]);
  });

  it("follow a stop that runs through midnight", () => {
    expect(runningSpans([stop("23:00", 120), stop("01:15")]).map((span) => span.from)).toEqual([
      1380, 1515,
    ]);
  });

  it.each<[string, ReturnType<typeof stop>[], number]>([
    ["the stop before ends early in the evening", [stop("18:00", 90), stop("00:30")], 30],
    ["it starts after the small hours", [stop("23:00", 60), stop("06:00")], 360],
  ])("stay on the clock when %s", (_name, stops, expected) => {
    expect(runningSpans(stops)[1]?.from).toBe(expected);
  });
});
