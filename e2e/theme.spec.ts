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

/** The choice the theme's button shows: the one of its three icons a reader can see. */
async function shownIconOf(page: Page): Promise<string[]> {
  return page
    .getByRole("button", { name: /^Theme: / })
    .locator("[data-theme-icon]")
    .evaluateAll((icons) =>
      icons
        .filter((icon) => getComputedStyle(icon).display !== "none")
        .map((icon) => icon.getAttribute("data-theme-icon") ?? ""),
    );
}

/** A theme kept from an earlier visit, in place before the page's first script runs. */
async function keepTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((kept) => localStorage.setItem("lantern-theme", kept), theme);
}

test("the server's page holds every choice's icon, for the head script to pick one", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  for (const choice of ["system", "light", "dark"]) {
    expect(html).toContain(`data-theme-icon="${choice}"`);
  }
  expect(html).toContain('aria-label="Theme: System"');
});

test("shows a kept theme's icon from the first frame, before the page is live", async ({
  page,
}) => {
  await keepTheme(page, "dark");
  // Without its scripts the page is the server's HTML and the head script alone: what the
  // first frame shows, before React hydrates.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.dataset.themeChoice)).toBe("dark");
  expect(await shownIconOf(page)).toEqual(["dark"]);
});

test("shows the system's icon on a dark device, the choice rather than the theme it resolves to", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await shownIconOf(page)).toEqual(["system"]);
  await expect(page.getByRole("button", { name: "Theme: System" })).toBeVisible();
});

test("a theme chosen changes the icon and its name, and on the next visit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Theme: System" }).click();
  await page.getByRole("option", { name: "Dark" }).click();
  await crossingEnded(page);

  await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeFocused();
  expect(await shownIconOf(page)).toEqual(["dark"]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
  expect(await shownIconOf(page)).toEqual(["dark"]);
});

test("names the setting and the choice under the keyboard's focus, and moves nothing", async ({
  page,
}) => {
  await keepTheme(page, "light");
  await page.goto("/");
  const icon = page.getByRole("button", { name: "Theme: Light" });
  const hint = page.locator("[data-theme-hint]");
  const header = page.locator("header").first();
  await expect(hint).toBeHidden();
  // The header holds the index, drawn once the visitor's days are read.
  await expect(
    page.getByRole("list", { name: "No city in mind? Start from one of these" }),
  ).toBeVisible();
  const before = await header.boundingBox();

  // On the start screen the wordmark is only the name, so the icon is the keyboard's first stop.
  await page.keyboard.press("Tab");

  await expect(icon).toBeFocused();
  await expect(hint).toBeVisible();
  // Only the choice's own name shows, as only its icon does.
  expect(await hint.evaluate((element) => (element as HTMLElement).innerText)).toBe(
    "Theme · Light",
  );
  expect(await header.boundingBox()).toEqual(before);
  // Gone while its list hangs where it would be.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "Theme" })).toBeFocused();
  await expect(hint).toBeHidden();
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
    await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
    expect(await shownIconOf(page)).toEqual(["dark"]);
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
  /** Whether the theme's list is drawn in this frame. */
  isListShown: boolean;
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
      // The theme's icon eases from its open list's ink to its own at rest, as it does whenever
      // its list closes, theme or none; a list gone at once is unseen as it leaves.
      const isSeenEasing = (target: Element | null | undefined) =>
        target !== null &&
        target !== undefined &&
        !target.matches('[aria-label^="Theme: "]') &&
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
          // The list's own handler starts the crossing once this one has run.
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
              isListShown:
                document
                  .querySelector('[data-word-list] [role="listbox"]')
                  ?.checkVisibility({ visibilityProperty: true }) ?? false,
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

/** Opens the theme's list from the keyboard, its own choice under the focus. */
async function openThemeList(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Theme: / }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "Theme" })).toBeFocused();
}

test(
  "a theme chosen crosses the whole page once, in the theme's time, the new theme whole at its end",
  { tag: "@frame" },
  async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await page.goto("/day/rome");
    const lightGround = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await openThemeList(page);
    // System is chosen, so Dark is two rows down.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");

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
    // The theme's list closes at once, before the browser takes the old picture.
    expect(frames.filter((frame) => frame.isListShown)).toEqual([]);
    // Nothing eases to the new theme on its own, so the new picture is whole from its first frame.
    expect(frames.flatMap((frame) => frame.easing)).toEqual([]);
    // The focus is back on the theme's icon, named for the new choice.
    await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeFocused();
  },
);

test("the page takes no press while it crosses, and every press once it has", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Theme: System" }).click();
  const field = page.getByRole("textbox", { name: "Where, and anything else" });
  const fieldBox = await field.boundingBox();
  if (!fieldBox) throw new Error("The field has no box");
  const centre = { x: fieldBox.x + fieldBox.width / 2, y: fieldBox.y + fieldBox.height / 2 };

  const hit = await page.getByRole("option", { name: "Dark" }).evaluate(async (option, point) => {
    const at = () => document.elementFromPoint(point.x, point.y)?.tagName ?? null;
    (option as HTMLElement).click();
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
  await page.getByRole("button", { name: "Theme: System" }).click();

  const first = await page.getByRole("option", { name: "Dark" }).evaluate(async (option) => {
    (option as HTMLElement).click();
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

test("where the browser has no view transitions, a theme chosen is set at once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, "startViewTransition");
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  expect(await page.evaluate(() => "startViewTransition" in document)).toBe(false);
  await page.getByRole("button", { name: "Theme: System" }).click();
  await page.getByRole("option", { name: "Dark" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeFocused();
});

test("the device's own change, with the system's theme chosen, is taken at once", async ({
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
});
