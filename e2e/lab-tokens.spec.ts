import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/lab/tokens");
});

test("shows every token group", async ({ page }) => {
  for (const name of ["Color", "Type", "Spacing", "Shape", "Focus", "Large screen", "Motion"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
});

// Color tokens must resolve per element. If they resolve once on :root, both theme
// columns silently render in the page's own theme.
test("renders the light and dark palettes side by side", async ({ page }) => {
  const backgroundOf = (theme: string) =>
    page
      .locator(`[data-theme="${theme}"]`)
      .evaluate((element) => getComputedStyle(element).backgroundColor);

  expect(await backgroundOf("light")).not.toBe(await backgroundOf("dark"));
});

const SAMPLE_MS = 400;

/** How far each spring marker is from the end of its track; 0 means it has arrived. */
function distancesToTrackEnd(markers: Element[]): number[] {
  return markers.map((marker) => {
    const trackEnd = marker.parentElement?.getBoundingClientRect().right ?? 0;
    return trackEnd - marker.getBoundingClientRect().right;
  });
}

test("animates every spring marker to the end of its track", async ({ page }) => {
  const markers = page.locator("[data-spring]");
  await expect(markers).toHaveCount(3);
  const startDistances = await markers.evaluateAll(distancesToTrackEnd);

  // Sampled every frame inside the page, so a marker that jumps straight to the end fails.
  const framesDuringPlay = markers.evaluateAll(
    (elements, sampleMs) =>
      new Promise<number[][]>((resolve) => {
        const frames: number[][] = [];
        const stopAt = performance.now() + sampleMs;
        const sample = () => {
          frames.push(
            elements.map((marker) => {
              const trackEnd = marker.parentElement?.getBoundingClientRect().right ?? 0;
              return trackEnd - marker.getBoundingClientRect().right;
            }),
          );
          if (performance.now() < stopAt) requestAnimationFrame(sample);
          else resolve(frames);
        };
        requestAnimationFrame(sample);
      }),
    SAMPLE_MS,
  );
  await page.getByRole("button", { name: "Play" }).click();
  const frames = await framesDuringPlay;

  startDistances.forEach((start, index) => {
    const isInFlight = frames.some((frame) => {
      const distance = frame[index] ?? start;
      return distance > 1 && distance < start - 1;
    });
    expect(isInFlight, `marker ${index} moves through the track`).toBe(true);
  });
  await expect
    .poll(async () => (await markers.evaluateAll(distancesToTrackEnd)).map(Math.round))
    .toEqual(startDistances.map(() => 0));
  await expect(page.getByRole("button", { name: "Rewind" })).toBeVisible();
});

const REDUCED_MOTION_NOTE = "Reduced motion is on";

test("keeps the reduced-motion note hidden while motion is allowed", async ({ page }) => {
  await expect(page.getByText(REDUCED_MOTION_NOTE)).toBeHidden();
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  // The server cannot know the visitor's setting, so a note chosen on the client
  // fails hydration. The page has to render the same markup either way.
  test("says the markers jump, without a hydration error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.reload();
    await expect(page.getByText(REDUCED_MOTION_NOTE)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
