import { Suspense, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { isLiveNow } from "@/lib/live/live-now";
import { spacesBesideTextsOf } from "@/lib/fixtures/server-markup";
import Privacy from "./page";

vi.mock("@/lib/live/live-now", () => ({ isLiveNow: vi.fn() }));

/** The first element of a tree that passes the test, depth first. */
function elementOf(node: ReactNode, isIt: (element: ReactElement) => boolean): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = elementOf(child, isIt);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (isIt(node)) return node;
  return elementOf(node.props.children, isIt);
}

/**
 * The notice as the server writes it, with live generation on or off: the page streams it in
 * under its header, so it is read from the page's Suspense and awaited here.
 */
async function noticeMarkupOf(isLive: boolean): Promise<string> {
  vi.mocked(isLiveNow).mockResolvedValue(isLive);
  const streamed = elementOf(Privacy(), (element) => element.type === Suspense);
  if (!streamed) throw new Error("The page streams no notice");
  const notice = streamed.props as { children: ReactElement };
  const Notice = notice.children.type as () => Promise<ReactNode>;
  return renderToString(await Notice());
}

describe("the privacy page's notice", () => {
  it.each([
    ["with live generation on", true],
    ["with live generation off", false],
  ])(
    "writes no space on the server as a text of its own beside another text, %s",
    async (_, isLive) => {
      const markup = await noticeMarkupOf(isLive);

      expect(spacesBesideTextsOf(markup)).toEqual([]);
    },
  );

  it("says how long a visitor's text is kept in its short version, with live generation on", async () => {
    const page = document.createElement("div");
    page.innerHTML = await noticeMarkupOf(true);

    expect(page.querySelector("li:nth-child(2)")?.textContent).toMatch(/kept for \d+ days\.$/);
  });
});
