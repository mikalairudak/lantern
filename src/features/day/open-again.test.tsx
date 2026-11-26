import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import { writtenDayAt } from "@/lib/days/written/days";
import type { IntakeReader } from "@/lib/schema/intake.schema";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { Day, type WrittenGist } from "./day";
import { KeptDayPage } from "./kept-day-page";
import { OPEN_IT_AGAIN, PAGE_FAILED } from "./page-failed";
import { writtenPool } from "./written-pool";

/**
 * "Open it again" on the page for a failure, and the page that comes back in its place: the
 * press goes with the page for a failure, so the focus lands where the page lands it on a
 * chosen day, never on the page itself.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
const POOL: readonly WrittenGist[] = writtenPool();
const PORTO = writtenDayAt("porto")!;
const KEPT_ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";

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
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  Reflect.deleteProperty(navigator, "userActivation");
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The visitor has pressed something on the page, as the browser keeps it. */
function pressedOnPage(): void {
  Object.defineProperty(navigator, "userActivation", {
    value: { hasBeenActive: true, isActive: false },
    configurable: true,
  });
}

/** The page for a failure in the page's place, as the app's error boundary draws it, until asked again. */
function FailedPage({ children }: { children: ReactNode }) {
  const [isFailed, setIsFailed] = useState(true);
  return isFailed ? (
    <ErrorPage error={new Error("A bug")} retry={() => setIsFailed(false)} />
  ) : (
    children
  );
}

const headline = () => screen.getByRole("heading", { level: 1 });

describe("Open it again", () => {
  it("hands the focus to the start screen's headline as the start screen comes back", async () => {
    pressedOnPage();
    const user = userEvent.setup();
    const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
    render(
      <FailedPage>
        <Day start={{ pool: POOL, read }} isAddressed />
      </FailedPage>,
    );
    expect(headline()).toHaveTextContent(PAGE_FAILED);

    await user.click(screen.getByRole("button", { name: OPEN_IT_AGAIN }));

    expect(headline()).toHaveTextContent(/^One day in a city/);
    expect(headline()).toHaveFocus();
  });

  it("hands the focus to the city word as the day comes back", async () => {
    pressedOnPage();
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/day/porto");
    render(
      <FailedPage>
        <Day first={PORTO.request} isAddressed />
      </FailedPage>,
    );

    await user.click(screen.getByRole("button", { name: OPEN_IT_AGAIN }));

    await waitFor(
      () => expect(within(headline()).getByRole("button", { name: "Porto" })).toHaveFocus(),
      DAY_TIMEOUT,
    );
  });

  it("hands the focus to the way on as a kept day past its link comes back", async () => {
    pressedOnPage();
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/day/${KEPT_ID}`);
    render(
      <FailedPage>
        <KeptDayPage
          id={KEPT_ID}
          stored={{ status: "expired", request: PORTO.request }}
          isLive={false}
        />
      </FailedPage>,
    );

    await user.click(screen.getByRole("button", { name: OPEN_IT_AGAIN }));

    await waitFor(
      () => expect(screen.getByRole("button", { name: "Write it again" })).toHaveFocus(),
      DAY_TIMEOUT,
    );
  });

  it("hands no focus to a page that comes back without the press", async () => {
    const read = vi.fn<IntakeReader>(async () => ({ kind: "unavailable" }));
    render(<Day start={{ pool: POOL, read }} isAddressed />);

    expect(headline()).toHaveTextContent(/^One day in a city/);
    expect(document.body).toHaveFocus();
  });
});
