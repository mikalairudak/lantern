import { act, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredDay } from "@/lib/days/stored-day";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import type { PlaceCheck } from "@/lib/stream/place-checks";
import { DAY_ROUTE } from "@/features/itinerary/day-route";
import { CITY_SIGNATURE_HEADER, KEPT_DAY_HEADER } from "@/lib/intake/signed-city";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { Day } from "./day";
import { shownEnergiesOf } from "./day-shape";
import { KEPT_POLL_MS, KEPT_WAIT_MS, keptViewOf, type KeptLanding } from "./kept-day";
import { KeptDayPage } from "./kept-day-page";
import { NO_DAY_HERE } from "./no-day-here";
import { LINK_EXPIRED, OPENS_HERE, STILL_WRITING, UNFINISHED } from "./not-yet";
import { writtenDayAt } from "@/lib/days/written/days";
import { keepYourDay, readYourDays, browserStorage, type YourDay } from "./your-days";

const ORIGIN = "http://lantern.test";
const ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
/** Kyoto's day as a visitor's, kept in the log: no day the site has written. */
const KYOTO = { request: KYOTO_REQUEST, itinerary: KYOTO_ITINERARY };
const PORTO = writtenDayAt("porto")!;
const WRITTEN: StoredDay = {
  status: "written",
  ...KYOTO,
  checks: {},
  writtenAt: "2026-10-31T20:00:00.000Z",
  seconds: 46,
  round: 0,
};
const UNKNOWN: StoredDay = { status: "unknown" };
const CHART_WIDTH = 448;
const CHART_HEIGHT = 640;

/** jsdom has no layout, so the chart's container reports a laptop-sized box. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CHART_WIDTH, height: CHART_HEIGHT } };
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

/** What the log answers for the kept day, in turn; the last answer stands after. */
let logAnswers: Response[] = [];
const fetchAny = vi.fn((path: string, init?: RequestInit) => {
  if (path === `/api/day/${ID}`) {
    const answer = logAnswers.length > 1 ? logAnswers.shift()! : logAnswers[0]!.clone();
    return Promise.resolve(answer);
  }
  return answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 });
});

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", fetchAny);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  fetchAny.mockClear();
  logAnswers = [Response.json(UNKNOWN)];
  localStorage.clear();
  window.history.replaceState(null, "", `/day/${ID}`);
});
afterEach(() => vi.useRealTimers());
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

const headline = () => screen.getByRole("heading", { level: 1 });
/** The notice in the header, in place of the day's lines. */
const notice = () => document.querySelector<HTMLElement>("header p.text-quote");
const NOTICE_TIMEOUT = { timeout: 5000 };
const logAsks = () => fetchAny.mock.calls.filter(([path]) => path === `/api/day/${ID}`).length;
const dayAsks = () => fetchAny.mock.calls.filter(([path]) => path === DAY_ROUTE).length;

function asked(change: Partial<YourDay> = {}): YourDay {
  return {
    id: ID,
    request: KYOTO.request,
    startedAt: new Date().toISOString(),
    energies: ["reflective"],
    ending: "writing",
    seconds: null,
    ...change,
  };
}

/** Lets the page's timers run, as many milliseconds on as asked, and what they settle. */
async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("a day's own address", () => {
  it("marks the places the log kept as confirmed, and only those", async () => {
    const [first, second] = KYOTO.itinerary.stops;
    const checks: Record<string, PlaceCheck> = {
      [first!.primary.id]: {
        placeId: first!.primary.id,
        state: "confirmed",
        by: "name",
        coordinates: first!.primary.coordinates,
      },
      [second!.primary.id]: { placeId: second!.primary.id, state: "unconfirmed" },
    };
    render(<KeptDayPage id={ID} stored={{ ...WRITTEN, checks }} isLive={false} />);

    const list = await screen.findByRole("list", { name: "The day" }, { timeout: 5000 });
    await waitFor(() =>
      expect(within(list).getByRole("button", { name: /^Honen-in/ })).toHaveAccessibleName(
        /, on the map/,
      ),
    );
    expect(
      within(list).getByRole("button", { name: /^Philosopher's Path/ }),
    ).not.toHaveAccessibleName(/on the map/);
  });

  it("draws a kept day whole, under its sentence, and plays nothing for it", async () => {
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    expect(headline()).toHaveTextContent("A calm Saturday in Kyoto");
    const stops = await screen.findAllByRole("listitem", {}, { timeout: 5000 });
    expect(
      within(screen.getByRole("list", { name: "The day" })).getAllByRole("listitem"),
    ).toHaveLength(KYOTO.itinerary.stops.length);
    expect(stops.length).toBeGreaterThan(0);
    expect(dayAsks()).toBe(0);
    expect(logAsks()).toBe(0);
    expect(window.location.pathname).toBe(`/day/${ID}`);
    expect(document.title).toBe("A calm Saturday in Kyoto · Lantern");
  });

  it("waits for a day still being written, asking every few seconds, and takes it once it lands", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    logAnswers = [
      Response.json(UNKNOWN),
      new Response(null, { status: 503 }),
      Response.json(WRITTEN),
    ];
    render(<KeptDayPage id={ID} stored={UNKNOWN} isLive={false} />);

    expect(headline()).toHaveTextContent(STILL_WRITING);
    expect(screen.getByText(OPENS_HERE)).toBeInTheDocument();
    await wait(KEPT_POLL_MS);
    expect(logAsks()).toBe(1);
    expect(headline()).toHaveTextContent(STILL_WRITING);
    // A read that fails is asked again, as one that found nothing yet is.
    await wait(KEPT_POLL_MS);
    await wait(KEPT_POLL_MS);
    expect(logAsks()).toBe(3);
    expect(headline()).toHaveTextContent("A calm Saturday in Kyoto");
    // Once it has landed, the page asks no more.
    await wait(KEPT_POLL_MS * 3);
    expect(logAsks()).toBe(3);
    expect(dayAsks()).toBe(0);
  });

  it("names a day this browser asked while it is written, and says it did not finish once the wait is over", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    keepYourDay(browserStorage(), asked());
    render(<KeptDayPage id={ID} stored={UNKNOWN} isLive={false} />);

    expect(headline()).toHaveTextContent("A calm Saturday in Kyoto");
    await waitFor(
      () => expect(notice()).toHaveTextContent(`${STILL_WRITING} ${OPENS_HERE}`),
      NOTICE_TIMEOUT,
    );
    expect(screen.queryByRole("button", { name: "Write it again" })).toBeNull();

    await wait(KEPT_WAIT_MS);
    await waitFor(() => expect(notice()).toHaveTextContent(UNFINISHED), NOTICE_TIMEOUT);
    expect(screen.getByRole("button", { name: "Write it again" })).toBeInTheDocument();
    expect(readYourDays(browserStorage())[0]?.ending).toBe("failed");
    // The wait is over: the page asks no more.
    const asks = logAsks();
    await wait(KEPT_POLL_MS * 3);
    expect(logAsks()).toBe(asks);
  });

  it("says Lantern has no day here once the wait is over for a day this browser never asked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<KeptDayPage id={ID} stored={UNKNOWN} isLive={false} />);

    await wait(KEPT_WAIT_MS);
    expect(headline()).toHaveTextContent(NO_DAY_HERE);
    expect(document.title).toBe("No day here · Lantern");
  });

  it("draws nothing on the server for a day not found yet, so no stranger's headline comes first", () => {
    keepYourDay(browserStorage(), asked());

    expect(renderToString(<KeptDayPage id={ID} stored={UNKNOWN} isLive={false} />)).toBe("");
    // A day found is drawn on the server as it ended.
    expect(renderToString(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />)).toContain(
      "Kyoto",
    );
  });

  /** The one request the page sent the day route: its headers and its body. */
  function dayAsked(): { headers: Headers; body: unknown } {
    const calls = fetchAny.mock.calls.filter(([path]) => path === DAY_ROUTE);
    expect(calls).toHaveLength(1);
    const [, init] = calls[0]!;
    return { headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
  }

  it("asks for the whole day again by its id when a word changes, as no intake signed its city", async () => {
    const user = userEvent.setup();
    // A day every stop of which names company, past two thirds: changing it writes the whole day.
    const companied: StoredDay = {
      ...WRITTEN,
      itinerary: {
        ...KYOTO_ITINERARY,
        stops: KYOTO_ITINERARY.stops.map((stop) => ({
          ...stop,
          dependsOn: [...new Set([...stop.dependsOn, "company" as const])],
        })),
      },
    };
    render(<KeptDayPage id={ID} stored={companied} isLive />);

    await user.click(within(headline()).getByRole("button", { name: "with …?" }));
    await user.click(screen.getByRole("option", { name: "with family" }));

    await waitFor(() => expect(dayAsks()).toBe(1));
    const { headers, body } = dayAsked();
    expect(headers.get(KEPT_DAY_HEADER)).toBe(ID);
    expect(headers.has(CITY_SIGNATURE_HEADER)).toBe(false);
    expect(body).toMatchObject({ city: KYOTO.request.city, timezone: KYOTO.request.timezone });
  });

  it("asks for a day past its link again by its id", async () => {
    const user = userEvent.setup();
    render(<KeptDayPage id={ID} stored={{ status: "expired", request: KYOTO.request }} isLive />);

    await user.click(await screen.findByRole("button", { name: "Write it again" }));

    await waitFor(() => expect(dayAsks()).toBe(1));
    expect(dayAsked().headers.get(KEPT_DAY_HEADER)).toBe(ID);
  });

  it("says a link past its days has expired, with the day to write again", async () => {
    render(
      <KeptDayPage id={ID} stored={{ status: "expired", request: KYOTO.request }} isLive={false} />,
    );

    await waitFor(() => expect(notice()).toHaveTextContent(LINK_EXPIRED), NOTICE_TIMEOUT);
    expect(screen.getByRole("button", { name: "Write it again" })).toBeInTheDocument();
  });

  it("tells this browser's record of the day how it ended, where it stands in the list", () => {
    keepYourDay(browserStorage(), asked());
    keepYourDay(browserStorage(), asked({ id: "a later day", request: PORTO.request }));
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    const [later, kept] = readYourDays(browserStorage());
    expect(later?.id).toBe("a later day");
    expect(kept).toMatchObject({
      id: ID,
      energies: shownEnergiesOf(KYOTO.itinerary),
      ending: "written",
      seconds: 46,
    });
  });

  it("adds no one else's day to this browser's list", () => {
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    expect(readYourDays(browserStorage())).toEqual([]);
  });
});

describe("a kept day's landing", () => {
  const landingOf = (stored: StoredDay, isOverdue = false): KeptLanding => {
    const view = keptViewOf(ID, stored, asked(), isOverdue);
    if (view.kind !== "day") throw new Error("No day");
    return view.landing;
  };

  it("is past once the visitor has played another day from it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Day kept={landingOf(UNKNOWN)} isAddressed />);

    await user.click(within(headline()).getByRole("button", { name: "Kyoto" }));
    await user.click(screen.getByRole("button", { name: /^Bologna/ }));
    expect(headline()).toHaveTextContent("A lively Saturday in Bologna");

    rerender(<Day kept={landingOf(WRITTEN)} isAddressed />);
    expect(headline()).toHaveTextContent("A lively Saturday in Bologna");
  });

  it("takes the page when it lands another way while it is on screen", async () => {
    const { rerender } = render(<Day kept={landingOf(UNKNOWN)} isAddressed />);
    await waitFor(() => expect(notice()).toHaveTextContent(STILL_WRITING), NOTICE_TIMEOUT);

    rerender(<Day kept={landingOf(UNKNOWN, true)} isAddressed />);
    await waitFor(() => expect(notice()).toHaveTextContent(UNFINISHED), NOTICE_TIMEOUT);
  });
});
