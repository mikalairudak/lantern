import { expect, test, type Locator, type Page, waitMs } from "./fixtures";
import { YOUR_DAYS_KEY, type YourDay } from "../src/features/day/your-days";
import { writtenDayAt } from "../src/lib/days/written/days";

/**
 * Under forced colours the device's theme stands over the one chosen in Lantern
 * (`docs/decisions.md`, "Under forced colours the system's theme stands"). The browser forces
 * text, backgrounds and borders but not what SVG draws, so the index's engravings are measured
 * from the pixels painted, against the canvas painted around them: computed styles under forced
 * colours give the author's colours for HTML, not the drawn ones.
 */

/** WCAG's bar for what is drawn rather than written. */
const GRAPHICS_CONTRAST = 3;
/** WCAG's bar for text. */
const TEXT_CONTRAST = 4.5;
/** Room round a picture's box, so the shot holds the canvas beside it. */
const CANVAS_MARGIN_PX = 2;

/** Two inks this close are one colour, read through a screenshot's rounding. */
const SAME_INK_CONTRAST = 1.05;
const INDEX_HEADING = "No city in mind? Start from one of these";

type Scheme = "light" | "dark";
type Rgb = readonly [number, number, number];

function luminanceOf([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrastOf(one: Rgb, other: Rgb): number {
  const [lighter, darker] = [luminanceOf(one), luminanceOf(other)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** A theme kept from an earlier visit, in place before the page's first script runs. */
async function keepTheme(page: Page, theme: Scheme): Promise<void> {
  await page.addInitScript((kept) => localStorage.setItem("lantern-theme", kept), theme);
}

/** The first picture of the index, once its layer for the theme drawn has faded in whole. */
async function drawnPictureOf(page: Page) {
  // The index is drawn once the page has hydrated, after the question.
  await expect(page.getByRole("heading", { name: INDEX_HEADING })).toBeVisible();
  const picture = page.locator("svg[data-picture]").first();
  await picture.scrollIntoViewIfNeeded();
  await expect(picture.locator('rect[data-layer][data-state="drawn"]').first()).toBeAttached();
  return picture;
}

/** The first picture of the index: its canvas and its ink. */
async function inkAndCanvasOf(page: Page): Promise<{ ink: Rgb; canvas: Rgb }> {
  return inkAndCanvasOfBox(page, await drawnPictureOf(page));
}

/**
 * The canvas round an element and the pixel in it most unlike the canvas, read from a shot of
 * the element's box. The shot is decoded in a blank page of the same browser, where nothing of
 * the site's own headers stands in the way of a `data:` image.
 */
async function inkAndCanvasOfBox(page: Page, element: Locator): Promise<{ ink: Rgb; canvas: Rgb }> {
  const box = (await element.boundingBox())!;
  return inkAndCanvasOfClip(page, {
    x: box.x - CANVAS_MARGIN_PX,
    y: box.y - CANVAS_MARGIN_PX,
    width: box.width + 2 * CANVAS_MARGIN_PX,
    height: box.height + 2 * CANVAS_MARGIN_PX,
  });
}

/** A part of the screen, in CSS pixels. */
interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The colour at a clip's top left, read as its canvas, and the pixel in it most unlike that. A
 * clip wholly inside a filled mark gives the mark's colour as its canvas.
 */
async function inkAndCanvasOfClip(page: Page, clip: Clip): Promise<{ ink: Rgb; canvas: Rgb }> {
  const shot = await page.screenshot({ scale: "css", clip });
  const blank = await page.context().newPage();
  const pixels = await blank.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, image.width, image.height).data);
  }, shot.toString("base64"));
  await blank.close();
  const canvas: Rgb = [pixels[0]!, pixels[1]!, pixels[2]!];
  let ink = canvas;
  for (let index = 0; index < pixels.length; index += 4) {
    const pixel: Rgb = [pixels[index]!, pixels[index + 1]!, pixels[index + 2]!];
    if (contrastOf(pixel, canvas) > contrastOf(ink, canvas)) ink = pixel;
  }
  return { ink, canvas };
}

for (const system of ["light", "dark"] as const) {
  for (const chosen of ["light", "dark"] as const) {
    test(`under forced colours on a ${system} device, with ${chosen} chosen, the index's engravings stand clear of the canvas`, async ({
      page,
    }) => {
      await keepTheme(page, chosen);
      await page.emulateMedia({ forcedColors: "active", colorScheme: system });
      await page.goto("/");

      const { ink, canvas } = await inkAndCanvasOf(page);
      // The canvas is the device's: light on a light device, dark on a dark one.
      expect(luminanceOf(canvas) > 0.5).toBe(system === "light");
      expect(contrastOf(ink, canvas)).toBeGreaterThanOrEqual(GRAPHICS_CONTRAST);
    });
  }
}

test("a plate keeps its files as forced colours turn on and end, and stands clear of each canvas", async ({
  page,
}) => {
  await keepTheme(page, "light");
  await page.emulateMedia({ forcedColors: "none", colorScheme: "dark" });
  const asked: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/pictures/")) asked.push(request.url());
  });
  await page.goto("/");
  const picture = await drawnPictureOf(page);
  const filesOf = () =>
    picture.evaluate((svg) =>
      [...svg.querySelectorAll("image")].map((image) => image.getAttribute("href")),
    );
  const files = await filesOf();
  const askedBefore = asked.length;

  // A plate draws the same files in every theme, so forced colours change only its colours.
  await page.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
  const forced = await inkAndCanvasOf(page);
  expect(luminanceOf(forced.canvas) > 0.5).toBe(false);
  expect(contrastOf(forced.ink, forced.canvas)).toBeGreaterThanOrEqual(GRAPHICS_CONTRAST);

  await page.emulateMedia({ forcedColors: "none", colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const chosen = await inkAndCanvasOf(page);
  expect(luminanceOf(chosen.canvas) > 0.5).toBe(true);
  expect(contrastOf(chosen.ink, chosen.canvas)).toBeGreaterThanOrEqual(GRAPHICS_CONTRAST);
  expect(await filesOf()).toEqual(files);
  expect(asked.slice(askedBefore)).toEqual([]);
});

test("under forced colours a day being written keeps its city in the system's text, the light's pass and all", async ({
  page,
}) => {
  const id = "a-day-being-written";
  const day: YourDay = {
    id,
    request: { ...writtenDayAt("kanazawa")!.request, city: "Elche", timezone: "Europe/Madrid" },
    startedAt: new Date().toISOString(),
    energies: [],
    ending: "writing",
    seconds: null,
  };
  await page.addInitScript(([key, kept]) => localStorage.setItem(key, kept), [
    YOUR_DAYS_KEY,
    JSON.stringify([day]),
  ] as const);
  // Still being written whenever the page asks.
  await page.route(`**/api/day/${id}`, (route) => route.fulfill({ json: { status: "unknown" } }));
  await page.emulateMedia({
    forcedColors: "active",
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  await page.goto("/");

  const row = page.getByRole("list", { name: "Your days" }).getByRole("link");
  await expect(row).toHaveAccessibleName(/\. writing$/);
  const city = row.getByText("Elche", { exact: true });
  await expect(city).toHaveClass(/word-lit/);
  const { ink, canvas } = await inkAndCanvasOfBox(page, city);
  expect(luminanceOf(canvas) > 0.5).toBe(false);
  // Text, at text's bar: a clear fill the browser kept would leave the canvas alone.
  expect(contrastOf(ink, canvas)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
});

/** Where each thing in the masthead's row stands: the row holds the theme's button. */
async function mastheadOf(page: Page): Promise<number[][]> {
  return page
    .locator("[data-theme-icon]")
    .first()
    .evaluate((icon) =>
      [...icon.closest("div")!.querySelectorAll("a, button, span")].map((each) => {
        const { x, y, width } = each.getBoundingClientRect();
        return [x, y, width];
      }),
    );
}

for (const path of ["/", "/day/rome"]) {
  test(`under forced colours the theme is not offered on ${path}, holds its room, and the choice comes back after`, async ({
    page,
  }) => {
    await keepTheme(page, "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(path);
    // Dark kept on a light device: the page is dark, and the button offers light.
    const icon = page.getByRole("button", { name: "Switch to light theme" });
    await expect(icon).toBeVisible();
    if (path === "/")
      await expect(page.getByRole("heading", { name: INDEX_HEADING })).toBeVisible();
    else await expect(page.getByRole("button", { name: "Take this day" })).toBeVisible();
    const before = await mastheadOf(page);

    await page.emulateMedia({ forcedColors: "active", colorScheme: "light" });
    await expect(icon).toBeHidden();
    await expect(page.getByRole("button", { name: /^Switch to / })).toHaveCount(0);
    expect(await mastheadOf(page)).toEqual(before);
    // Out of the keyboard's way too: on the start screen the icon is otherwise its first stop.
    if (path === "/") {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.textContent ?? "")).not.toMatch(
        /^Switch to /,
      );
    }
    expect(await page.evaluate(() => localStorage.getItem("lantern-theme"))).toBe("dark");

    await page.emulateMedia({ forcedColors: "none", colorScheme: "light" });
    await expect(icon).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}

test("the theme's helper, shown as forced colours turn on, goes with its button", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  // On the start screen the button is the keyboard's first stop, and its focus shows the helper.
  await page.keyboard.press("Tab");
  const helper = page.locator("[data-theme-helper]");
  await expect(helper).toHaveCSS("opacity", "1");
  await expect(helper).toBeVisible();

  await page.emulateMedia({ forcedColors: "active", colorScheme: "light" });
  await expect(helper).toBeHidden();
});

for (const system of ["light", "dark"] as const) {
  test(`under forced colours on a ${system} device, the locked energy bar marks the day's word with a bead in the system's text`, async ({
    page,
  }) => {
    // The re-plan bench's Elche, its proposal written at a live pace: the bar waits meanwhile
    // (`docs/decisions.md`, "One change at a time, the energy's included").
    const dayTimeoutMs = waitMs(45_000);
    test.setTimeout(2 * dayTimeoutMs);
    await page.goto("/lab/concepts/replan");
    const chart = page.locator('[aria-label^="The day\'s energy"]');
    await expect(chart).toHaveAttribute("aria-busy", "false", { timeout: dayTimeoutMs });
    const bar = page.getByRole("group", { name: "How lively the day is" });
    await expect(bar.locator("svg")).toHaveCount(0);
    await page.locator("h1").getByRole("button", { name: "early dinner", exact: true }).click();
    await page.getByRole("option", { name: "eating late" }).click();
    const day = bar.getByRole("button", { name: "balanced" });
    await expect(day).toHaveAttribute("aria-disabled", "true");
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await page.emulateMedia({ forcedColors: "active", colorScheme: system });

    // One bead, the day's word's, which a screen reader is not given: the word names the level.
    await expect(bar.locator("svg")).toHaveCount(1);
    const bead = day.locator("svg");
    await expect(bead).toHaveAttribute("aria-hidden", "true");
    await expect(day).toHaveAccessibleName("balanced");
    // The bead's own ink, read inside its circle, and the word's, read clear of the bead.
    const beadBox = (await bead.boundingBox())!;
    const wordBox = (await day.boundingBox())!;
    const { canvas: beadInk } = await inkAndCanvasOfClip(page, {
      x: beadBox.x + beadBox.width / 2 - 1,
      y: beadBox.y + beadBox.height / 2 - 1,
      width: 2,
      height: 2,
    });
    const wordLeft = beadBox.x + beadBox.width + CANVAS_MARGIN_PX;
    const { ink: wordInk, canvas } = await inkAndCanvasOfClip(page, {
      x: wordLeft,
      y: wordBox.y,
      width: wordBox.x + wordBox.width - wordLeft,
      height: wordBox.height,
    });
    expect(luminanceOf(canvas) > 0.5).toBe(system === "light");
    expect(contrastOf(beadInk, canvas)).toBeGreaterThanOrEqual(GRAPHICS_CONTRAST);
    // In the system's text: the bead and its word take one colour.
    expect(contrastOf(beadInk, wordInk)).toBeLessThan(SAME_INK_CONTRAST);
  });
}
