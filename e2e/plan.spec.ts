import { expect, test, type Page, waitMs } from "./fixtures";

/**
 * The day's plan: a day opens on its plan, lit by its light; the energy's five words move it; the
 * masthead's menu holds the ways to take it along; the chart is one press away and kept.
 */

const DAY_TIMEOUT_MS = waitMs(30_000);

test.use({ reducedMotion: "reduce" });

/** The day is written and still: the energy's words, which wait until then, can be chosen. */
async function dayIsWhole(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "lively" })).toBeEnabled({
    timeout: DAY_TIMEOUT_MS,
  });
}

test("a written day opens on its plan, lit, and its energy moves it", async ({ page }) => {
  await page.goto("/day/kanazawa");
  const plan = page.getByRole("list", { name: "The day, to read" });
  await dayIsWhole(page);
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "read");
  await expect(page.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-pressed", "true");

  // The rail of the day's light, golden hour in the lamp, and the sun's minutes in the list.
  await expect(plan.locator("line.stroke-lamp").first()).toBeAttached();
  await expect(plan.getByText("Sunset")).toBeVisible();

  const names = () => plan.getByRole("heading", { level: 2 }).allTextContents();
  const before = await names();
  await page.getByRole("button", { name: "lively" }).click();
  await expect.poll(names).not.toEqual(before);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("lively");
  await expect(page.getByText(/(click|tap) a word to change it/)).toBeHidden();
});

test("after dark the plan's beads are lit, in the first HTML, and every bead shows under forced colours", async ({
  page,
}) => {
  // Lit by the styles alone, in the HTML a page read without its script shows.
  const html = await (await page.request.get("/day/kanazawa")).text();
  expect(html).toContain('data-bead="lit"');

  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  const beads = await plan.locator("[data-bead]").evaluateAll((all) =>
    all.map((bead) => ({
      isLit: bead.getAttribute("data-bead") === "lit",
      isDotted: bead.parentElement?.querySelector("svg line")?.hasAttribute("stroke-dasharray"),
    })),
  );
  expect(beads.some(({ isLit }) => isLit)).toBe(true);
  for (const bead of beads) expect(bead.isLit).toBe(bead.isDotted);

  await page.emulateMedia({ forcedColors: "active" });
  const drawn = await plan.locator("[data-bead]").evaluateAll((all) =>
    all.map((bead) => {
      const dot = getComputedStyle(bead.lastElementChild!);
      const glow = bead.querySelector(".bg-lamp-glow");
      return {
        border: dot.borderTopWidth,
        isText: dot.borderTopColor === getComputedStyle(document.body).color,
        isGlowDrawn: glow !== null && getComputedStyle(glow).display !== "none",
      };
    }),
  );
  for (const bead of drawn)
    expect(bead).toEqual({ border: "4px", isText: true, isGlowDrawn: false });
});

test("the masthead's menu holds the ways along, and the chart is kept once chosen", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  await page.getByRole("button", { name: "Take this day" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    /Copy the link/,
    /Add to your calendar/,
    /Walk it in Google Maps/,
    /Plan another day/,
  ]);
  const box = await menu.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Chart" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "chart");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-day-view", "chart");
});

test("a stop swipes along its versions, from a drag and from the keys", async ({ page }) => {
  await page.goto("/day/kanazawa");
  await dayIsWhole(page);
  const plan = page.getByRole("list", { name: "The day, to read" });
  const names = () => plan.getByRole("heading", { level: 2 }).allTextContents();
  const stop = plan.locator('[role="group"][tabindex="0"]').nth(1);
  await stop.scrollIntoViewIfNeeded();
  const before = await names();

  // A short drag springs back; one past a third of the stop takes the version beside it.
  const box = (await stop.boundingBox())!;
  const y = box.y + 12;
  await page.mouse.move(box.x + box.width - 16, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 46, y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(names).toEqual(before);
  await expect.poll(async () => (await stop.boundingBox())?.x).toBe(box.x);
  await page.mouse.move(box.x + box.width - 16, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 16, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(names).not.toEqual(before);

  // The arrow key on the stop takes it back, and the focus stays on the stop.
  await stop.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(names).toEqual(before);
  await expect(stop).toBeFocused();
});

/** Each stop's versions line on the plan: its column's box and its arrows' boxes, by side. */
async function versionLinesOf(page: Page) {
  const plan = page.getByRole("list", { name: "The day, to read" });
  return plan.locator('[role="group"]').evaluateAll((stops) =>
    stops.map((stop) => {
      const words = stop.parentElement!.parentElement!;
      const column = words.getBoundingClientRect();
      const arrows = [...words.querySelectorAll("button[aria-label]")].map((arrow) => {
        const box = arrow.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(arrow).lineHeight);
        return {
          isLeft: arrow.textContent?.startsWith("←") ?? false,
          left: box.left - column.left,
          right: column.right - box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          lines: Math.round(arrow.firstElementChild!.getBoundingClientRect().height / lineHeight),
        };
      });
      return { column: column.width, arrows };
    }),
  );
}

/** The gap between two versions that share a line: `gap-3`. */
const ARROWS_GAP_PX = 12;
/** A screen's width, rounded, that a box may sit off an edge by. */
const EDGE_PX = 1;

test("versions share a line when both fit, and otherwise take a line each, each on its side", async ({
  page,
}) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/day/barcelona");
    // Barcelona's day is lively, so its energy word names the button the other tests wait on.
    await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    for (const { column, arrows } of await versionLinesOf(page)) {
      const left = arrows.find(({ isLeft }) => isLeft);
      const right = arrows.find(({ isLeft }) => !isLeft);
      // Each stands on its own side, whatever line it takes.
      if (left) expect(left.left).toBeLessThanOrEqual(EDGE_PX);
      if (right) expect(right.right).toBeLessThanOrEqual(EDGE_PX);
      if (!left || !right) continue;
      const isShared = Math.abs(left.top - right.top) <= EDGE_PX;
      // One line exactly when both fit on it with the gap between them.
      const wouldFit = left.width + right.width + ARROWS_GAP_PX <= column + EDGE_PX;
      if (isShared) expect(wouldFit).toBe(true);
      else {
        expect(right.top).toBeGreaterThanOrEqual(left.bottom);
        // Two that would fit share a line, so a stacked pair of one line each never fits.
        if (left.lines === 1 && right.lines === 1) expect(wouldFit).toBe(false);
        // Stacked, each takes its words' width, up to the column's.
        expect(left.lines === 1 || left.width >= column - EDGE_PX).toBe(true);
        expect(right.lines === 1 || right.width >= column - EDGE_PX).toBe(true);
      }
      if (width === 1280) expect(isShared).toBe(true);
    }
    if (width === 390) {
      // The longest name a written day puts on the left stands on one line beside its arrow.
      const longest = page.getByRole("button", { name: /Cocktails along Carrer dels Assaonadors/ });
      const lines = await longest.evaluate(
        (arrow) =>
          arrow.firstElementChild!.getBoundingClientRect().height /
          parseFloat(getComputedStyle(arrow).lineHeight),
      );
      expect(Math.round(lines)).toBe(1);
    }
  }
});

/** Two arrows' press targets: how tall each is, and where a press passes from one to the other. */
interface TargetPair {
  isStacked: boolean;
  left: number;
  right: number;
  handOverFromMiddle: number;
  isOverlapping: boolean;
}

/** The least a version's arrow may be pressed over, down through it, in px. */
const ARROW_TARGET_PX = 31;

test("versions' arrows each keep a press target of their own, stacked or side by side", async ({
  page,
}) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/day/barcelona");
    await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const pairs = await page
      .getByRole("list", { name: "The day, to read" })
      .locator('[role="group"]')
      .evaluateAll((stops): TargetPair[] =>
        stops.flatMap((stop): TargetPair[] => {
          const [left, right] = [...stop.parentElement!.parentElement!.querySelectorAll("button")];
          if (!left || !right) return [];
          left.scrollIntoView({ block: "center" });
          const a = left.getBoundingClientRect();
          const b = right.getBoundingClientRect();
          const hit = (x: number, y: number) => {
            const button = document.elementFromPoint(x, y)?.closest("button");
            return button === left ? "left" : button === right ? "right" : null;
          };
          /** How far down through `x` each arrow takes a press, sampled every quarter pixel. */
          const down = (x: number) => {
            const reach = { left: 0, right: 0, handOver: Number.NaN };
            for (let y = a.top - 16; y <= b.bottom + 16; y += 0.25) {
              const side = hit(x, y);
              if (side) reach[side] += 0.25;
              if (side === "right" && Number.isNaN(reach.handOver)) reach.handOver = y;
            }
            return reach;
          };
          const isStacked = b.top >= a.bottom - 1;
          if (isStacked) {
            // Down the stretch where one stands over the other, or through each alone.
            const from = Math.max(a.left, b.left);
            const to = Math.min(a.right, b.right);
            const shared = to - from > 8 ? down(from + 4) : null;
            return [
              {
                isStacked,
                left: shared?.left ?? down(a.left + a.width / 2).left,
                right: shared?.right ?? down(b.left + b.width / 2).right,
                handOverFromMiddle: shared ? shared.handOver - (a.bottom + b.top) / 2 : 0,
                isOverlapping: false,
              },
            ];
          }
          // Side by side, across the gap at the line's middle: never both at one point.
          let lastLeft = Number.NEGATIVE_INFINITY;
          let firstRight = Number.POSITIVE_INFINITY;
          const y = a.top + a.height / 2;
          for (let x = a.right - 8; x <= b.left + 8; x += 0.25) {
            const side = hit(x, y);
            if (side === "left") lastLeft = x;
            if (side === "right") firstRight = Math.min(firstRight, x);
          }
          return [
            {
              isStacked,
              left: down(a.left + a.width / 2).left,
              right: down(b.left + b.width / 2).right,
              handOverFromMiddle: 0,
              isOverlapping: firstRight <= lastLeft,
            },
          ];
        }),
      );
    expect(pairs.some(({ isStacked }) => isStacked)).toBe(true);
    for (const pair of pairs) {
      expect(pair.left).toBeGreaterThanOrEqual(ARROW_TARGET_PX);
      expect(pair.right).toBeGreaterThanOrEqual(ARROW_TARGET_PX);
      // Stacked, the press passes from one to the other at the middle of the gap between them.
      expect(Math.abs(pair.handOverFromMiddle)).toBeLessThanOrEqual(1);
      expect(pair.isOverlapping).toBe(false);
    }
  }
});
