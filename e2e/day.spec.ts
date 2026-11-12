import { dayAddressOf } from "../src/lib/days/address";
import { writtenDayAt } from "../src/lib/days/written/days";
import { START_DAYS } from "../src/lib/days/written/start-days";
import { runningSpans } from "../src/lib/time/clock";
import { expect, test, type Locator, type Page, waitMs, chooseTheChart } from "./fixtures";

// These tests drive the chart: each page opens as for a visitor who chose it, since a day
// opens on its plan otherwise.
test.beforeEach(async ({ page }) => {
  await chooseTheChart(page);
});

/** The route lands a written day in about twelve seconds; a cold server adds a few. */
const DAY_TIMEOUT_MS = waitMs(30_000);
/** Tab presses allowed before the page for no day's first link has the focus. */
const MAX_TABS_TO_FIRST_LINK = 10;
/** Where the foot's credit sends OpenStreetMap's. */
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
/** The phone and the laptop the design is judged at. */
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1440, height: 900 };
/** A box this much taller than it shows is a rounding, not something to scroll. */
const SCROLL_ROUNDING_PX = 1;
/** A name that moves this much or less on the screen holds still: the page scrolls by whole pixels. */
const STILL_NAME_PX = 1;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the page scrolls the day, and nothing inside it scrolls on its own", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(isMobile ? PHONE : LAPTOP);
  // The day that stretches the layout most: out past midnight.
  await page.goto("/day/madrid");
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );

  const scroll = await page.evaluate((rounding) => {
    const scrollers = [...document.querySelectorAll("body *")].flatMap((element) => {
      const { overflowY } = getComputedStyle(element);
      const isScroller = overflowY === "auto" || overflowY === "scroll";
      return isScroller && element.scrollHeight > element.clientHeight + rounding
        ? [`${element.tagName.toLowerCase()}.${element.className}`]
        : [];
    });
    return { scrollers, page: document.documentElement.scrollHeight, screen: innerHeight };
  }, SCROLL_ROUNDING_PX);
  expect(scroll.scrollers).toEqual([]);
  expect(scroll.page).toBeGreaterThan(scroll.screen);
});

test("a written day's address writes it from the route, with no lab chrome", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/day/kanazawa");

  await expect(page).toHaveTitle("A calm Saturday in Kanazawa, early start · Lantern");
  const headline = page.getByRole("main").getByRole("heading", { level: 1 });
  await expect(headline).toContainText("A calm Saturday in Kanazawa");
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await expect(page.getByText("Oden in Katamachi", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Lab controls" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

/** Longer than the curve's demonstration took, when there was one, from the ring's landing. */
const UNTOUCHED_MS = 5_000;

/** What the day says, word for word: its headline and every row. */
async function dayWordsOf(page: Page): Promise<string[]> {
  return [
    (await page.getByRole("heading", { level: 1 }).textContent()) ?? "",
    ...(await page.getByRole("list", { name: "The day" }).getByRole("listitem").allTextContents()),
  ];
}

// The page never changes the day by itself (2026-10-30): once written, the day waits for a
// hand, and only draws its invitation, the ring and the example of a pull, beside it.
test("left alone, a written day stays as written, its ring and example drawn beside it", async ({
  page,
}) => {
  // With motion, as a visitor sees it: anything that moved by itself would show here.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/day/kanazawa");
  await expect(page.locator("[data-invitation] circle")).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await expect(page.locator('[data-preview="example"]')).toBeAttached();
  const written = await dayWordsOf(page);

  await page.waitForTimeout(UNTOUCHED_MS);

  expect(await dayWordsOf(page)).toEqual(written);
  // Each stop's words stay beside their bead, on the page.
  const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const stops = page.getByRole("listitem").getByRole("button", { expanded: false });
  const rightEdges = await stops.evaluateAll((buttons) =>
    buttons.map((button) => Math.round(button.getBoundingClientRect().right)),
  );
  expect(rightEdges.length).toBeGreaterThan(0);
  for (const right of rightEdges) expect(right).toBeLessThanOrEqual(pageWidth);
});

test("the ring that invites the first drag waits on the first screen, where the visitor is looking", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");

  // On a phone the middle of the day is a screen or more below; the ring is not there.
  await expect(page.locator("[data-invitation] circle")).toBeInViewport({
    timeout: DAY_TIMEOUT_MS,
  });
});

/** How far, and in how many steps, the pointer moves along the ring's wire, livelier. */
const ALONG_WIRE_PX = 200;
const ALONG_WIRE_STEPS = 10;

test("a pointer over the chart previews a pull, and only a drag makes it", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A phone has no pointer to hover over the chart; it shows the example.");
  await page.setViewportSize(LAPTOP);
  await page.goto("/day/kanazawa");
  const ring = page.locator("[data-invitation] circle");
  await expect(ring).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  const box = await ring.boundingBox();
  if (!box) throw new Error("The ring has no box");
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const alongTheWire = async () => {
    for (let step = 1; step <= ALONG_WIRE_STEPS; step += 1) {
      await page.mouse.move(from.x + (ALONG_WIRE_PX * step) / ALONG_WIRE_STEPS, from.y);
    }
  };
  const headline = page.getByRole("heading", { level: 1 });
  const rows = page.getByRole("list", { name: "The day" });
  const writtenRows = await rows.getByRole("listitem").allTextContents();
  const writtenHeadline = await headline.textContent();

  // Hovered to the right of the curve: the day a pull there would give, dashed, on the chart
  // alone; the headline says the day as written, not a word of it changed, and so do the rows.
  await page.mouse.move(from.x, from.y);
  await alongTheWire();
  await expect(page.locator('[data-preview="pointer"]')).toBeAttached();
  await expect(headline).toHaveText(writtenHeadline ?? "");
  await expect(headline.locator(".italic.text-muted")).toHaveCount(0);
  expect(await rows.getByRole("listitem").allTextContents()).toEqual(writtenRows);

  // Dragged the same way, the day changes: the clause is the day's own, in energy's colour.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await alongTheWire();
  await page.mouse.up();
  await expect(headline.locator(".text-energy", { hasText: /^livelier / })).toBeVisible();
  expect(await rows.getByRole("listitem").allTextContents()).not.toEqual(writtenRows);

  // The invitation has done its job: no ring, no example, and a hover previews nothing more.
  await expect(ring).toHaveCount(0);
  const madeHeadline = await headline.textContent();
  await page.mouse.move(from.x - ALONG_WIRE_PX, from.y + box.height * 4);
  await alongTheWire();
  await expect(page.locator("[data-preview]")).toHaveCount(0);
  await expect(headline).toHaveText(madeHeadline ?? "");
});

test(
  "under reduced motion each row lands whole, and never grows or moves after",
  { tag: "@frame" },
  async ({ page }) => {
    // Each frame from the first: every row's words box, page-relative, once it can be seen.
    await page.addInitScript(() => {
      const frames: { top: number; left: number; height: number; width: number }[][] = [];
      Object.assign(window, { rowFrames: frames });
      const tick = () => {
        const rows = [...document.querySelectorAll('ol[aria-label="The day"] > li')];
        frames.push(
          rows.map((row) => {
            let opacity = 1;
            for (let node: Element | null = row; node; node = node.parentElement) {
              opacity *= Number.parseFloat(getComputedStyle(node).opacity);
            }
            const box = row.querySelector("button[aria-expanded]")?.parentElement;
            const words = box?.getBoundingClientRect();
            if (!words || opacity === 0) return { top: -1, left: -1, height: -1, width: -1 };
            const top = Math.round(words.top + window.scrollY);
            return {
              top,
              left: Math.round(words.left),
              height: Math.round(words.height),
              width: Math.round(words.width),
            };
          }),
        );
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/day/kanazawa");
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );

    const frames = await page.evaluate(
      () => (window as unknown as { rowFrames: { top: number }[][] }).rowFrames,
    );
    const seen = new Map<number, string>();
    let rows = 0;
    for (const frame of frames) {
      frame.forEach((row, index) => {
        if (row.top === -1) return;
        const box = JSON.stringify(row);
        const first = seen.get(index) ?? box;
        expect(box, `row ${index}, once seen`).toBe(first);
        seen.set(index, first);
      });
      rows = Math.max(rows, frame.length);
    }
    expect(seen.size).toBe(rows);
  },
);

test("every written day has an address of its own, which names the day", async ({ page }) => {
  await page.goto("/day/bologna");

  await expect(page).toHaveTitle("A lively Saturday in Bologna, with friends · Lantern");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^A mid-morning coffee near Piazza Maggiore/,
  );
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText(
    "A lively Saturday in Bologna",
  );
});

test("the day's first address, which names no day, sends a visitor on to the start screen", async ({
  page,
}) => {
  await page.goto("/day");

  await expect(page).toHaveURL(/\/$/);
});

const HTTP_NOT_FOUND = 404;

/** The written days, as the not-found page offers them: the starts', each and its address. */
const WRITTEN_DAYS = [
  {
    sentence: "A lively Saturday in Bologna, with friends",
    energy: "lively",
    address: "/day/bologna",
  },
  { sentence: "A calm Sunday in Porto, slow morning", energy: "calm", address: "/day/porto" },
  {
    sentence: "A calm Saturday in Kanazawa, early start",
    energy: "calm",
    address: "/day/kanazawa",
  },
  {
    sentence: "A lively Sunday in Madrid, out late, with friends",
    energy: "lively",
    address: "/day/madrid",
  },
  {
    sentence: "A balanced Sunday in Utrecht, with family",
    energy: "balanced",
    address: "/day/utrecht",
  },
  {
    sentence: "A quiet Saturday in Nafplio, slow morning",
    energy: "quiet",
    address: "/day/nafplio",
  },
];

// A 404 from the first visit: an address under /day that names no day is rewritten to no page
// before the route could send its shell with a 200 (`notADaySource`).
for (const [what, address] of [
  ["a city Lantern has not written", "/day/vienna"],
  ["a city written with an accent", "/day/caf%C3%A9"],
  ["an address Lantern does not have", "/nope"],
  // The days written by hand are fixtures, no days of the site's (`docs/decisions.md`, "The public
  // site offers only days the product wrote").
  ["Kyoto's old address", "/day/kyoto"],
  ["Lisbon's old address", "/day/lisbon"],
  ["Alicante's old address", "/day/alicante"],
] as const) {
  test(`${what} gets Lantern's page for no day, with the days it has written`, async ({ page }) => {
    const response = await page.goto(address);
    const main = page.getByRole("main");

    expect(response?.status()).toBe(HTTP_NOT_FOUND);
    await expect(page).toHaveTitle("No day here · Lantern");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Lantern has no day at this address.",
    );
    const days = main.getByRole("listitem").getByRole("link");
    await expect(days).toHaveCount(WRITTEN_DAYS.length);
    for (const [index, day] of WRITTEN_DAYS.entries()) {
      const link = days.nth(index);
      await expect(link).toHaveText(day.sentence);
      await expect(link).toHaveAttribute("href", day.address);
      // Set as every written day's sentence is: its energy word in its colour, apart from the rest.
      const energy = link.getByText(day.energy, { exact: true });
      const colors = await energy.evaluate((word) => [
        getComputedStyle(word).color,
        getComputedStyle(word.parentElement ?? word).color,
      ]);
      expect(colors[0]).not.toBe(colors[1]);
    }
    await expect(main.getByRole("link", { name: "Plan your own day" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.getByText("404")).toHaveCount(0);
  });
}

// The page is a Server Component, and a constant it imports from a client module arrives as
// a client reference rather than its classes; the links would lose their look.
for (const colorScheme of ["light", "dark"] as const) {
  test(`the page for no day sets its links as Lantern's links, in the ${colorScheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/nope");
    // The wordmark leads home too, set as the name rather than as a link in the text. The
    // written days, "Plan your own day", and the last line's "Privacy and terms" and address,
    // which stands after the main as the page's contentinfo.
    const links = page.getByRole("link").filter({ hasNotText: /^Lantern$/ });
    await expect(links).toHaveCount(WRITTEN_DAYS.length + 3);
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);

    for (const link of await links.all()) {
      expect(await link.evaluate((each) => getComputedStyle(each).textDecorationLine)).toBe(
        "underline",
      );
    }
    // From the keyboard, so the ring shows as it does for a visitor tabbing in.
    const first = links.first();
    for (let presses = 0; presses < MAX_TABS_TO_FIRST_LINK; presses += 1) {
      if (await first.evaluate((each) => each === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(first).toBeFocused();
    // The ring's colour eases in with the link's other colours; it is read once it rests.
    const ring = await first.evaluate(async (each) => {
      await Promise.all(each.getAnimations().map((animation) => animation.finished));
      const style = getComputedStyle(each);
      return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
    });
    expect(ring).toEqual({ width: "2px", style: "solid", color: ink });
  });
}

// OpenStreetMap's licence asks for its credit where its data is used: a day's page ends with
// it, in the page's foot, quieter than the day's own notes.
test("a day's page ends with its sources, crediting OpenStreetMap in the page's foot", async ({
  page,
}) => {
  await page.goto("/day/kanazawa");

  const credit = page.getByRole("link", { name: "© OpenStreetMap contributors" });
  await expect(credit).toHaveAttribute("href", OSM_COPYRIGHT, { timeout: DAY_TIMEOUT_MS });
  await expect(credit).toHaveCount(1);
  const chart = page.getByRole("group", { name: /The day's energy/ });
  const [creditBox, chartBox] = await Promise.all([credit.boundingBox(), chart.boundingBox()]);
  if (!creditBox || !chartBox) throw new Error("The day did not render");
  expect(creditBox.y).toBeGreaterThan(chartBox.y + chartBox.height);
  // Smaller than a stop's kind and neighbourhood, the day's quietest words.
  const sizeOf = (element: Element) => Number.parseFloat(getComputedStyle(element).fontSize);
  const creditSize = await credit.evaluate(sizeOf);
  const noteSize = await page
    .getByRole("list", { name: "The day" })
    .locator(".type-note")
    .first()
    .evaluate(sizeOf);
  expect(creditSize).toBeLessThan(noteSize);
});

/** How far past its words a small link still takes a press. */
const TARGET_REACH_PX = 6;

test("the day's end answer and the foot's credit take a press a little past their words", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(isMobile ? PHONE : LAPTOP);
  await page.goto("/day/kanazawa");
  const credit = page.getByRole("link", { name: "© OpenStreetMap contributors" });
  await expect(credit).toBeAttached({ timeout: DAY_TIMEOUT_MS });

  for (const target of [page.getByRole("button", { name: "Yes" }), credit]) {
    // In the middle of the screen, so every side's probe is inside it.
    await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const reached = await target.evaluate((element, reach) => {
      const box = element.getBoundingClientRect();
      const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      return [
        [box.right + reach, middle.y],
        [box.left - reach, middle.y],
        [middle.x, box.top - reach],
        [middle.x, box.bottom + reach],
      ].map(([x, y]) => element.contains(document.elementFromPoint(x!, y!)));
    }, TARGET_REACH_PX);
    expect(reached).toEqual([true, true, true, true]);
  }
});

// The start screen and the page for no day show no place's data, and a credit there read as
// though Lantern were OpenStreetMap's.
for (const address of ["/", "/nope"]) {
  test(`${address} credits no source`, async ({ page }) => {
    await page.goto(address);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();

    await expect(page.getByRole("link", { name: "© OpenStreetMap contributors" })).toHaveCount(0);
  });
}

test("the beads on the wire an open stop's sheet lies on are drawn again over it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/day/kanazawa");
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  // On a phone, Higashi Chaya District's sheet reaches up over the wires above it.
  const layer = page.locator("svg.z-20");
  await expect(layer.locator("circle")).toHaveCount(0);

  await page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: /^Higashi Chaya District/ })
    .click();
  await expect(page.getByRole("region", { name: "About Higashi Chaya District" })).toBeVisible();

  await expect(layer.locator("circle").first()).toBeAttached();
});

/** Madrid's day, written, at a phone's or a laptop's size: out past midnight. */
async function writeMadrid(page: Page, isMobile: boolean): Promise<void> {
  await page.setViewportSize(isMobile ? PHONE : LAPTOP);
  await page.goto("/day/madrid");
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  // The day's end lands under the chart once the frame has risen to its last hour.
  await expect(page.getByRole("button", { name: "Not quite" })).toBeVisible({
    timeout: DAY_TIMEOUT_MS,
  });
}

/** The name of a written day's last stop, as the day shows it before any re-pick. */
function lastStopNameOf(slug: string): string {
  const last = writtenDayAt(slug)?.itinerary.stops.at(-1);
  if (!last) throw new Error(`No written day at ${slug}`);
  const shown = last.alternatives.find(({ id }) => id === last.selectedPlaceId) ?? last.primary;
  return shown.name;
}

/** The last stop of Madrid's day, whose sheet the day has no room for below it. */
const MADRID_LAST_STOP = lastStopNameOf("madrid");

/** Opens Madrid's last stop. */
async function openLastStop(page: Page): Promise<Locator> {
  await page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: new RegExp(`^${escapedForRegExp(MADRID_LAST_STOP)}`) })
    .click();
  const sheet = page.getByRole("region", { name: `About ${MADRID_LAST_STOP}` });
  await expect(sheet).toBeFocused();
  return sheet;
}

function escapedForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("an open stop's sheet never makes the page taller: the last opens above its name", async ({
  page,
  isMobile,
}) => {
  const pageHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
  await writeMadrid(page, isMobile);
  const closed = await pageHeight();

  const sheet = await openLastStop(page);
  expect(await pageHeight()).toBe(closed);
  const name = page.getByRole("button", {
    name: new RegExp(`^${escapedForRegExp(MADRID_LAST_STOP)}`),
    expanded: true,
  });
  const [sheetBox, nameBox] = await Promise.all([sheet.boundingBox(), name.boundingBox()]);
  if (!sheetBox || !nameBox) throw new Error("The open stop did not render");
  // Anchored to its row: the name stands on the sheet, at its lower edge.
  expect(sheetBox.y).toBeLessThan(nameBox.y);
  expect(sheetBox.y + sheetBox.height).toBeGreaterThan(nameBox.y + nameBox.height);

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  expect(await pageHeight()).toBe(closed);
});

test(
  "a version swapped in from the keyboard leaves an open sheet where it lies, and the focus on the slider",
  { tag: "@frame" },
  async ({ page }) => {
    // On a phone, Kanazawa Castle Park's livelier version is another row, Hirosaka Street.
    await page.setViewportSize(PHONE);
    await page.goto("/day/kanazawa");
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const pageHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
    const slider = page.getByRole("slider", { name: "Energy at 13:30" });
    const valueOf = () => slider.getAttribute("aria-valuetext");
    // The page's height with each version on show, the stop closed.
    await slider.focus();
    const calm = { value: await valueOf(), height: await pageHeight() };
    await page.keyboard.press("ArrowRight");
    const livelyHeight = await pageHeight();
    await page.keyboard.press("ArrowLeft");
    expect(calm.value).toMatch(/^calm/);
    expect(await valueOf()).toBe(calm.value);

    await page
      .getByRole("list", { name: "The day" })
      .getByRole("button", { name: /^Kanazawa Castle Park/ })
      .click();
    const sheet = page.getByRole("region", { name: /^About / });
    await expect(sheet).toBeFocused();
    // Which side of its stop's name the sheet lies on, whether the name stands on it, the edge
    // it unrolls from, and where the name stands on the screen: on a phone the header takes the
    // swap's clause and the line's lead above, and the page scrolls with it, so nothing moves.
    const placeOf = () =>
      sheet.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const name = document
          .querySelector('ol[aria-label="The day"] button[aria-expanded="true"]')
          ?.getBoundingClientRect();
        const isAbove = name !== undefined && box.top < name.top;
        return {
          side: isAbove ? "above" : "below",
          isOnSheet: name !== undefined && box.top < name.top && box.bottom > name.bottom,
          edge: Math.round((isAbove ? box.bottom : box.top) + scrollY),
          nameOnScreen: Math.round(name?.top ?? 0),
        };
      });
    await slider.focus();
    const atOpen = await placeOf();
    expect(atOpen.isOnSheet).toBe(true);
    // The clause stepped in and straight back stands a while in the line it opened, then goes:
    // the page comes back to the calm day's height, and the name under the open sheet holds
    // still on the screen each frame as the line closes above it.
    await page.evaluate(() => {
      const state = window as unknown as { nameTops: number[] };
      state.nameTops = [];
      const sample = () => {
        const name = document.querySelector(
          'ol[aria-label="The day"] button[aria-expanded="true"]',
        );
        if (name) state.nameTops.push(name.getBoundingClientRect().top);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await expect.poll(pageHeight).toBe(calm.height);
    const nameTops = await page.evaluate(
      () => (window as unknown as { nameTops: number[] }).nameTops,
    );
    expect(Math.max(...nameTops) - Math.min(...nameTops)).toBeLessThanOrEqual(STILL_NAME_PX);
    const opened = await placeOf();
    expect(Math.abs(opened.nameOnScreen - atOpen.nameOnScreen)).toBeLessThanOrEqual(STILL_NAME_PX);

    // The livelier version's row is laid out anew, and the sheet keeps to it, on the same side.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("region", { name: "About Hirosaka Street" })).toBeVisible();
    await expect(slider).toBeFocused();
    expect(await placeOf()).toEqual({ ...opened, edge: expect.any(Number) });
    expect(await pageHeight()).toBe(livelyHeight);

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("region", { name: "About Kanazawa Castle Park" })).toBeVisible();
    await expect(slider).toBeFocused();
    expect(await valueOf()).toBe(calm.value);
    // The clause the step back lets go stands its while in its line, then goes, as above.
    await expect.poll(pageHeight).toBe(calm.height);
    expect(await placeOf()).toEqual(opened);
  },
);

/** How many of the chart's beads are fading in or out, not yet whole or gone. */
async function fadingBeadsOf(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('svg[role="group"] g[data-candidate]')].filter((group) => {
        const opacity = Number(getComputedStyle(group).opacity);
        return opacity > 0 && opacity < 1;
      }).length,
  );
}

test("no bead is cut by the edge of a sheet that opens above its name", async ({ page }) => {
  // On a phone Kanazawa's Kanazawa Castle Park opens up, its sheet's top edge across beads above
  // it. A sheet's height moves with its map row, and an edge that comes to rest between two
  // wires, as Gion Shirakawa's, Petiscos on Rua das Flores' and Utrecht's canal walk's did,
  // crosses nothing, so the spec counts what it crossed. Since the rows stood a bead's target
  // over their wires (2026-11-05), no sheet of the six starts that opens up on a laptop crosses
  // a drawn bead; Kazue-machi Chaya District's, read here before, came to rest between two. It
  // counts the chart at rest: as the day lands, a stop's version can change, and the bead it
  // leaves fades out for a quarter of a second, a fade no copy over the sheet draws.
  await page.setViewportSize(PHONE);
  await page.goto("/day/kanazawa");
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  await page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: /^Kanazawa Castle Park/ })
    .click();
  const sheet = page.getByRole("region", { name: /^About Kanazawa Castle Park/ });
  await expect(sheet).toBeFocused();
  await expect(page.locator("svg.z-20 circle").first()).toBeAttached();
  await expect.poll(() => fadingBeadsOf(page)).toBe(0);

  // Every drawn bead an edge of the sheet crosses has its copy over the sheet, and some do.
  const { crossed, cut } = await sheet.evaluate((element) => {
    const edges = element.getBoundingClientRect();
    const chart = document.querySelector('svg[role="group"]');
    const copies = [...document.querySelectorAll("svg.z-20 circle")].map((copy) =>
      copy.getBoundingClientRect(),
    );
    // Drawn: painted, and not under anything faded out or hidden, as a ring for later is.
    const isDrawn = (circle: Element) => {
      for (let node: Element | null = circle; node && node !== chart; node = node.parentElement) {
        const { opacity, visibility, display } = getComputedStyle(node);
        if (Number(opacity) === 0 || visibility === "hidden" || display === "none") return false;
      }
      const style = getComputedStyle(circle);
      const isFilled = style.fill !== "none" && Number(style.fillOpacity) > 0;
      const isStroked =
        style.stroke !== "none" &&
        Number(style.strokeOpacity) > 0 &&
        Number.parseFloat(style.strokeWidth) > 0;
      return isFilled || isStroked;
    };
    const across = [...(chart?.querySelectorAll("circle") ?? [])].flatMap((circle) => {
      const bead = circle.getBoundingClientRect();
      const isAcross = (edge: number) => bead.top < edge - 0.5 && bead.bottom > edge + 0.5;
      const isUnder = bead.right > edges.left && bead.left < edges.right;
      const isCut = isDrawn(circle) && isUnder && (isAcross(edges.top) || isAcross(edges.bottom));
      return isCut ? [bead] : [];
    });
    const isCopied = (bead: DOMRect) =>
      copies.some(
        (copy) => Math.abs(copy.left - bead.left) < 1 && Math.abs(copy.top - bead.top) < 1,
      );
    return {
      crossed: across.length,
      cut: across
        .filter((bead) => !isCopied(bead))
        .map((bead) => `${Math.round(bead.left)},${Math.round(bead.top)}`),
    };
  });
  expect(crossed).toBeGreaterThan(0);
  expect(cut).toEqual([]);
});

const MINUTES_PER_DAY = 24 * 60;

/** A time in the gutter, where it stands down the page, at its minute running past midnight. */
interface GutterTime {
  clock: string;
  y: number;
}

/** The stops' times and each sun's minute said beside it, top to bottom as they stand. */
async function gutterOf(page: Page): Promise<{ stops: GutterTime[]; suns: GutterTime[] }> {
  return page.evaluate(() => {
    const middleOf = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    const stops = [...document.querySelectorAll("[data-start-time]")].map((time) => ({
      clock: time.getAttribute("data-start-time") ?? "",
      y: middleOf(time),
    }));
    const suns = [...document.querySelectorAll("[data-sun]")].flatMap((sun) => {
      const minute = sun.querySelector("text");
      const disc = sun.querySelector("circle");
      return minute && disc ? [{ clock: minute.textContent ?? "", y: middleOf(disc) }] : [];
    });
    return { stops, suns };
  });
}

function clockMinutesOf(clock: string): number {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

for (const { request } of START_DAYS) {
  const address = dayAddressOf(request);
  test(`${address}'s times read down the day, a sun's minute among them in order`, async ({
    page,
    isMobile,
  }) => {
    await page.setViewportSize(isMobile ? PHONE : LAPTOP);
    await page.goto(address);
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const { stops, suns } = await gutterOf(page);
    let previous = -Infinity;
    const running = stops.map((stop) => {
      let minutes = clockMinutesOf(stop.clock);
      while (minutes < previous) minutes += MINUTES_PER_DAY;
      previous = minutes;
      return { ...stop, minutes };
    });
    expect(running.map((stop) => stop.y)).toEqual(
      running.map((stop) => stop.y).sort((a, b) => a - b),
    );
    // On a phone Nafplio's sunset said "17:25" under its dinner's "18:00": a stop's time
    // stands on its name, above the wire where the time scale meets it.
    const outOfOrder = suns.flatMap((sun) =>
      running
        .filter((stop) =>
          stop.minutes <= clockMinutesOf(sun.clock) ? stop.y >= sun.y : stop.y <= sun.y,
        )
        .map((stop) => `${sun.clock} beside ${stop.clock}`),
    );
    expect(outOfOrder).toEqual([]);
  });
}

test("a place's crosshair stands on the line of the last word of where it is, never alone", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(isMobile ? PHONE : LAPTOP);
  await page.goto("/day/nafplio");
  await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
  // On a phone Souvlaki's said "lunch · Palio Nafplio" with its crosshair alone under it.
  const lines = await page
    .getByRole("list", { name: "The day", exact: true })
    .getByTitle("on the map")
    .evaluateAll((marks) =>
      marks
        .filter((mark) => mark.closest("[aria-hidden='true']") === null)
        .map((mark) => {
          const words = [...(mark.parentElement?.childNodes ?? [])].find(
            (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
          );
          const range = document.createRange();
          if (words) range.selectNodeContents(words);
          const word = range.getBoundingClientRect();
          const box = mark.getBoundingClientRect();
          const middle = box.top + box.height / 2;
          return {
            word: words?.textContent ?? "",
            isOnItsLine: middle > word.top && middle < word.bottom,
          };
        }),
    );
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.filter((line) => !line.isOnItsLine)).toEqual([]);
  expect(lines.map((line) => line.word)).toContain("Nafplio");
});

/** The least pointer target, across and down (WCAG 2.5.8). */
const LEAST_TARGET_PX = 24;
/** How finely a bead's target is walked for what a pointer meets. */
const TARGET_STEP_PX = 0.25;

for (const city of ["madrid", "nafplio"]) {
  test(`every version's bead on ${city}'s day is a whole pointer target on a phone`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "a phone's width, where the rows stand closest");
    await page.setViewportSize(PHONE);
    await page.goto(`/day/${city}`);
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    // Down and across its middle, the longest run a pointer meets the bead: on a phone a row's
    // words, 6 px over its wire, took the top of the beads under them, 16.75 px left of 24.
    const targets = await page.evaluate(
      ({ step }) =>
        [...document.querySelectorAll('svg [role="button"]')].map((bead) => {
          bead.scrollIntoView({ block: "center", behavior: "instant" });
          const box = bead.getBoundingClientRect();
          const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          const runOf = (from: number, to: number, at: (along: number) => [number, number]) => {
            let [run, longest] = [0, 0];
            for (let along = from; along < to; along += step) {
              const met = document.elementFromPoint(...at(along));
              run = met && bead.contains(met) ? run + step : 0;
              longest = Math.max(longest, run);
            }
            return longest;
          };
          return {
            bead: bead.getAttribute("aria-label") ?? "",
            down: runOf(box.top - step, box.bottom + step, (y) => [middle.x, y]),
            across: runOf(box.left - step, box.right + step, (x) => [x, middle.y]),
          };
        }),
      { step: TARGET_STEP_PX },
    );
    expect(targets.length).toBeGreaterThan(0);
    const short = targets.filter(
      ({ down, across }) =>
        down < LEAST_TARGET_PX - TARGET_STEP_PX || across < LEAST_TARGET_PX - TARGET_STEP_PX,
    );
    expect(short).toEqual([]);
  });
}

/** What marks a stop's shown bead, filled or hollow (`SHOWN_BEAD_ATTRIBUTE`). */
const SHOWN_BEAD = "data-shown-bead";
/** How far a row's name may move against its own bead in a frame and still stand: under a px. */
const NAME_STANDS_PX = 1.5;
/**
 * The fewest of Madrid's rows whose crosshair shows on a laptop after their words are whole, each
 * hung left of its bead: its evening rows, across the axis from their beads.
 */
const MADRID_MARKS_AFTER_WORDS = 3;

interface RowFrame {
  /** The name's left edge on the screen. */
  left: number | null;
  /** The name's left edge from its bead's middle; null before the bead is drawn. */
  offset: number | null;
  /** What the row says, less what only a screen reader hears. */
  said: string;
  isSeen: boolean;
  isMarked: boolean;
  isHungLeft: boolean;
}

test(
  "a row hung left of its bead keeps its words where they stand as its crosshair comes",
  { tag: "@frame" },
  async ({ page, isMobile }) => {
    test.skip(isMobile, "Madrid's evening rows hang left of their beads on a laptop");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(LAPTOP);
    await page.addInitScript((beadAttribute) => {
      const rows: RowFrame[][] = [];
      Object.assign(window, { rowFrames: rows });
      const sample = (): void => {
        const beads = [...document.querySelectorAll(`[${beadAttribute}]`)].map((bead) => {
          const box = bead.getBoundingClientRect();
          return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        });
        document.querySelectorAll('ol[aria-label="The day"] > li').forEach((item, index) => {
          const button = item.querySelector("button");
          const words = button?.parentElement;
          if (!button || !words) return;
          // A row's bead is the first under its words: its wire runs under them.
          const top = words.getBoundingClientRect().top;
          const bead = beads.filter((each) => each.y > top).sort((a, b) => a.y - b.y)[0];
          const name = button.firstElementChild?.getBoundingClientRect();
          const heard = [...button.querySelectorAll(".sr-only")].map((only) => only.textContent);
          const said = heard.reduce(
            (text, only) => text.replace(only ?? "", ""),
            button.textContent ?? "",
          );
          (rows[index] ??= []).push({
            left: name ? name.left : null,
            offset: name && bead ? name.left - bead.x : null,
            said,
            isSeen:
              getComputedStyle(words).visibility !== "hidden" &&
              item.getAttribute("aria-hidden") !== "true",
            isMarked: button.querySelector("[title='on the map']") !== null,
            isHungLeft: getComputedStyle(words).textAlign === "right",
          });
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, SHOWN_BEAD);
    await page.goto("/day/madrid");
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const rows = await page.evaluate(
      () => (window as unknown as { rowFrames: RowFrame[][] }).rowFrames,
    );
    // A crosshair that shows in a frame of its own, the row seen and saying the same as the frame
    // before, holds its name still there and in the frame after, as a width set a frame before
    // its place would land in the next. One that shows as its bead is weighed comes with the
    // rest of what the row says, as the row sets off. Held from when the check came, or the name
    // was whole, its room moved the Retiro's 16 px left.
    const moves: string[] = [];
    let checked = 0;
    rows.forEach((frames) => {
      const marked = frames.findIndex((frame) => frame.isMarked);
      const stands = (at: number): boolean => {
        const [now, before] = [frames[at], frames[at - 1]];
        return Boolean(now?.isSeen && before?.isSeen && now.said === before.said);
      };
      if (marked < 1 || !frames[marked]?.isHungLeft || !stands(marked)) return;
      for (const at of [marked, marked + 1].filter(stands)) {
        const [now, before] = [frames[at], frames[at - 1]];
        if (!now || !before || now.offset === null || before.offset === null) continue;
        checked += 1;
        // A step moves the words on the screen and away from their bead at once: a bead sliding
        // in under words standing at rest moves alone, and words riding their bead move with it.
        const against = now.offset - before.offset;
        const moved = (now.left ?? 0) - (before.left ?? 0);
        if (Math.abs(against) >= NAME_STANDS_PX && Math.abs(moved) >= NAME_STANDS_PX) {
          moves.push(`${now.said}: ${moved.toFixed(1)} px`);
        }
      }
    });
    expect(moves).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(MADRID_MARKS_AFTER_WORDS * 2);
  },
);

/**
 * The most a row's words may move on the screen in a 60 Hz frame's time as their bead is
 * weighed: words that ride their bead in move up to about 19 px a frame; a row whose box widened
 * as its second line came moved its words 77 to 123 px in one.
 */
const LANDING_STEP_PX = 30;

interface LandingFrame {
  t: number;
  left: number | null;
  isSeen: boolean;
}

for (const city of ["madrid", "bologna"]) {
  test(
    `${city}'s rows keep their words where they stand as their beads are weighed`,
    { tag: "@frame" },
    async ({ page, isMobile }) => {
      test.skip(
        isMobile,
        "on a laptop the first rows stand at rest before their beads are weighed",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(LAPTOP);
      await page.addInitScript(() => {
        const rows: LandingFrame[][] = [];
        Object.assign(window, { landingFrames: rows });
        const sample = (): void => {
          const t = performance.now();
          document.querySelectorAll('ol[aria-label="The day"] > li').forEach((item, index) => {
            const button = item.querySelector("button");
            const words = button?.parentElement;
            if (!button || !words) return;
            (rows[index] ??= []).push({
              t,
              left: button.firstElementChild?.getBoundingClientRect().left ?? null,
              isSeen:
                getComputedStyle(words).visibility !== "hidden" &&
                item.getAttribute("aria-hidden") !== "true",
            });
          });
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.goto(`/day/${city}`);
      await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
        { timeout: DAY_TIMEOUT_MS },
      );
      const rows = await page.evaluate(
        () => (window as unknown as { landingFrames: LandingFrame[][] }).landingFrames,
      );
      // Each row's words, seen in two frames running: how far they moved in a 60 Hz frame's time.
      const jumps = rows.flatMap((frames, row) =>
        frames.flatMap((now, at) => {
          const before = frames[at - 1];
          if (!before?.isSeen || !now.isSeen || before.left === null || now.left === null) {
            return [];
          }
          const frames60 = Math.max(1, (now.t - before.t) / FRAME_MS);
          const pace = Math.abs(now.left - before.left) / frames60;
          return pace >= LANDING_STEP_PX ? [`row ${row}: ${pace.toFixed(0)} px a frame`] : [];
        }),
      );
      expect(jumps).toEqual([]);
    },
  );
}

/** After a day with motion has said it is still, how long it is watched for an error. */
const AFTER_REST_MS = 1500;

test.describe("with motion, on a phone", () => {
  test.use({ reducedMotion: "no-preference" });
  for (const { request } of START_DAYS) {
    const address = dayAddressOf(request);
    // Madrid's phone looped through a row's weighing and unweighing and lost its page.
    test(`${address} plays to its end with motion on a 390 px phone, with no error`, async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, "a phone's own width and touch");
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(PHONE);
      await page.goto(address);
      await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
        { timeout: DAY_TIMEOUT_MS },
      );
      await page.waitForTimeout(AFTER_REST_MS);
      await expect(page.getByRole("list", { name: "The day" })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

/** The most a chart frame may move in a 60 Hz frame's time and still read as a glide. */
const FRAME_GLIDE_PX = 4;
/** A 60 Hz frame, to which a slower page's steps are scaled. */
const FRAME_MS = 1000 / 60;
/**
 * The pace is read over two 60 Hz frames' time. On a busy page a frame is drawn late and the
 * next catches up, so one frame's reading swings (6.3 px in 26 ms, then none in 20 ms, for a
 * glide of 2.3 px a frame); over two frames a glide reads as itself, and a step of a header's
 * lines, 29 px or more, still reads far past `FRAME_GLIDE_PX`. A little under two frames, so
 * two frames read 16.6 ms apart make a window.
 */
const PACE_WINDOW_MS = FRAME_MS * 1.9;
/** How long the next day may take to land its first stop under a cold, busy server. */
const NEXT_DAY_MS = 15_000;
/** Frames sampled once the next day's first stop has landed, to see the frame stay. */
const FRAMES_AFTER_LANDING = 12;
/**
 * How far the header room's glide is from its end when Motion calls it at rest: a spring set by
 * its visual duration ends when it is within 0.5 px and slower than 2 px/s
 * (`motion-dom`'s `springDefaults`, `restDelta` and `restSpeed`), and its last frame steps onto
 * the end. On the layout spring's tail the speed binds first, about a fifth of a pixel out; a
 * glide stretched over a longer way (`springOver`) slows its tail and the half pixel binds, so
 * the step is at most half a pixel. The first stop lands once the room rests; on a quick
 * page a frame later, so the frame before it has already stepped, but under load the step and
 * the landing can share a frame, and the frame before the landing read 0.19 px from the frames
 * after it, past the 0.05 px this test held it to (2026-11-01).
 */
const SPRING_REST_PX = 0.5;
/**
 * Days played from a city word's list, their headers lines apart on a phone: Bologna's two
 * lines taller than Utrecht's, Nafplio's four, the furthest the starts go, and Porto's a line
 * shorter than Nafplio's. The header's room glides further in proportionally longer
 * (`ROOM_REACH_PX`), so the chart under it keeps to a glide's pace however far it goes.
 */
const CITY_CHANGES = [
  { from: "utrecht", word: "Utrecht", to: "Bologna" },
  { from: "utrecht", word: "Utrecht", to: "Nafplio" },
  { from: "nafplio", word: "Nafplio", to: "Porto" },
];

interface FrameSample {
  t: number;
  top: number;
  rows: number;
}

for (const { from, word, to } of CITY_CHANGES) {
  test(
    `${word}'s day played as ${to} from the city word keeps the chart where it stood, and lands the first stop once it rests`,
    { tag: "@frame" },
    async ({ page, isMobile }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(isMobile ? PHONE : LAPTOP);
      await page.goto(`/day/${from}`);
      await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
        { timeout: DAY_TIMEOUT_MS },
      );
      await page
        .getByRole("heading", { level: 1 })
        .getByRole("button", { name: word, exact: true })
        .click();
      const next = page
        .getByRole("group", { name: "Where" })
        .getByRole("button", { name: new RegExp(`^${to}`) });
      await expect(next).toBeVisible();
      // Where the chart frame stands each frame, and how many of its rows are on screen: the
      // day's rows go with the press, and the next day's come back from its first stop on.
      const sampled = page.evaluate(
        ({ timeout, afterLanding }) =>
          new Promise<FrameSample[]>((resolve) => {
            const frames: FrameSample[] = [];
            const start = performance.now();
            let isSwapped = false;
            let landedAt: number | null = null;
            const tick = () => {
              const frame = document.querySelector(".h-day");
              const rows = document.querySelectorAll('ol[aria-label="The day"] > li').length;
              if (frame) {
                const top = frame.getBoundingClientRect().top + window.scrollY;
                frames.push({ t: performance.now() - start, top, rows });
              }
              if (rows === 0) isSwapped = true;
              if (isSwapped && rows > 0 && landedAt === null) landedAt = frames.length;
              const isDone = landedAt !== null && frames.length - landedAt >= afterLanding;
              if (isDone || performance.now() - start > timeout) resolve(frames);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        { timeout: NEXT_DAY_MS, afterLanding: FRAMES_AFTER_LANDING },
      );
      await next.click();
      const frames = await sampled;

      const swap = frames.findIndex((frame) => frame.rows === 0);
      expect(swap, "the day's rows went with the press").toBeGreaterThan(0);
      const landed = frames.findIndex((frame, at) => at > swap && frame.rows > 0);
      expect(landed, `${to}'s first stop landed`).toBeGreaterThan(swap);
      const before = frames[0]?.top ?? 0;
      const after = frames.at(-1)?.top ?? 0;
      for (let at = 1; at < frames.length; at++) {
        const now = frames[at];
        if (!now) continue;
        // The latest frame at least a window before this one, or the first.
        let from = at - 1;
        while (from > 0 && now.t - (frames[from]?.t ?? 0) < PACE_WINDOW_MS) from -= 1;
        const last = frames[from];
        if (!last) continue;
        const step = Math.abs(now.top - last.top) / Math.max(1, (now.t - last.t) / FRAME_MS);
        expect(step, `the frame at ${Math.round(now.t)} ms`).toBeLessThanOrEqual(FRAME_GLIDE_PX);
        // Held where it stood, it only ever glides by the two headers' difference.
        expect(now.top).toBeGreaterThanOrEqual(Math.min(before, after) - SCROLL_ROUNDING_PX);
        expect(now.top).toBeLessThanOrEqual(Math.max(before, after) + SCROLL_ROUNDING_PX);
      }
      // The first stop lands on a frame at rest, as the spring defines rest, and the frame stays.
      const resting = frames[landed - 1]?.top ?? 0;
      for (const frame of frames.slice(landed - 1)) {
        expect(
          Math.abs(frame.top - resting),
          "the frame once the first stop landed",
        ).toBeLessThanOrEqual(SPRING_REST_PX);
      }
    },
  );
}

/** The least an open stop's sheet is wide where its row's run has room, as on a laptop. */
const SHEET_LEAST_PX = 448;
/** From the chart's left edge to where a sheet's run starts: the time axis, and 8 px clear of it. */
const SHEET_RUN_FROM_PX = 60;
/** Under half a pixel. */
const PIXEL = 0;

test("an open stop's sheet is at least 448 px wide on a laptop, and takes its whole run on a phone", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(isMobile ? PHONE : LAPTOP);
  await page.goto("/day/kanazawa");
  const chart = page.getByRole("group", { name: /The day's energy/ });
  await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
  // The dinner folds to its name and kind, so its sheet is as narrow as a sheet goes.
  await page
    .getByRole("list", { name: "The day" })
    .getByRole("button", { name: /^Oden in Katamachi/ })
    .click();
  const sheet = page.getByRole("region", { name: "About Oden in Katamachi" });
  await expect(sheet).toBeFocused();

  const [sheetBox, chartBox] = await Promise.all([sheet.boundingBox(), chart.boundingBox()]);
  if (!sheetBox || !chartBox) throw new Error("The sheet or the chart did not render");
  const run = chartBox.width - SHEET_RUN_FROM_PX;
  expect(sheetBox.width).toBeCloseTo(isMobile ? run : SHEET_LEAST_PX, PIXEL);
  expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 0.5);
});

/** What a chart draws besides its time: the energy scale over its plot, and the inset under it. */
const FRAME_INSETS_PX = 60;
const FRAME_INSET_BELOW_PX = 20;
const ENERGIES = ["quiet", "calm", "balanced", "lively", "social"];
/** Kanazawa's day asks for 07:00 to 23:00. */
const KANAZAWA_ASKED_MINUTES = 16 * 60;
const MINUTES_PER_HOUR = 60;

/**
 * How many minutes a whole day's frame runs on under its last stop's wire: from the wire, at the
 * visit's middle, to the whole hour the visit ends by, where the frame ends.
 */
function underLastWireOf(slug: string): number {
  const stops = writtenDayAt(slug)?.itinerary.stops ?? [];
  const last = runningSpans(stops).at(-1);
  if (!last) throw new Error(`No written day at ${slug}`);
  const frameEnd = Math.ceil(last.to / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
  return frameEnd - (last.from + last.to) / 2;
}

/** Kanazawa's last wire, at 19:45, stands 75 minutes above 21:00, where its whole frame ends. */
const KANAZAWA_UNDER_LAST_WIRE = underLastWireOf("kanazawa");

/**
 * The minutes each written day's frame asks for while it is written, and how many it runs on
 * under its last stop's wire once it is whole. Kanazawa's last visit, 19:15 to 20:15, has its
 * wire at 19:45, and its frame ends at 21:00, the whole hour after it, rather than at the
 * 23:00 asked. Bologna's and Madrid's last visits run past the midnight a late end asks for,
 * so their frames stretch to the whole hour their last visits end by, and end there.
 */
const WHOLE_FRAMES = [
  { day: "kanazawa", askedMinutes: KANAZAWA_ASKED_MINUTES },
  { day: "bologna", askedMinutes: 16 * 60 },
  { day: "madrid", askedMinutes: 17 * 60 },
].map((frame) => ({ ...frame, underLastWire: underLastWireOf(frame.day) }));

/** How far the chart's frame runs under its last wire, and the day's height its pace is fitted to. */
function frameUnderLastWire(page: Page): Promise<{ under: number; dayHeight: number }> {
  return page.evaluate((insetBelow) => {
    const chart = document.querySelector('svg[role="group"]');
    const day = document.querySelector(".h-day");
    if (!chart || !day) throw new Error("The day did not render");
    const wires = [...chart.querySelectorAll("path")].flatMap((path) => {
      const wire = /^M[\d.]+ ([\d.]+) H/.exec(path.getAttribute("d") ?? "");
      return wire ? [Number(wire[1])] : [];
    });
    const plotBottom = Number(chart.getAttribute("height")) - insetBelow;
    return { under: plotBottom - Math.max(...wires), dayHeight: day.clientHeight };
  }, FRAME_INSET_BELOW_PX);
}

for (const { day, askedMinutes, underLastWire } of WHOLE_FRAMES) {
  test(`${day}'s frame ends on the whole hour after its last visit, at its pace, in every plan a re-pick shows`, async ({
    page,
    isMobile,
  }) => {
    await page.setViewportSize(isMobile ? PHONE : LAPTOP);
    await page.goto(`/day/${day}`);
    const chart = page.getByRole("group", { name: /The day's energy/ });
    await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
    const written = await frameUnderLastWire(page);
    const pace = (written.dayHeight - FRAME_INSETS_PX) / askedMinutes;
    expect(written.under).toBeCloseTo(pace * underLastWire, PIXEL);

    // A re-pick lays the rows out anew and the frame's end keeps to the last of them: what
    // moves the page is the rows' new words, never the frame's hours.
    const headline = page.getByRole("heading", { level: 1 });
    for (const energy of ENERGIES) {
      await headline.getByRole("button").first().click();
      await page.getByRole("option", { name: new RegExp(`^${energy}`) }).click();
      await expect(chart).toHaveAttribute("aria-busy", "false");
      const { under } = await frameUnderLastWire(page);
      expect(under, `re-picked ${energy}`).toBeCloseTo(written.under, PIXEL);
    }
  });
}

/**
 * The least time, in ms, the frame's end and the line under it take from a tenth to
 * nine tenths of Kanazawa's 60 px shrink as a whole day's frame settles to its own hours. By
 * Motion's own arithmetic the gentle spring takes 385 ms, peaking at 4.8 px a 60 Hz frame
 * (docs/decisions.md, "A row's words go where its bead comes to rest, and rows ease rather than
 * jump"), the layout spring 214 ms at 7.8, and a step none. A longer shrink only takes longer:
 * `gentleOver` stretches the spring past 90 px.
 *
 * It is read as a time, not a speed: a frame drawn late on a busy machine carries the moves
 * of the frames before it, so a speed read over a frame, or over a tenth of a second, reached
 * 6.6 to 9.2 px a frame on the gentle spring. Measured on both projects with 12 workers: the
 * gentle spring took 345 to 435 ms at 1× the CPU's time and 321 to 434 at 2× (36 runs), and
 * 379 to 391 at 4× with 2 workers; the layout spring 212 to 253, 209 to 290 and 135 to 222,
 * each of its 36 runs caught. Twelve pages at 4× at once starve the machine, and the gentle
 * spring read 230 to 386 there: no bar tells the springs apart at that load.
 */
const SHRINK_LEAST_MS = 300;
/** The shares of the shrink between which its time is read. */
const SHRINK_TIMED_FROM = 0.1;
const SHRINK_TIMED_TO = 0.9;
/** How much of the shrink a run of frames must hold to be it. */
const SHRINK_SEEN_SHARE = 0.95;
/** Kanazawa's frame ends at 21:00 rather than at 23:00 once the day is whole. */
const KANAZAWA_CUT_MINUTES = 2 * 60;

interface ShrinkFrame {
  t: number;
  bottom: number;
  under: number | null;
}

/**
 * A run that holds still this long has ended: the shrink, once begun, moves in every frame
 * until it rests, while the last row settling into its room seconds before it does not.
 */
const SHRINK_REST_MS = 250;

/**
 * The run of frames over which the frame's end rises furthest, never falling back and never
 * resting: the shrink. A frame drawn twice in a row stays in the run, unless the end has held
 * still for `SHRINK_REST_MS`: then the run ended there. Read through the rest, the shrink took
 * in the last row settling into its room some six seconds before it, 5 px more.
 */
function shrinkOf(frames: readonly ShrinkFrame[]): readonly ShrinkFrame[] {
  let longest: readonly ShrinkFrame[] = [];
  let from = 0;
  let movedAt = frames[0]?.t ?? 0;
  for (let at = 1; at <= frames.length; at++) {
    const [last, now] = [frames[at - 1], frames[at]];
    if (last && now && now.bottom < last.bottom) {
      movedAt = now.t;
      continue;
    }
    if (last && now && now.bottom === last.bottom && now.t - movedAt <= SHRINK_REST_MS) continue;
    const run = frames.slice(from, at);
    const riseOf = (each: readonly ShrinkFrame[]) =>
      (each[0]?.bottom ?? 0) - (each.at(-1)?.bottom ?? 0);
    if (riseOf(run) > riseOf(longest)) longest = run;
    from = at;
  }
  return longest;
}

interface Reading {
  t: number;
  value: number;
}

/**
 * How long a falling run of readings takes from `SHRINK_TIMED_FROM` to `SHRINK_TIMED_TO` of
 * its whole fall, each share's moment read between the frames on either side of it.
 */
function timedShareOf(run: readonly Reading[]): number {
  const [first, last] = [run[0], run.at(-1)];
  if (!first || !last) return Number.NaN;
  const momentOf = (share: number) => {
    const target = first.value - (first.value - last.value) * share;
    for (let at = 1; at < run.length; at++) {
      const [before, after] = [run[at - 1], run[at]];
      if (!before || !after || after.value > target) continue;
      const fall = before.value - after.value;
      const part = fall === 0 ? 1 : (before.value - target) / fall;
      return before.t + part * (after.t - before.t);
    }
    return Number.NaN;
  };
  return momentOf(SHRINK_TIMED_TO) - momentOf(SHRINK_TIMED_FROM);
}

test(
  "with motion, Kanazawa's frame glides up to its own hours once the day is written, the line under it with it",
  { tag: "@frame" },
  async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(isMobile ? PHONE : LAPTOP);
    // Every frame from the first, the page kept at its end as a visitor following the day is:
    // there the page's shrinking end carries what is on screen with it.
    await page.addInitScript(() => {
      const frames: ShrinkFrame[] = [];
      Object.assign(window, { shrinkFrames: frames });
      const start = performance.now();
      const tick = () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const chart = document.querySelector('svg[role="group"]');
        // The line under the chart, which rides its frame's end: the day's end, or the line
        // saying how far the day is written. The page's foot under it also makes room for the
        // day's end as it lands (day-end.spec.ts).
        const under = document.querySelector("[data-under-chart]");
        if (chart) {
          frames.push({
            t: performance.now() - start,
            bottom: chart.getBoundingClientRect().bottom + scrollY,
            under: under ? under.getBoundingClientRect().top + scrollY : null,
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/day/kanazawa");
    const chart = page.getByRole("group", { name: /The day's energy/ });
    await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });
    const { dayHeight } = await frameUnderLastWire(page);
    const pace = (dayHeight - FRAME_INSETS_PX) / KANAZAWA_ASKED_MINUTES;
    await expect
      .poll(async () => (await frameUnderLastWire(page)).under)
      .toBeCloseTo(pace * KANAZAWA_UNDER_LAST_WIRE, PIXEL);
    const shrink = shrinkOf(
      await page.evaluate(
        () => (window as unknown as { shrinkFrames: ShrinkFrame[] }).shrinkFrames,
      ),
    );

    // The run of frames is read from the first that moves; its last pixel can fall in the
    // frame after the run is read.
    const rise = (shrink[0]?.bottom ?? 0) - (shrink.at(-1)?.bottom ?? 0);
    expect(rise).toBeGreaterThan(pace * KANAZAWA_CUT_MINUTES * SHRINK_SEEN_SHARE);
    expect(rise).toBeLessThan(pace * KANAZAWA_CUT_MINUTES + 1);
    const ends = shrink.map(({ t, bottom }) => ({ t, value: bottom }));
    const underLine = shrink.flatMap(({ t, under }) =>
      under === null ? [] : [{ t, value: under }],
    );
    expect(timedShareOf(ends), "the frame's end").toBeGreaterThanOrEqual(SHRINK_LEAST_MS);
    expect(timedShareOf(underLine), "the line under it").toBeGreaterThanOrEqual(SHRINK_LEAST_MS);
  },
);

/** A twin stands this far from its version on the wire (`CHART.twinStep`). */
const TWIN_STEP_PX = 24;
/** Long enough for a scroll into view to have been drawn. */
const SCROLL_SETTLE_MS = 300;
/** Frames of the curve taken before a press, so the frame it moves in is seen. */
const FRAMES_BEFORE_TAP = 3;

test(
  "a twin picked moves the curve there with its bead, never in a frame",
  { tag: "@frame" },
  async ({ page }) => {
    // Nafplio's walk at 11:15 has two versions at one energy: the curve goes through the one
    // shown, so a tap on its twin carries the curve a twin's step along the wire. Taken at
    // once, the curve stood there a frame before the bead set off.
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/day/nafplio");
    await expect(page.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    // The walk's wire on screen, mid-way down it.
    await page.evaluate(() =>
      document
        .querySelector('[role="slider"][aria-label="Energy at 11:15"]')
        ?.scrollIntoView({ block: "center" }),
    );
    await page.waitForTimeout(SCROLL_SETTLE_MS);
    const twin = await page.evaluate(() => {
      const svg = document.querySelector('svg[role="group"][aria-label^="The day\'s energy"]')!;
      const slider = document.querySelector('[role="slider"][aria-label="Energy at 11:15"]')!;
      const row = slider.getBoundingClientRect();
      const y = row.top + row.height / 2;
      const beads = [...svg.querySelectorAll("[data-candidate] circle")]
        .map((circle) => circle.getBoundingClientRect())
        .filter((box) => Math.abs(box.top + box.height / 2 - y) < 2)
        .map((box) => box.left + box.width / 2);
      const shown = [...svg.querySelectorAll("circle")].find((circle) => {
        const box = circle.getBoundingClientRect();
        return (
          circle.closest("[data-candidate]") === null &&
          Math.abs(box.top + box.height / 2 - y) < 2 &&
          box.width > 8 &&
          box.width < 20
        );
      });
      const shownBox = shown!.getBoundingClientRect();
      const shownX = shownBox.left + shownBox.width / 2;
      const nearest = beads.sort((a, b) => Math.abs(a - shownX) - Math.abs(b - shownX))[0]!;
      return { x: nearest, y, gap: Math.abs(nearest - shownX) };
    });
    expect(twin.gap).toBeCloseTo(TWIN_STEP_PX, 0);
    // Where the curve crosses the walk's wire, each frame from the tap on.
    await page.evaluate((y) => {
      const crossings: number[] = [];
      (window as unknown as { crossings: number[] }).crossings = crossings;
      const svg = document.querySelector('svg[role="group"][aria-label^="The day\'s energy"]')!;
      const tick = () => {
        const path = svg.querySelector<SVGPathElement>("path.stroke-curve");
        if (path) {
          const m = path.getScreenCTM()!;
          let best: { x: number; y: number } | null = null;
          for (let at = 0; at <= path.getTotalLength(); at += 0.25) {
            const point = path.getPointAtLength(at);
            const screen = {
              x: m.a * point.x + m.c * point.y + m.e,
              y: m.b * point.x + m.d * point.y + m.f,
            };
            if (best === null || Math.abs(screen.y - y) < Math.abs(best.y - y)) best = screen;
          }
          if (best) crossings.push(best.x);
        }
        if (crossings.length < SAMPLED_FRAMES) requestAnimationFrame(tick);
      };
      const SAMPLED_FRAMES = 40;
      requestAnimationFrame(tick);
    }, twin.y);

    // Pressed once a few frames are taken before it, so the frame it moves in is among them.
    await page.waitForFunction(
      (frames) => (window as unknown as { crossings: number[] }).crossings.length >= frames,
      FRAMES_BEFORE_TAP,
      { polling: "raf" },
    );
    await page.mouse.click(twin.x, twin.y);
    await page.waitForTimeout(1000);

    const crossings = await page.evaluate(
      () => (window as unknown as { crossings: number[] }).crossings,
    );
    const steps = crossings.slice(1).map((x, index) => Math.abs(x - (crossings[index] ?? x)));
    // It went some way, and never the whole of it in one frame.
    expect(Math.abs((crossings.at(-1) ?? 0) - (crossings[0] ?? 0))).toBeGreaterThan(
      TWIN_STEP_PX / 4,
    );
    expect(Math.max(...steps), crossings.map((x) => x.toFixed(1)).join(" ")).toBeLessThanOrEqual(
      TWIN_STEP_PX / 2,
    );
  },
);
