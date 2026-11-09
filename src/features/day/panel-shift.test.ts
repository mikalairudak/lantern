import { afterEach, describe, expect, it, vi } from "vitest";
import { panelBoundsOf, panelShiftOf, placeShift, shiftToFit } from "./panel-shift";

/** A phone's screen, with the page's 16 px gutter either side. */
const PHONE = { left: 0, right: 390 };
/** A phone-wide cell in the lab's matrix, 400 px into a wider page. */
const CELL = { left: 400, right: 790 };

describe("panelShiftOf", () => {
  it("leaves a list that fits between the gutters where it is", () => {
    expect(panelShiftOf({ left: 40, right: 300 }, PHONE)).toBe(0);
  });

  it("moves a list that would start past the left gutter back into view", () => {
    // A word that begins a line hangs its list 24 px left of the text.
    expect(panelShiftOf({ left: -9, right: 247 }, PHONE)).toBe(25);
  });

  it("moves a list that would end past the right gutter left, as far as there is room", () => {
    expect(panelShiftOf({ left: 120, right: 400 }, PHONE)).toBe(-26);
    expect(panelShiftOf({ left: 40, right: 420 }, PHONE)).toBe(-24);
  });

  it("keeps a list inside bounds that do not start at the screen's edge", () => {
    expect(panelShiftOf({ left: 408, right: 700 }, CELL)).toBe(8);
    expect(panelShiftOf({ left: 520, right: 800 }, CELL)).toBe(-26);
    // Where the cell sits on the page changes nothing: the same list, the same shift.
    expect(panelShiftOf({ left: 8, right: 300 }, PHONE)).toBe(8);
  });
});

describe("panelBoundsOf", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("is the screen when no container holds the list", () => {
    const panel = document.createElement("span");
    document.body.append(panel);
    expect(panelBoundsOf(panel)).toEqual({
      left: 0,
      right: document.documentElement.clientWidth,
    });
  });
});

describe("shiftToFit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  /** A list on screen at `left`, 258 px wide, with `drawn` px of shift already applied. */
  function listAt(left: number, drawn: number): HTMLElement {
    const panel = document.createElement("span");
    if (drawn !== 0) placeShift(panel, drawn);
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: left, y: 0, width: 258, height: 100 }),
    );
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(PHONE.right);
    document.body.append(panel);
    return panel;
  }

  it("measured again with its shift drawn, keeps the same shift", () => {
    // A word that begins a phone's line hangs its list 9 px past the screen's edge.
    expect(shiftToFit(listAt(-9, 0))).toBe(25);
    expect(shiftToFit(listAt(16, 25))).toBe(25);
  });

  it("moves a list by both margins, so whichever side it hangs from takes the shift", () => {
    const panel = document.createElement("span");
    document.body.append(panel);
    placeShift(panel, -48);

    expect(panel.style.marginLeft).toBe("-48px");
    expect(panel.style.marginRight).toBe("48px");
  });

  it("adds the shift to the margins its classes give it, and leaves them with none", () => {
    const sheet = document.createElement("style");
    sheet.textContent = ".hung { margin-left: -1px; }";
    document.head.append(sheet);
    const panel = document.createElement("span");
    panel.className = "hung";
    document.body.append(panel);

    placeShift(panel, -48);
    expect(panel.style.marginLeft).toBe("-49px");

    placeShift(panel, 0);
    expect(panel.style.marginLeft).toBe("");
    expect(getComputedStyle(panel).marginLeft).toBe("-1px");
    sheet.remove();
  });
});
