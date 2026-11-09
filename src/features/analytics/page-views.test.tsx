import { render } from "@testing-library/react";
import type { AnalyticsProps } from "@vercel/analytics/next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { markUncountedBrowser } from "@/lib/analytics/uncounted-browser";
import { PageViews } from "./page-views";

/** The props Vercel's component was last given. */
const given = vi.hoisted(() => ({ props: null as AnalyticsProps | null }));

vi.mock("@vercel/analytics/next", async (importOriginal) => {
  const vercel = await importOriginal<typeof import("@vercel/analytics/next")>();
  return {
    ...vercel,
    Analytics: (props: AnalyticsProps) => {
      given.props = props;
      return <vercel.Analytics {...props} />;
    },
  };
});

afterEach(() => localStorage.clear());

/** What the page view of a page would send, as Vercel's script asks for it. */
function sentFor(url: string): unknown {
  return given.props?.beforeSend?.({ type: "pageview", url });
}

describe("PageViews", () => {
  it("draws nothing on the page", () => {
    const { container } = render(<PageViews />);

    expect(container).toBeEmptyDOMElement();
  });

  it("sends no page view from a browser marked as the owner's, from the next one on", () => {
    render(<PageViews />);
    const url = "https://www.lanternday.com/day/kyoto";
    expect(sentFor(url)).toEqual({ type: "pageview", url });

    markUncountedBrowser(true);
    expect(sentFor(url)).toBeNull();

    markUncountedBrowser(false);
    expect(sentFor(url)).toEqual({ type: "pageview", url });
  });
});
