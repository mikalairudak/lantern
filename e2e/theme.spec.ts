import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

/** The theme's crossing, in milliseconds, as the token in `globals.css` sets it. */
const CROSSING_MS = Number(
  /--duration-theme:\s*(\d+)ms/.exec(readFileSync("src/app/globals.css", "utf8"))?.[1],
);
/** A 60 Hz frame: the crossing ends on the first frame drawn after its length. */
const FRAME_MS = 1000 / 60;
/** How far through a crossing its frame differs from the end by less than one level of 255. */
const WHOLE_PROGRESS = 1 - 1 / 255;

/** The view transition the page is in, which Chromium names on the document. */
interface CrossingDocument extends Document {
  activeViewTransition?: ViewTransition | null;
}

/** Waits for the theme's crossing to end, where one runs: the browser's own promise. */
async function crossingEnded(page: Page): Promise<void> {
  await page.evaluate(() => (document as CrossingDocument).activeViewTransition?.finished);
}

/** The theme's button, named for the look a press gives. */
const THEME_NAME = /^Switch to (dark|light) theme$/;

/** What the theme's button shows: the icon a reader can see and the name it carries. */
async function shownOfferOf(page: Page): Promise<{ icons: string[]; name: string; word: string }> {
  return page
    .locator("[data-theme-icon]")
    .first()
    .evaluate((icon) => {
      const button = icon.closest("button")!;
      const isShown = (element: Element) => getComputedStyle(element).display !== "none";
      const helper = button.parentElement!.querySelector("[data-theme-helper]")!;
      return {
        icons: [...button.querySelectorAll("[data-theme-icon]")]
          .filter(isShown)
          .map((each) => each.getAttribute("data-theme-icon") ?? ""),
        name: [...button.querySelectorAll(".sr-only")]
          .filter(isShown)
          .map((each) => each.textContent)
          .join(""),
        word: [...helper.children]
          .filter(isShown)
          .map((each) => each.textContent)
          .join(""),
      };
    });
}

const MOON = { icons: ["moon"], name: "Switch to dark theme", word: "Dark" };
const SUN = { icons: ["sun"], name: "Switch to light theme", word: "Light" };

/** A theme kept from an earlier visit, in place before the page's first script runs. */
async function keepTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((kept) => localStorage.setItem("lantern-theme", kept), theme);
}

test("the server's page holds both looks' icons and names, for the head script to pick one", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  for (const icon of ["moon", "sun"]) expect(html).toContain(`data-theme-icon="${icon}"`);
  expect(html).toContain("Switch to dark theme");
  expect(html).toContain("Switch to light theme");
});

// The first frame, before React hydrates: the server's HTML and the head script alone.
for (const [scheme, kept, offer] of [
  ["light", null, MOON],
  ["dark", null, SUN],
  ["light", "dark", SUN],
  ["dark", "light", MOON],
] as const) {
  test(`offers ${offer.word} from the first frame on a ${scheme} device with ${kept ?? "nothing"} kept`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    if (kept) await keepTheme(page, kept);
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/");
    expect(await shownOfferOf(page)).toEqual(offer);
  });
}

test("a press turns the page to the other look, says so, and keeps it for the next visit", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const lightGround = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await crossingEnded(page);

  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "The page is dark" })).toHaveCount(1);
  expect(await shownOfferOf(page)).toEqual(SUN);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
    lightGround,
  );
  await page.reload();
  expect(await shownOfferOf(page)).toEqual(SUN);

  // The press back is the device's own look: nothing is kept, and the page follows the device.
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await crossingEnded(page);
  expect(await shownOfferOf(page)).toEqual(MOON);
  expect(await page.evaluate(() => localStorage.getItem("lantern-theme"))).toBeNull();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});

test("a kept choice the device has come to agree with still changes the page on a press", async ({
  page,
}) => {
  await keepTheme(page, "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await shownOfferOf(page)).toEqual(MOON);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await crossingEnded(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("lantern-theme"))).toBe("dark");
});

test("names the look a press gives under the keyboard's focus, at once, and moves nothing", async ({
  page,
}) => {
  await keepTheme(page, "light");
  await page.goto("/");
  const button = page.getByRole("button", { name: "Switch to dark theme" });
  const helper = page.locator("[data-theme-helper]");
  const header = page.locator("header").first();
  await expect(helper).toHaveCSS("opacity", "0");
  // The header holds the index, drawn once the visitor's days are read.
  await expect(
    page.getByRole("list", { name: "No city in mind? Start from one of these" }),
  ).toBeVisible();
  const before = await header.boundingBox();

  // On the start screen the wordmark is only the name, so the button is the keyboard's first stop.
  await page.keyboard.press("Tab");

  await expect(button).toBeFocused();
  // At once: the keyboard's focus waits for nothing.
  await expect(helper).toHaveCSS("transition-delay", "0s");
  await expect(helper).toHaveCSS("opacity", "1");
  expect(await helper.evaluate((element) => (element as HTMLElement).innerText)).toBe("Dark");
  expect(await header.boundingBox()).toEqual(before);
  // Escape puts it away, and the focus stays.
  await page.keyboard.press("Escape");
  await expect(helper).toBeHidden();
  await expect(button).toBeFocused();
});

test("shows its helper under a pointer after its wait, and a press puts it away until the pointer leaves", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger raises no helper");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/day/rome");
  const button = page.getByRole("button", { name: "Switch to dark theme" });
  const helper = page.locator("[data-theme-helper]");
  await button.hover();
  // The wait is the helper's own token, so a pointer crossing the masthead raises nothing.
  await expect(helper).toHaveCSS("transition-delay", "0.4s");
  await expect(helper).toHaveCSS("opacity", "1");

  await button.click();
  await crossingEnded(page);
  await expect(helper).toBeHidden();
  await page.mouse.move(10, 400);
  await page.getByRole("button", { name: "Switch to light theme" }).hover();
  await expect(helper).toHaveCSS("opacity", "1");
  expect(await helper.evaluate((element) => (element as HTMLElement).innerText)).toBe("Light");
});

test("under reduced motion its helper does not fade, and still waits", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger raises no helper");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/day/rome");
  await page.getByRole("button", { name: THEME_NAME }).hover();
  const helper = page.locator("[data-theme-helper]");
  await expect(helper).toHaveCSS("transition-duration", "0s");
  await expect(helper).toHaveCSS("transition-delay", "0.4s");
  await expect(helper).toHaveCSS("opacity", "1");
});

test("its helper stands under its own box, inside the window, and widens no page", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "A finger raises no helper");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/day/rome");
    const button = page.getByRole("button", { name: THEME_NAME });
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const helper = page.locator("[data-theme-helper]");
    await expect(helper).toHaveCSS("opacity", "1");
    const helperBox = (await helper.boundingBox())!;
    const buttonBox = (await button.boundingBox())!;
    const window = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(window.scroll, `at ${width}`).toBe(window.width);
    // 4 px under the button's box, and 8 px or more inside the window's edge.
    expect(helperBox.y).toBeCloseTo(buttonBox.y + buttonBox.height + 4, 0);
    expect(helperBox.x + helperBox.width, `at ${width}`).toBeLessThanOrEqual(window.width - 8);
    if (width === 1280) {
      // With room in the gutter it is centred on the button.
      expect(helperBox.x + helperBox.width / 2).toBeCloseTo(buttonBox.x + buttonBox.width / 2, 0);
    }
  }
});

test("under a finger the button reaches 44 px, and raises no helper", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "A pointer's box is the button's own");
  await page.goto("/day/rome");
  const button = page.getByRole("button", { name: THEME_NAME });
  const reach = await button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const after = getComputedStyle(element, "::after");
    return {
      width: box.width - 2 * parseFloat(after.left),
      height: box.height - 2 * parseFloat(after.top),
    };
  });
  expect(reach).toEqual({ width: 44, height: 44 });
  await button.tap();
  await crossingEnded(page);
  await expect(page.locator("[data-theme-helper]")).toBeHidden();
});

// A city with no day is answered by Lantern's page for no day, which React can draw in the
// browser, where the head script it writes never runs: on the first visit, and on the next.
for (const visit of ["first", "next"]) {
  test(`the page for a day Lantern has not written takes a kept theme on the ${visit} visit`, async ({
    page,
  }) => {
    await keepTheme(page, "dark");
    await page.emulateMedia({ colorScheme: "light" });
    if (visit === "next") await page.goto("/day/porto-nowhere");
    await page.goto("/day/porto-nowhere");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveAttribute("data-theme-choice", "dark");
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
    expect(await shownOfferOf(page)).toEqual(SUN);
  });
}

/** What the page is in, frame by frame from a press to rest. */
interface CrossingFrame {
  /** Milliseconds from the press. */
  t: number;
  theme: string | null;
  ground: string;
  /** How far the root's crossing has come, from 0 to 1, or null while none runs. */
  progress: number | null;
  /** Colour properties easing on their own in this frame. */
  easing: string[];
  /** Whether the theme's helper is drawn in this frame. */
  isHelperShown: boolean;
}

interface CrossingFilm {
  frames: CrossingFrame[];
  /** From the press to the crossing's end. */
  finishedMs: number | null;
  /** The root's pictures' length and curve, as the browser runs them. */
  timings: { duration: number; easing: string }[];
}

/** The film a page keeps from the next key press, as `filmFromNextKey` set it going. */
interface FilmingWindow extends Window {
  crossingFilm?: Promise<CrossingFilm>;
}

/**
 * Films the page in itself on every frame from the next key press, for `ms`: set going before
 * the press, which is left to the test, and read with `filmTaken`.
 */
async function filmFromNextKey(page: Page, ms: number): Promise<void> {
  await page.evaluate((filmMs) => {
    (window as FilmingWindow).crossingFilm = new Promise<CrossingFilm>((resolve) => {
      const film: CrossingFilm = { frames: [], finishedMs: null, timings: [] };
      const isSeenEasing = (target: Element | null | undefined) =>
        target !== null &&
        target !== undefined &&
        target.checkVisibility({ visibilityProperty: true });
      const crossingAnimations = () =>
        document
          .getAnimations()
          .filter((animation) =>
            (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith(
              "::view-transition",
            ),
          );
      document.addEventListener(
        "keydown",
        () => {
          const press = performance.now();
          // The button's own handler starts the crossing once this one has run.
          setTimeout(() => {
            const crossing = (document as CrossingDocument).activeViewTransition;
            void crossing?.finished.then(() => (film.finishedMs = performance.now() - press));
          });
          const sample = () => {
            const running = crossingAnimations();
            if (film.timings.length === 0) {
              film.timings = running.map((animation) => {
                const timing = animation.effect?.getComputedTiming();
                return { duration: Number(timing?.duration), easing: String(timing?.easing) };
              });
            }
            film.frames.push({
              t: performance.now() - press,
              theme: document.documentElement.getAttribute("data-theme"),
              ground: getComputedStyle(document.body).backgroundColor,
              progress: running[0]?.effect?.getComputedTiming().progress ?? null,
              easing: document
                .getAnimations()
                .filter(
                  (animation): animation is CSSTransition =>
                    animation instanceof CSSTransition &&
                    /color|fill|stroke/.test(animation.transitionProperty) &&
                    isSeenEasing((animation.effect as KeyframeEffect | null)?.target),
                )
                .map((animation) => animation.transitionProperty),
              isHelperShown:
                document
                  .querySelector("[data-theme-helper]")
                  ?.checkVisibility({ visibilityProperty: true, opacityProperty: true }) ?? false,
            });
            if (performance.now() - press < filmMs) requestAnimationFrame(sample);
            else resolve(film);
          };
          requestAnimationFrame(sample);
        },
        { capture: true, once: true },
      );
    });
  }, ms);
}

/** The film `filmFromNextKey` took. */
async function filmTaken(page: Page): Promise<CrossingFilm> {
  const film = await page.evaluate(() => (window as FilmingWindow).crossingFilm);
  if (!film) throw new Error("No film was set going");
  return film;
}

test(
  "a press crosses the whole page once, in the theme's time, the new theme whole at its end",
  { tag: "@frame" },
  async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await page.goto("/day/rome");
    const lightGround = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const button = page.getByRole("button", { name: "Switch to dark theme" });
    await button.focus();
    // The focus eases the button's ink and ring in; the film starts once they are at rest.
    await expect.poll(() => button.evaluate((element) => element.getAnimations().length)).toBe(0);

    await filmFromNextKey(page, CROSSING_MS * 3);
    await page.keyboard.press("Enter");
    const { frames, finishedMs, timings } = await filmTaken(page);

    // One crossing of the root, its group and two pictures, linear, in the token's time.
    expect(timings.length).toBeGreaterThan(0);
    for (const timing of timings)
      expect(timing).toEqual({ duration: CROSSING_MS, easing: "linear" });
    // (a) Whole within the crossing's length and a frame's play from its first frame, the old
    // picture whole. Its last frame stands nearer the end than one level of 255 in any colour.
    const first = frames.find((frame) => frame.progress === 0);
    const wholeAt = frames.findIndex((frame) => (frame.progress ?? 0) >= WHOLE_PROGRESS);
    const whole = frames[wholeAt];
    const beforeWhole = frames[wholeAt - 1];
    if (!first || !whole || !beforeWhole) throw new Error("No crossing was filmed whole");
    // A frame's play: a 60 Hz frame, or the one the page took, on a busy machine a little longer.
    const framePlay = Math.max(FRAME_MS, whole.t - beforeWhole.t);
    expect(whole.t - first.t).toBeLessThanOrEqual(CROSSING_MS + framePlay);
    expect(finishedMs).not.toBeNull();
    const after = frames.filter((frame) => frame.t > (finishedMs ?? 0));
    expect(after.length).toBeGreaterThan(0);
    for (const frame of after) {
      expect(frame.progress).toBeNull();
      expect(frame.theme).toBe("dark");
      expect(frame.ground).not.toBe(lightGround);
    }
    // (b) Not a cut: frames part of the way through, the crossing's own pace in each.
    const between = frames.filter(
      (frame) => frame.progress !== null && frame.progress > 0 && frame.progress < 1,
    );
    expect(between.length).toBeGreaterThanOrEqual(Math.floor(CROSSING_MS / FRAME_MS / 2));
    // The helper the keyboard's focus raised goes at once, before the browser takes the old
    // picture.
    expect(frames.filter((frame) => frame.isHelperShown)).toEqual([]);
    // Nothing eases to the new theme on its own, so the new picture is whole from its first frame.
    expect(frames.flatMap((frame) => frame.easing)).toEqual([]);
    // The focus stays on the theme's button, named for what its next press gives.
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeFocused();
  },
);

test("the page takes no press while it crosses, and every press once it has", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  const fieldBox = await field.boundingBox();
  if (!fieldBox) throw new Error("The field has no box");
  const centre = { x: fieldBox.x + fieldBox.width / 2, y: fieldBox.y + fieldBox.height / 2 };

  const button = page.getByRole("button", { name: "Switch to dark theme" });
  const hit = await button.evaluate(async (element, point) => {
    const at = () => document.elementFromPoint(point.x, point.y)?.tagName ?? null;
    (element as HTMLElement).click();
    const crossing = (document as CrossingDocument).activeViewTransition;
    await crossing?.ready;
    const during = at();
    await crossing?.finished;
    return { during, after: at() };
  }, centre);

  // A press while the page crosses lands on the root, which the browser's pictures stand over.
  expect(hit).toEqual({ during: "HTML", after: "TEXTAREA" });
});

test("under reduced motion the first frame after the press is the new theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const lightGround = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const button = page.getByRole("button", { name: "Switch to dark theme" });

  const first = await button.evaluate(async (element) => {
    (element as HTMLElement).click();
    const hasCrossing = Boolean((document as CrossingDocument).activeViewTransition);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      hasCrossing,
      theme: document.documentElement.getAttribute("data-theme"),
      ground: getComputedStyle(document.body).backgroundColor,
    };
  });

  expect(first.hasCrossing).toBe(false);
  expect(first.theme).toBe("dark");
  expect(first.ground).not.toBe(lightGround);
});

test("where the browser has no view transitions, a press sets the theme at once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, "startViewTransition");
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  expect(await page.evaluate(() => "startViewTransition" in document)).toBe(false);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeFocused();
});

test("the device's own change, with nothing chosen, is taken at once, and the button follows it", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  const lightGround = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: "dark" });

  const now = await page.evaluate(() => ({
    hasCrossing: Boolean((document as CrossingDocument).activeViewTransition),
    ground: getComputedStyle(document.body).backgroundColor,
  }));
  expect(now.hasCrossing).toBe(false);
  expect(now.ground).not.toBe(lightGround);
  expect(await shownOfferOf(page)).toEqual(SUN);
});
