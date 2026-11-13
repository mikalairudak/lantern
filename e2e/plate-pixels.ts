import type { Page } from "@playwright/test";

/**
 * Pixels of the start screen's index, for the plates' specs: the page shot whole in its viewport,
 * and two shots compared in a page of their own, where only the counts come back.
 */

/** A box on the page, in CSS px from the viewport's corner. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A pixel differs when a channel is more than this many levels away (8 bits). */
export const DIFFERS_BY = 3;

/** What two shots of the same page differ by, where it matters. */
export interface Difference {
  /** The largest ΔE2000 in any box of `lines`. */
  linesDeltaE: number;
  /** Pixels that differ outside every box of `allowed`, and the box they stand in, in CSS px. */
  outside: number;
  outsideBox: Box | null;
  /** Pixels that differ in any box of `edges`. */
  atEdges: number;
  /** Pixels that differ anywhere, and the largest step in a channel. */
  differing: number;
  most: number;
}

/**
 * Makes the viewport as tall as the page, so every cell is on the screen at once: each asks for
 * its plate's files, a pointer can stay over any of them, and a shot needs no scroll.
 */
export async function showWholePage(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.locator("section:has(> ul) li").last().waitFor();
  // The page's height follows the viewport's where it fills the screen, so it is set until it holds.
  for (let tries = 0; tries < 4; tries += 1) {
    const height = await page.evaluate(() => document.scrollingElement!.scrollHeight);
    if (height === page.viewportSize()!.height) return;
    await page.setViewportSize({ width, height });
  }
}

/** Waits until every plate of the index has come in whole. */
export async function awaitPlates(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const lines = [...document.querySelectorAll('svg[data-picture] rect[data-layer="scene"]')];
    return lines.length > 0 && lines.every((rect) => rect.getAttribute("data-state") === "drawn");
  });
}

/** The index's words made transparent, so a shot holds only what lies under them. */
export async function hideWords(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "section:has(> ul) * { color: transparent !important; text-decoration-color: transparent !important; } nextjs-portal { display: none !important; }",
  });
}

/** Every line box of the index's words: its heading, each city's name and each of its notes. */
export async function lineBoxesOf(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const list = document.querySelector("section:has(> ul)")!;
    const words = [
      list.querySelector("h2")!,
      ...list.querySelectorAll("button > span:last-child > span"),
    ];
    return words.flatMap((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      return [...range.getClientRects()].map((rect) => {
        const middle = rect.top + rect.height / 2;
        return { x: rect.left, y: middle - lineHeight / 2, width: rect.width, height: lineHeight };
      });
    });
  });
}

/** Each drawn plate's cell, and the room its light may stand in: the cell's width, the picture's height. */
export async function plateBoxesOf(
  page: Page,
): Promise<{ slug: string; cell: Box; picture: Box }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("svg[data-picture]")].map((svg) => {
      const cell = svg.closest("button")!.getBoundingClientRect();
      const picture = svg.getBoundingClientRect();
      return {
        slug: svg.getAttribute("data-picture")!,
        cell: { x: cell.left, y: cell.top, width: cell.width, height: cell.height },
        picture: {
          x: cell.left,
          y: picture.top,
          width: cell.width,
          height: picture.height,
        },
      };
    }),
  );
}

/** The viewport, shot. */
export async function shotOf(page: Page): Promise<string> {
  return (await page.screenshot({ animations: "allow", caret: "initial" })).toString("base64");
}

/** Compares two shots of one page in `decoder`, a blank page of the same browser. */
export async function differenceOf(
  decoder: Page,
  first: string,
  second: string,
  scale: number,
  {
    lines = [],
    allowed = null,
    edges = [],
  }: { lines?: Box[]; allowed?: Box[] | null; edges?: Box[] },
): Promise<Difference> {
  return decoder.evaluate(
    async ({ first, second, scale, lines, allowed, edges, differsBy }) => {
      const pixelsOf = async (png: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return {
          data: context.getImageData(0, 0, image.width, image.height).data,
          width: image.width,
          height: image.height,
        };
      };
      const [a, b] = [await pixelsOf(first), await pixelsOf(second)];
      const width = Math.min(a.width, b.width);
      const height = Math.min(a.height, b.height);
      const lab = (r: number, g: number, bl: number) => {
        const linear = (v: number) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        const [R, G, B] = [linear(r), linear(g), linear(bl)];
        const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
        const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
        const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
        const f = (t: number) =>
          t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
        return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
      };
      const rad = (d: number) => (d * Math.PI) / 180;
      const deg = (r: number) => (r * 180) / Math.PI;
      const deltaE = ([l1, a1, b1]: number[], [l2, a2, b2]: number[]) => {
        const cMean = (Math.hypot(a1!, b1!) + Math.hypot(a2!, b2!)) / 2;
        const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
        const [a1p, a2p] = [(1 + g) * a1!, (1 + g) * a2!];
        const [c1, c2] = [Math.hypot(a1p, b1!), Math.hypot(a2p, b2!)];
        const hue = (p: number, q: number) => (deg(Math.atan2(q, p)) + 360) % 360;
        const [h1, h2] = [hue(a1p, b1!), hue(a2p, b2!)];
        let dh = c1 * c2 === 0 ? 0 : h2 - h1;
        if (dh > 180) dh -= 360;
        if (dh < -180) dh += 360;
        const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(rad(dh / 2));
        const lM = (l1! + l2!) / 2;
        const cM = (c1 + c2) / 2;
        let hM = h1 + h2;
        if (c1 * c2 !== 0) hM = Math.abs(h1 - h2) > 180 ? (h1 + h2 + 360) / 2 : (h1 + h2) / 2;
        const t =
          1 -
          0.17 * Math.cos(rad(hM - 30)) +
          0.24 * Math.cos(rad(2 * hM)) +
          0.32 * Math.cos(rad(3 * hM + 6)) -
          0.2 * Math.cos(rad(4 * hM - 63));
        const rot =
          -Math.sin(rad(60 * Math.exp(-(((hM - 275) / 25) ** 2)))) *
          2 *
          Math.sqrt(cM ** 7 / (cM ** 7 + 25 ** 7));
        const sl = 1 + (0.015 * (lM - 50) ** 2) / Math.sqrt(20 + (lM - 50) ** 2);
        const sc = 1 + 0.045 * cM;
        const sh = 1 + 0.015 * cM * t;
        const [dl, dc, dhh] = [(l2! - l1!) / sl, (c2 - c1) / sc, dH / sh];
        return Math.sqrt(dl ** 2 + dc ** 2 + dhh ** 2 + rot * dc * dhh);
      };
      const inside = (boxes: typeof lines, x: number, y: number) =>
        boxes.some(
          (box) =>
            x >= box.x * scale &&
            x < (box.x + box.width) * scale &&
            y >= box.y * scale &&
            y < (box.y + box.height) * scale,
        );
      let linesDeltaE = 0;
      let outside = 0;
      let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
      let atEdges = 0;
      let differing = 0;
      let most = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * a.width + x) * 4;
          const j = (y * b.width + x) * 4;
          const step = Math.max(
            Math.abs(a.data[i]! - b.data[j]!),
            Math.abs(a.data[i + 1]! - b.data[j + 1]!),
            Math.abs(a.data[i + 2]! - b.data[j + 2]!),
          );
          if (step === 0) continue;
          if (inside(lines, x, y)) {
            linesDeltaE = Math.max(
              linesDeltaE,
              deltaE(
                lab(a.data[i]!, a.data[i + 1]!, a.data[i + 2]!),
                lab(b.data[j]!, b.data[j + 1]!, b.data[j + 2]!),
              ),
            );
          }
          if (step <= differsBy) continue;
          differing += 1;
          most = Math.max(most, step);
          if (allowed !== null && !inside(allowed, x, y)) {
            outside += 1;
            [left, top] = [Math.min(left, x), Math.min(top, y)];
            [right, bottom] = [Math.max(right, x), Math.max(bottom, y)];
          }
          if (inside(edges, x, y)) atEdges += 1;
        }
      }
      const outsideBox =
        outside === 0
          ? null
          : {
              x: left / scale,
              y: top / scale,
              width: (right - left + 1) / scale,
              height: (bottom - top + 1) / scale,
            };
      return { linesDeltaE, outside, outsideBox, atEdges, differing, most };
    },
    { first, second, scale, lines, allowed, edges, differsBy: DIFFERS_BY },
  );
}

/** One frame Chromium painted, its time on the page's clock (ms since the epoch), as a PNG. */
export interface PaintedFrame {
  at: number;
  png: string;
}

/**
 * The radii of a plate's lit circles as each frame painted them, each dated as its frame's
 * callbacks ran, and when its cell was entered and left.
 */
export interface PlateLog {
  samples: { at: number; radii: number[] }[];
  /** Each time a pointer came onto the cell or left it, and the radii standing then. */
  entered: { at: number; radii: number[] }[];
  left: { at: number; radii: number[] }[];
}

/**
 * Starts logging one plate: after each frame is painted, the radius of each of its lit circles,
 * and each time a pointer comes onto its cell or leaves it, with the radii standing then, all on
 * the page's clock.
 */
export async function logPlate(page: Page, slug: string): Promise<void> {
  await page.evaluate((plate) => {
    const svg = document.querySelector(`svg[data-picture="${plate}"]`)!;
    const cell = svg.closest("button")!;
    const circles = [...svg.querySelectorAll('mask[id$="-whole"] circle')];
    const now = () => performance.timeOrigin + performance.now();
    const radii = () => circles.map((circle) => Number(circle.getAttribute("r")));
    type Moment = { at: number; radii: number[] };
    const log = { samples: [] as Moment[], entered: [] as Moment[], left: [] as Moment[] };
    (window as unknown as { plateLog: typeof log }).plateLog = log;
    // On the window, capturing, so the radii are read before the page's own handlers turn them.
    // Over: the pointer comes onto the target from the related target; out: it leaves the target
    // for the related target. Either crosses the cell's edge when only its target is in the cell.
    const isIn = (node: EventTarget | null) => node instanceof Node && cell.contains(node);
    const crossing = (event: PointerEvent) => {
      if (!isIn(event.target) || isIn(event.relatedTarget)) return;
      (event.type === "pointerover" ? log.entered : log.left).push({ at: now(), radii: radii() });
    };
    window.addEventListener("pointerover", crossing, true);
    window.addEventListener("pointerout", crossing, true);
    // Each frame is dated as its callbacks run, after the input it answers, and read once it
    // has been painted: a message posted in a frame's callbacks arrives after its paint.
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<number>) =>
      log.samples.push({ at: event.data, radii: radii() });
    const sample = () => {
      channel.port2.postMessage(now());
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, slug);
}

export async function plateLogOf(page: Page): Promise<PlateLog> {
  return page.evaluate(() => (window as unknown as { plateLog: PlateLog }).plateLog);
}

/** Films the page through Chromium's screencast while `act` runs, every frame it paints. */
export async function filmOf(page: Page, act: () => Promise<void>): Promise<PaintedFrame[]> {
  const session = await page.context().newCDPSession(page);
  const frames: PaintedFrame[] = [];
  session.on("Page.screencastFrame", (frame) => {
    frames.push({ at: (frame.metadata.timestamp ?? 0) * 1000, png: frame.data });
    session.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
  });
  await session.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  await act();
  await session.send("Page.stopScreencast");
  await session.detach();
  return frames;
}

/** For each frame, how much of a plate's light is there, measured on the pixels the light changes. */
export interface LightShare {
  at: number;
  /** Changed pixels that differ from the plate lit whole. */
  offWhole: number;
  /** Changed pixels back at rest, within a level or three. */
  atRest: number;
  /** The largest step from rest among the changed pixels. */
  mostFromRest: number;
}

/**
 * Measures each frame against the plate at rest and lit whole, inside `box` (CSS px at one device
 * pixel), on the pixels that differ between those two: how many there are, and per frame how many
 * still differ from the plate whole and how many are back at rest.
 */
export async function lightSharesOf(
  decoder: Page,
  rest: string,
  whole: string,
  frames: PaintedFrame[],
  box: Box,
): Promise<{ changed: number; shares: LightShare[] }> {
  return decoder.evaluate(
    async ({ rest, whole, frames, box, differsBy }) => {
      const pixelsOf = async (png: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = new OffscreenCanvas(box.width, box.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(image, -box.x, -box.y);
        return context.getImageData(0, 0, box.width, box.height).data;
      };
      const [atRest, atWhole] = [await pixelsOf(rest), await pixelsOf(whole)];
      const step = (a: Uint8ClampedArray, b: Uint8ClampedArray, i: number) =>
        Math.max(
          Math.abs(a[i]! - b[i]!),
          Math.abs(a[i + 1]! - b[i + 1]!),
          Math.abs(a[i + 2]! - b[i + 2]!),
        );
      const changed: number[] = [];
      for (let i = 0; i < atRest.length; i += 4)
        if (step(atRest, atWhole, i) > differsBy) changed.push(i);
      const shares = [];
      for (const frame of frames) {
        const pixels = await pixelsOf(frame.png);
        let offWhole = 0;
        let backAtRest = 0;
        let mostFromRest = 0;
        for (const i of changed) {
          if (step(pixels, atWhole, i) > differsBy) offWhole += 1;
          const fromRest = step(pixels, atRest, i);
          if (fromRest <= differsBy) backAtRest += 1;
          mostFromRest = Math.max(mostFromRest, fromRest);
        }
        shares.push({ at: frame.at, offWhole, atRest: backAtRest, mostFromRest });
      }
      return { changed: changed.length, shares };
    },
    {
      rest,
      whole,
      frames,
      box: {
        x: Math.floor(box.x),
        y: Math.floor(box.y),
        width: Math.ceil(box.width),
        height: Math.ceil(box.height),
      },
      differsBy: DIFFERS_BY,
    },
  );
}
