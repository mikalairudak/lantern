// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseServerTiming, ServerTiming, withServerTiming } from "./server-timing";

/** A clock that reads each value in turn, so every duration is known. */
function clockOf(...readings: number[]): () => number {
  return () => {
    const next = readings.shift();
    if (next === undefined) throw new Error("The clock was read more often than the test set");
    return next;
  };
}

describe("ServerTiming", () => {
  it("sums a step timed more than once, keeps the order steps were first timed, and ends on the total", async () => {
    // Started at 1,000; limits 1,010 to 1,030 and 1,250 to 1,255; model 1,030 to 1,250; header at 1,260.
    const timing = new ServerTiming({
      clock: clockOf(1_000, 1_010, 1_030, 1_030, 1_250, 1_250, 1_255, 1_260),
    });

    await timing.time("limits", () => Promise.resolve());
    await timing.time("model", () => Promise.resolve());
    await timing.time("limits", () => Promise.resolve());

    expect(parseServerTiming(timing.header())).toEqual([
      { name: "limits", dur: 25, desc: "Neon: the visitor's count and the app's spend" },
      { name: "model", dur: 220, desc: "Claude, the whole call" },
      { name: "total", dur: 260, desc: "The handler, until its answer's headers" },
    ]);
  });

  it("counts a step that threw, and lets its error through", async () => {
    const timing = new ServerTiming({ clock: clockOf(0, 5, 45.26, 50) });

    await expect(
      timing.time("cities", () => Promise.reject(new Error("Geoapify is down"))),
    ).rejects.toThrow("Geoapify is down");

    expect(timing.header()).toBe(
      'cities;dur=40.3;desc="Geoapify: the cities the text names", total;dur=50;desc="The handler, until its answer\'s headers"',
    );
  });

  it("marks a cold request with how long after its process began the handler started", () => {
    const timing = new ServerTiming({ clock: clockOf(812.44, 830), isCold: true });

    expect(parseServerTiming(timing.header())).toEqual([
      { name: "total", dur: 17.6, desc: "The handler, until its answer's headers" },
      {
        name: "cold",
        dur: null,
        desc: "The first request this route served here, 812.4 ms after its process began",
      },
    ]);
  });
});

describe("a bare ServerTiming, as production writes it", () => {
  it("says each step's name and duration, and no description", async () => {
    const timing = new ServerTiming({ clock: clockOf(0, 5, 45.26, 50), isBare: true });

    await timing.time("cities", () => Promise.resolve());

    expect(timing.header()).toBe("cities;dur=40.3, total;dur=50");
  });

  it("leaves out the cold mark, which says how long the process has run", () => {
    const timing = new ServerTiming({ clock: clockOf(812.44, 830), isCold: true, isBare: true });

    expect(timing.header()).toBe("total;dur=17.6");
  });
});

describe("startServerTiming", () => {
  it("is bare in production alone", async () => {
    vi.resetModules();
    const { startServerTiming } = await import("./server-timing");

    const production = startServerTiming({ VERCEL_ENV: "production" }).header();
    expect(production).toMatch(/^total;dur=[\d.]+$/);
    for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }, {}]) {
      expect(startServerTiming(env).header()).toMatch(/^total;dur=[\d.]+;desc="/);
    }
  });

  it("marks only the first request a route serves as cold", async () => {
    vi.resetModules();
    const { startServerTiming } = await import("./server-timing");

    const first = startServerTiming({}).header();
    const second = startServerTiming({}).header();

    expect(first).toContain("cold;");
    expect(second).not.toContain("cold;");
  });
});

describe("withServerTiming", () => {
  it("sets the header on a streamed answer without reading its body", async () => {
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(new TextEncoder().encode("data: start\n\n")),
    });
    const response = withServerTiming(new Response(body), new ServerTiming());

    expect(response.headers.get("Server-Timing")).toMatch(/^total;dur=[\d.]+;desc="/);
    expect(response.bodyUsed).toBe(false);
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: start\n\n");
  });
});

describe("parseServerTiming", () => {
  it("reads a desc that holds a comma as one metric", () => {
    expect(parseServerTiming('model;dur=1.5;desc="Claude, the whole call", cold')).toEqual([
      { name: "model", dur: 1.5, desc: "Claude, the whole call" },
      { name: "cold", dur: null, desc: null },
    ]);
  });

  it("refuses a header in a shape it does not write", () => {
    expect(() => parseServerTiming("total;dur=fast")).toThrow(
      "Not a Server-Timing metric: total;dur=fast",
    );
  });
});
