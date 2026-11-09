import { expect, test } from "./fixtures";

/** How long the samples run: past the model's first words on a written day's link. */
const SAMPLE_MS = 3000;
/** A band stepping back this far is a jump; its loop wraps from past the screen's edge. */
const JUMP_PX = 30;

interface LightSample {
  at: number;
  isLit: boolean;
  /** Where the light's band stands, in px. */
  band: number;
  isCopy: boolean;
}

declare global {
  interface Window {
    lightSamples?: LightSample[];
  }
}

test("a link lights its headline from the first frame, and the light goes on as the page runs", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Every frame from the page's first: the headline on show, lit or not, and its band.
  await page.addInitScript((sampleMs) => {
    const samples: LightSample[] = [];
    window.lightSamples = samples;
    const sample = () => {
      const shown = [...document.querySelectorAll("h1")].find(
        (h1) => getComputedStyle(h1).display !== "none" && h1.getBoundingClientRect().height > 0,
      );
      if (shown) {
        const band = getComputedStyle(shown).backgroundPositionX.split(",")[0] ?? "0";
        samples.push({
          at: performance.now(),
          isLit: shown.classList.contains("words-lit"),
          band: band.endsWith("vw") ? (parseFloat(band) * innerWidth) / 100 : parseFloat(band),
          isCopy: shown.closest("[aria-hidden=true]") !== null,
        });
      }
      if (performance.now() < sampleMs) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, SAMPLE_MS);

  await page.goto("/day/kanazawa", { waitUntil: "commit" });
  await page.waitForFunction((sampleMs) => performance.now() > sampleMs, SAMPLE_MS, {
    timeout: SAMPLE_MS * 4,
  });
  const samples = await page.evaluate(() => window.lightSamples ?? []);

  // The first frame that shows the headline shows it lit: the first HTML's copy of the
  // playing's first frame waits for the model's words, as the page will.
  expect(samples[0]?.isLit).toBe(true);
  expect(samples[0]?.isCopy).toBe(true);
  // The page's own header takes over from the copy while the light runs, with no frame unlit
  // between them, and the light goes on from where it stood.
  const takenOver = samples.findIndex((sample) => sample.isLit && !sample.isCopy);
  expect(takenOver).toBeGreaterThan(0);
  expect(samples.slice(0, takenOver + 1).every((sample) => sample.isLit)).toBe(true);
  // No frame steps its band back, but its loop's wrap: from past the screen's middle to off
  // its left edge, where the band sets off again.
  const width = page.viewportSize()!.width;
  const steps = samples.flatMap((sample, at) => {
    const before = samples[at - 1];
    if (!before?.isLit || !sample.isLit) return [];
    const isWrap = before.band > width / 2 && sample.band < 0;
    return before.band - sample.band > JUMP_PX && !isWrap ? [before.band - sample.band] : [];
  });
  expect(steps).toEqual([]);
});
