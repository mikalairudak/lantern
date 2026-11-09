import { afterEach, describe, expect, it, vi } from "vitest";
import { roomAboveOf, roomUnder, tailUnderOf } from "./day-view";

/** An element whose box starts `top` px down the viewport. */
function boxAt(top: number, element: HTMLElement = document.createElement("div")): HTMLElement {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 0, y: top, width: 300, height: 100 }),
  );
  return element;
}

describe("roomAboveOf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("reaches the document's top when nothing around the day clips it", () => {
    const day = boxAt(120);
    document.body.append(day);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(300);

    expect(roomAboveOf(day)).toBe(420);
  });

  it("reaches the top of what the nearest clipping ancestor can scroll to", () => {
    // A lab cell clips at its frame, which has scrolled 30 px.
    const cell = boxAt(50);
    cell.style.overflowY = "hidden";
    Object.defineProperty(cell, "scrollTop", { value: 30 });
    const day = boxAt(200);
    cell.append(day);
    document.body.append(cell);

    expect(roomAboveOf(day)).toBe(180);
  });
});

describe("roomUnder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is the empty room between the header's last line and the day's top", () => {
    const lines = document.createElement("div");
    vi.spyOn(lines, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 140, width: 300, height: 104 }),
    );

    expect(roomUnder(lines, boxAt(300))).toBe(56);
  });
});

describe("tailUnderOf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("runs from the day's end to the page's, as the page's foot and padding under it do", () => {
    // The day stands from 120 to 220 px down a page scrolled 300 px, 712 px tall.
    const day = boxAt(120);
    document.body.append(day);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(300);
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(712);

    expect(tailUnderOf(day)).toBe(192);
  });

  it("is none in a lab cell, which ends with the day", () => {
    const cell = boxAt(50);
    cell.style.overflowY = "hidden";
    const day = boxAt(200);
    cell.append(day);
    document.body.append(cell);
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(2000);

    expect(tailUnderOf(day)).toBe(0);
  });
});
