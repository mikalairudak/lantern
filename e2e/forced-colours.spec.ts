import { expect, test, type Page } from "./fixtures";

/**
 * Under forced colours the device's theme stands over the one chosen in Lantern
 * (`docs/decisions.md`, "Under forced colours the system's theme stands"). The browser forces
 * text, backgrounds and borders but not what SVG draws, so the index's engravings are measured
 * from the pixels painted, against the canvas painted around them: computed styles under forced
 * colours give the author's colours for HTML, not the drawn ones.
 */

/** WCAG's bar for what is drawn rather than written. */
const GRAPHICS_CONTRAST = 3;
/** Room round a picture's box, so the shot holds the canvas beside it. */
const CANVAS_MARGIN_PX = 2;
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

/**
 * The canvas round the picture and the pixel in it most unlike the canvas, read from a shot of
 * the picture's box. The shot is decoded in a blank page of the same browser, where nothing of
 * the site's own headers stands in the way of a `data:` image.
 */
async function inkAndCanvasOf(page: Page): Promise<{ ink: Rgb; canvas: Rgb }> {
  const picture = await drawnPictureOf(page);
  const box = (await picture.boundingBox())!;
  const shot = await page.screenshot({
    scale: "css",
    clip: {
      x: box.x - CANVAS_MARGIN_PX,
      y: box.y - CANVAS_MARGIN_PX,
      width: box.width + 2 * CANVAS_MARGIN_PX,
      height: box.height + 2 * CANVAS_MARGIN_PX,
    },
  });
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

/** Where each thing in the masthead's row stands: the row holds the theme's icon. */
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
    const icon = page.getByRole("button", { name: "Theme: Dark" });
    await expect(icon).toBeVisible();
    if (path === "/")
      await expect(page.getByRole("heading", { name: INDEX_HEADING })).toBeVisible();
    else await expect(page.getByRole("button", { name: "Take this day" })).toBeVisible();
    const before = await mastheadOf(page);

    await page.emulateMedia({ forcedColors: "active", colorScheme: "light" });
    await expect(icon).toBeHidden();
    await expect(page.getByRole("button", { name: /^Theme: / })).toHaveCount(0);
    expect(await mastheadOf(page)).toEqual(before);
    // Out of the keyboard's way too: on the start screen the icon is otherwise its first stop.
    if (path === "/") {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
      expect(
        await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? ""),
      ).not.toMatch(/^Theme/);
    }
    expect(await page.evaluate(() => localStorage.getItem("lantern-theme"))).toBe("dark");

    await page.emulateMedia({ forcedColors: "none", colorScheme: "light" });
    await expect(icon).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}

test("the theme's list, open as forced colours turn on, goes with its icon", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Theme: System" }).click();
  const list = page.getByRole("listbox", { name: "Theme" });
  await expect(list).toBeVisible();

  await page.emulateMedia({ forcedColors: "active", colorScheme: "light" });
  await expect(list).toBeHidden();
  await expect(page.getByRole("option")).toHaveCount(0);
});
