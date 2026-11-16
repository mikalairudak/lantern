import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import type { DaySource } from "@/features/itinerary/use-day-stream";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { IntakeReader } from "@/lib/schema/intake.schema";
import { Day, type WrittenGist } from "./day";
import { WRITE_IT_AGAIN } from "./not-yet";
import { writtenPool } from "./written-pool";
import { INDEX_LABEL } from "./start-index";
import { readYourDays } from "./your-days";
import { FORGET_YOUR_DAYS, YOUR_DAYS_HEADING } from "./your-days-list";
import { isKeptSeen } from "./seen-days";

/**
 * "Forget these days" pressed on the start screen while the day asked from it is still being
 * written behind it, out of sight: what the browser kept of that day stays forgotten as the day
 * goes on and ends (`/privacy`; `useForgetCount`), and a day asked after it is kept as any
 * other.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
const POOL: readonly WrittenGist[] = writtenPool();
const ID = "0b6c6f1e-3d2a-4e8b-9a51-6f0c2d7e4a19";
const AGAIN_ID = "5d1e2f3a-4b5c-4d6e-8f7a-9b0c1d2e3f4a";
/** Longer than the start screen takes to list a day kept again. */
const A_MOMENT_MS = 1300;
/** Characters of the line about the day sent before the route falls silent. */
const LINE_BEGUN_CHARS = 12;

class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: 448, height: 640 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

function reducedMotion(query: string): MediaQueryList {
  return {
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

const fetchDay = vi.fn((path: string, init: RequestInit) =>
  answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 }),
);

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", fetchDay);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  fetchDay.mockClear();
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const headline = () => screen.getByRole("heading", { level: 1 });
const keptDays = () => readYourDays(window.localStorage).map(({ id, ending }) => [id, ending]);
const cityWord = (city: string) =>
  within(screen.getByRole("list", { name: INDEX_LABEL })).getByRole("button", {
    name: new RegExp(`^${city} `),
  });

/**
 * How each answer goes on past the first words of its line about the day: written whole, or its
 * connection dropped, once released.
 */
type Rest = "whole" | "dropped";

/**
 * The route's day under the log's id, as a live day's answer names it, sent as far as the first
 * words of its line about the day, so it takes the page with no stop yet, and the rest only once
 * released. Each answer takes the next id and rest given.
 */
function twoPhaseSource(answers: { id: string; rest: Rest }[]): {
  sourceFor: (request: DayRequest) => DaySource;
  release: () => void;
} {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sourceFor = (request: DayRequest): DaySource => ({
    request,
    open: async (signal) => {
      const answer = answers.shift();
      if (answer === undefined) throw new Error("The day was asked once more than the test said");
      const whole = await answerDayRequest(
        new Request(new URL(DAY_ROUTE, ORIGIN), {
          method: "POST",
          body: JSON.stringify(request),
          signal,
        }),
        { deltaChars: 8 },
      );
      const events = (await whole.text()).split("\n\n").filter((event) => event !== "");
      let text = "";
      let cut = events.length;
      for (const [index, event] of events.entries()) {
        const data = event.startsWith("data: ") ? event.slice("data: ".length) : "";
        if (data === "" || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as { type?: string; delta?: string };
        if (parsed.type === "text-delta") text += parsed.delta ?? "";
        const begun = text.indexOf('"dek":"');
        if (begun !== -1 && text.length - begun - '"dek":"'.length >= LINE_BEGUN_CHARS) {
          cut = index + 1;
          break;
        }
      }
      const encode = (part: readonly string[]) =>
        new TextEncoder().encode(part.map((event) => `${event}\n\n`).join(""));
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encode(events.slice(0, cut)));
          await released;
          if (answer.rest === "dropped") {
            controller.error(new TypeError("The connection dropped"));
            return;
          }
          controller.enqueue(encode(events.slice(cut)));
          controller.close();
        },
      });
      const headers = new Headers(whole.headers);
      headers.set(DAY_ID_HEADER, answer.id);
      return new Response(body, { status: whole.status, headers });
    },
  });
  return { sourceFor, release };
}

/**
 * Rome pressed on the start screen, its day named by the log and taking the page while it is
 * still being written; then Back to the start screen, which lists it as being written, and
 * "Forget these days" pressed there. The day writes on behind the start screen until released.
 */
async function forgetWhileWritten(
  answers: { id: string; rest: Rest }[] = [{ id: ID, rest: "whole" }],
): Promise<{ release: () => void; user: ReturnType<typeof userEvent.setup> }> {
  const { sourceFor, release } = twoPhaseSource(answers);
  const user = userEvent.setup();
  const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
  render(<Day start={{ pool: POOL, read }} sourceFor={sourceFor} isAddressed />);

  await user.click(cityWord("Rome"));
  await waitFor(() => expect(window.location.pathname).toBe(`/day/${ID}`), DAY_TIMEOUT);
  await waitFor(() => expect(headline()).toHaveTextContent(/^A balanced Saturday in Rome/));
  expect(readYourDays(window.localStorage)).toMatchObject([{ id: ID, ending: "writing" }]);

  act(() => window.history.back());
  await waitFor(() => expect(headline()).toHaveTextContent(/^One day in a city/));
  const yours = await screen.findByRole("list", { name: YOUR_DAYS_HEADING });
  expect(within(yours).getByRole("button")).toHaveTextContent(/Rome/);

  await user.click(screen.getByRole("button", { name: FORGET_YOUR_DAYS }));
  expect(screen.queryByRole("list", { name: YOUR_DAYS_HEADING })).not.toBeInTheDocument();
  expect(readYourDays(window.localStorage)).toEqual([]);
  return { release, user };
}

/** Waits for the day behind the start screen to be written to its end, still and unseen. */
async function waitForTheDayBehind(): Promise<void> {
  await waitFor(
    () =>
      expect(screen.getByRole("group", { name: /The day's energy/, hidden: true })).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    DAY_TIMEOUT,
  );
}

describe("the visitor's days forgotten while a day is written behind the start screen", () => {
  it("stay forgotten as the day being written goes on and ends", async () => {
    const { release } = await forgetWhileWritten();

    release();
    await waitForTheDayBehind();
    await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));

    expect(screen.queryByRole("list", { name: YOUR_DAYS_HEADING })).not.toBeInTheDocument();
    expect(readYourDays(window.localStorage)).toEqual([]);
  });

  it("keep the day's watched-to-the-end mark forgotten as the day being written ends", async () => {
    const { release } = await forgetWhileWritten();

    release();
    await waitForTheDayBehind();
    await new Promise((resolve) => setTimeout(resolve, A_MOMENT_MS));

    expect(isKeptSeen(ID)).toBe(false);
  });

  it("keep a row for the day written again after the forget, under its new id", async () => {
    const { release, user } = await forgetWhileWritten([
      { id: ID, rest: "dropped" },
      { id: AGAIN_ID, rest: "whole" },
    ]);
    release();
    act(() => window.history.forward());
    const again = await screen.findByRole(
      "button",
      { name: new RegExp(`^${WRITE_IT_AGAIN}`) },
      DAY_TIMEOUT,
    );
    expect(keptDays()).toEqual([]);

    await user.click(again);

    await waitFor(() => expect(window.location.pathname).toBe(`/day/${AGAIN_ID}`), DAY_TIMEOUT);
    await waitFor(() => expect(keptDays()).toEqual([[AGAIN_ID, "written"]]), DAY_TIMEOUT);
  });
});
