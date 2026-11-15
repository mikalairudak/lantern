import { render } from "@testing-library/react";
import type { BeforeSend } from "@vercel/analytics/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markUncountedBrowser } from "@/lib/analytics/uncounted-browser";
import { PageViews } from "./page-views";

const ORIGIN = "https://www.lanternday.com";
const DAY_ID = "6f1c1e9a-2b3c-4d5e-8f90-a1b2c3d4e5f6";
const OTHER_DAY_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

/** Where the router says the visitor is: the address, and the params of the route that drew it. */
const router = vi.hoisted(() => ({ pathname: "/", params: {} as Record<string, string> }));

vi.mock("next/navigation", () => ({
  usePathname: () => router.pathname,
  useParams: () => router.params,
  useSearchParams: () => new URLSearchParams(),
}));

/** Vercel's script, as far as its queue: every call the component makes to it. */
const va = vi.fn<(event: string, properties?: unknown) => void>();

beforeEach(() => {
  router.pathname = "/";
  router.params = {};
  va.mockClear();
  window.va = va;
});

afterEach(() => {
  localStorage.clear();
  delete window.va;
});

function beforeSend(): BeforeSend {
  const handed = va.mock.calls.findLast(([event]) => event === "beforeSend");
  return handed?.[1] as BeforeSend;
}

/**
 * Each page view as Vercel's script sends it: the route as it was handed, and the address
 * built from the path and passed through `beforeSend`. Null for one `beforeSend` drops.
 */
function sent(): ({ route: unknown; url: string } | null)[] {
  return va.mock.calls
    .filter(([event]) => event === "pageview")
    .map(([, properties]) => {
      const { route, path } = properties as { route: unknown; path: string };
      const event = beforeSend()({ type: "pageview", url: `${ORIGIN}${path}` });
      return event === null ? null : { route, url: event.url };
    });
}

describe("PageViews", () => {
  it("draws nothing on the page", () => {
    const { container } = render(<PageViews />);

    expect(container).toBeEmptyDOMElement();
  });

  it("sends each page with its address, and a written day under the days' route", () => {
    const { rerender } = render(<PageViews />);
    router.pathname = "/day/kyoto";
    router.params = { city: "kyoto" };
    rerender(<PageViews />);
    router.pathname = "/privacy";
    router.params = {};
    rerender(<PageViews />);

    expect(sent()).toEqual([
      { route: "/", url: `${ORIGIN}/` },
      { route: "/day/[city]", url: `${ORIGIN}/day/kyoto` },
      { route: "/privacy", url: `${ORIGIN}/privacy` },
    ]);
  });

  // The start screen's route has no params, and the page moves to a day's address itself.
  it("names no kept day's id when the start screen moves to a day it wrote", () => {
    const { rerender } = render(<PageViews />);
    router.pathname = `/day/${DAY_ID}`;
    rerender(<PageViews />);

    expect(sent().at(-1)).toEqual({ route: "/day/[city]", url: `${ORIGIN}/day/[id]` });
    expect(JSON.stringify(sent())).not.toContain(DAY_ID);
  });

  it("names no kept day's id when a day's page moves to another kept day, and counts both", () => {
    router.pathname = `/day/${DAY_ID}`;
    router.params = { city: DAY_ID };
    const { rerender } = render(<PageViews />);
    router.pathname = `/day/${OTHER_DAY_ID}`;
    rerender(<PageViews />);

    expect(sent()).toEqual([
      { route: "/day/[city]", url: `${ORIGIN}/day/[id]` },
      { route: "/day/[city]", url: `${ORIGIN}/day/[id]` },
    ]);
  });

  it("sends no page view from a browser marked as the owner's, from the next one on", () => {
    render(<PageViews />);
    const url = `${ORIGIN}/day/kyoto`;
    expect(beforeSend()({ type: "pageview", url })).toEqual({ type: "pageview", url });

    markUncountedBrowser(true);
    expect(beforeSend()({ type: "pageview", url })).toBeNull();

    markUncountedBrowser(false);
    expect(beforeSend()({ type: "pageview", url })).toEqual({ type: "pageview", url });
  });
});
