import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { VersionTags, type TagRequest } from "./version-tag";

/** jsdom has no layout: every box measures nothing, and the observer reports it at once. */
class ReportingObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ReportingObserver);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const NAMED: TagRequest = {
  kind: "named",
  key: "stop-3:a1",
  named: { stopIndex: 3, candidate: 2, name: "Tofu courses near Keage", way: "livelier" },
  x: 200,
  y: 120,
  others: [150],
};

function drawTags(tags: readonly TagRequest[]): void {
  render(
    <div className="relative">
      <VersionTags
        tags={tags}
        bounds={{ left: 40, right: 358, beadClear: 17 }}
        width={358}
        height={640}
        wireGap={6}
        fingerClear={22}
        readWords={() => []}
        maskLayer={null}
        maskPad={{ x: 3, y: 2, radius: 4 }}
      />
    </div>,
  );
}

describe("a version's name on the chart", () => {
  it("says the version's name and which way it goes, unheard: its bead says it aloud", async () => {
    drawTags([NAMED]);
    const tag = await screen.findByText("Tofu courses near Keage", { selector: "[data-tag] *" });

    expect(tag.closest("[data-tag]")).toHaveTextContent("Tofu courses near Keage livelier");
    expect(tag.closest("[data-tag]")).toHaveAttribute("aria-hidden", "true");
  });

  it("stands on its wire where nothing is in its way", async () => {
    drawTags([NAMED]);
    const way = await screen.findByText("livelier", { selector: "[data-tag] *" });
    expect(way.closest("[data-tag]")).toHaveAttribute("data-tag", "wire");
  });

  it("says where a drag is taking its stop, with no way of its own", async () => {
    drawTags([{ ...NAMED, kind: "dragged", key: "dragged", prefer: "left" }]);
    const tag = await screen.findByText("→ Tofu courses near Keage", {
      selector: "[data-tag] *",
    });
    expect(tag.closest("[data-tag]")).not.toHaveTextContent("livelier");
  });

  it("measures its words in a copy no one sees or hears", () => {
    drawTags([NAMED]);
    const copies = document.querySelector(".invisible");
    expect(copies).toHaveAttribute("aria-hidden", "true");
    expect(copies).toHaveTextContent("Tofu courses near Keage");
  });

  it("draws nothing with nothing to name", () => {
    drawTags([]);
    expect(document.querySelector("[data-tag]")).toBeNull();
  });
});
