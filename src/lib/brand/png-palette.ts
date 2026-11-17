import { crc32, deflateSync, inflateSync } from "node:zlib";

/**
 * A full-colour PNG rewritten in a palette of at most 256 colours, with no dither, so the link
 * card weighs about half as much: a feed or a chat may drop a preview image that is too heavy.
 * The colours the card is flat in are kept exactly, as palette entries of their own; the rest,
 * the steps of the engravings' edges and the light's grain between them, are shared out by a
 * median cut.
 */

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PALETTE_SIZE = 256;
const RGBA = 4;
/** The PNG colour types read and written: true colour with alpha, and a palette's index. */
const TRUE_COLOR_ALPHA = 6;
const INDEXED = 3;

/** An opaque image's pixels, as red, green and blue, a byte each. */
export interface RgbImage {
  width: number;
  height: number;
  /** Three bytes a pixel, row by row. */
  rgb: Uint8Array;
}

/** A colour as `#rrggbb`. */
function rgbOf(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) throw new Error(`"${hex}" is not a #rrggbb colour`);
  return Number.parseInt(match[1] ?? "", 16);
}

const red = (color: number): number => (color >> 16) & 0xff;
const green = (color: number): number => (color >> 8) & 0xff;
const blue = (color: number): number => color & 0xff;

/** Each chunk of a PNG, by its type, its data in order. */
function chunksOf(png: Uint8Array): { type: string; data: Uint8Array }[] {
  if (!SIGNATURE.every((byte, index) => png[index] === byte)) throw new Error("Not a PNG");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: { type: string; data: Uint8Array }[] = [];
  for (let at = SIGNATURE.length; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    chunks.push({ type, data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return chunks;
}

/** The Paeth predictor, as the PNG specification gives it. */
function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** Undoes each row's filter in place, as the PNG specification gives them, and returns the rows. */
function unfiltered(data: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * RGBA;
  const rows = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = data[row * (stride + 1)] ?? 0;
    const source = row * (stride + 1) + 1;
    const at = row * stride;
    for (let byte = 0; byte < stride; byte += 1) {
      const raw = data[source + byte] ?? 0;
      const left = byte >= RGBA ? (rows[at + byte - RGBA] ?? 0) : 0;
      const up = row > 0 ? (rows[at + byte - stride] ?? 0) : 0;
      const upLeft = row > 0 && byte >= RGBA ? (rows[at + byte - stride - RGBA] ?? 0) : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (predicted === undefined) throw new Error(`Unknown PNG filter ${filter}`);
      rows[at + byte] = (raw + predicted) & 0xff;
    }
  }
  return rows;
}

/**
 * An opaque image from a PNG of 8-bit true colour with alpha, not interlaced, as the card's
 * renderer writes it. A pixel that is not opaque fails it: the card has a ground everywhere.
 */
export function rgbImageOf(png: Uint8Array): RgbImage {
  const chunks = chunksOf(png);
  const header = chunks.find(({ type }) => type === "IHDR")?.data;
  if (header === undefined) throw new Error("The PNG has no header");
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const [depth, colorType, , , interlace] = header.subarray(8);
  if (depth !== 8 || colorType !== TRUE_COLOR_ALPHA || interlace !== 0) {
    throw new Error("Only an 8-bit, non-interlaced PNG of true colour with alpha is read");
  }
  const data = inflateSync(
    Buffer.concat(chunks.filter(({ type }) => type === "IDAT").map(({ data }) => data)),
  );
  const rgba = unfiltered(data, width, height);
  const rgb = new Uint8Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (rgba[pixel * RGBA + 3] !== 0xff) throw new Error("The image is not opaque");
    rgb.set(rgba.subarray(pixel * RGBA, pixel * RGBA + 3), pixel * 3);
  }
  return { width, height, rgb };
}

/** A box of the colour space: its colours, how many pixels they stand for, and its widest channel. */
interface ColorBox {
  colors: number[];
  pixels: number;
  channel: (color: number) => number;
  range: number;
}

const CHANNELS = [red, green, blue];

/** A box of these colours, measured. */
function boxOf(colors: number[], histogram: Map<number, number>): ColorBox {
  const pixels = colors.reduce((sum, color) => sum + (histogram.get(color) ?? 0), 0);
  const widest = CHANNELS.map((channel) => {
    let low = 0xff;
    let high = 0;
    for (const color of colors) {
      low = Math.min(low, channel(color));
      high = Math.max(high, channel(color));
    }
    return { channel, range: high - low };
  }).reduce((wider, each) => (each.range > wider.range ? each : wider));
  return { colors, pixels, ...widest };
}

/**
 * How much a box asks to be split: its width, weighed by the square root of its pixels, so a
 * colour few pixels have, the bead's rim or a lantern's edge, still gets an entry near it, while
 * the many steps of the grain share theirs.
 */
const weightOf = ({ pixels, range }: ColorBox): number => Math.sqrt(pixels) * range;

/**
 * The palette for a histogram by median cut: the box that asks most to be split is split at its
 * pixels' median along its widest channel, until there are `size` boxes or none holds two
 * colours; each box's colour is its pixels' mean.
 */
function medianCutOf(histogram: Map<number, number>, size: number): number[] {
  if (histogram.size === 0 || size === 0) return [];
  const boxes: ColorBox[] = [boxOf([...histogram.keys()], histogram)];
  while (boxes.length < size) {
    const splittable = boxes.filter(({ colors }) => colors.length > 1);
    if (splittable.length === 0) break;
    const box = splittable.reduce((most, each) => (weightOf(each) > weightOf(most) ? each : most));
    box.colors.sort((a, b) => box.channel(a) - box.channel(b));
    let counted = 0;
    let cut = 1;
    for (; cut < box.colors.length - 1; cut += 1) {
      counted += histogram.get(box.colors[cut - 1] ?? 0) ?? 0;
      if (counted >= box.pixels / 2) break;
    }
    boxes.splice(
      boxes.indexOf(box),
      1,
      boxOf(box.colors.slice(0, cut), histogram),
      boxOf(box.colors.slice(cut), histogram),
    );
  }
  return boxes.map(({ colors, pixels }) => {
    const mean = (channel: (color: number) => number) =>
      Math.round(
        colors.reduce((sum, color) => sum + channel(color) * (histogram.get(color) ?? 0), 0) /
          pixels,
      );
    return (mean(red) << 16) | (mean(green) << 8) | mean(blue);
  });
}

/** The palette entry nearest a colour, by the squared distance in RGB. */
function nearestIn(palette: readonly number[], color: number): number {
  let best = 0;
  let bestDistance = Infinity;
  palette.forEach((entry, index) => {
    const distance =
      (red(entry) - red(color)) ** 2 +
      (green(entry) - green(color)) ** 2 +
      (blue(entry) - blue(color)) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(Buffer.from(type, "latin1"), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * The image as a PNG of palette indices, 8 bits a pixel, with `kept` among its entries exactly
 * and a median cut of its other colours for the rest of the 256.
 */
export function indexedPngOf(
  { width, height, rgb }: RgbImage,
  kept: readonly string[],
): Uint8Array<ArrayBuffer> {
  const keptColors = [...new Set(kept.map(rgbOf))];
  if (keptColors.length > PALETTE_SIZE) throw new Error("More colours kept than a palette holds");
  const histogram = new Map<number, number>();
  const colors = new Uint32Array(width * height);
  for (let pixel = 0; pixel < colors.length; pixel += 1) {
    const color =
      ((rgb[pixel * 3] ?? 0) << 16) | ((rgb[pixel * 3 + 1] ?? 0) << 8) | (rgb[pixel * 3 + 2] ?? 0);
    colors[pixel] = color;
    if (!keptColors.includes(color)) histogram.set(color, (histogram.get(color) ?? 0) + 1);
  }
  const palette = [...keptColors, ...medianCutOf(histogram, PALETTE_SIZE - keptColors.length)];
  const indexOf = new Map<number, number>();
  const rows = new Uint8Array((width + 1) * height);
  for (let pixel = 0; pixel < colors.length; pixel += 1) {
    const color = colors[pixel] ?? 0;
    let index = indexOf.get(color);
    if (index === undefined) {
      index = nearestIn(palette, color);
      indexOf.set(color, index);
    }
    // Each row starts with its filter, none.
    rows[Math.floor(pixel / width) * (width + 1) + 1 + (pixel % width)] = index;
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, INDEXED, 0, 0, 0], 8);
  const entries = new Uint8Array(palette.length * 3);
  palette.forEach((color, index) =>
    entries.set([red(color), green(color), blue(color)], index * 3),
  );
  return Uint8Array.from(
    Buffer.concat([
      SIGNATURE,
      chunk("IHDR", header),
      chunk("PLTE", entries),
      chunk("IDAT", deflateSync(rows, { level: 9 })),
      chunk("IEND", new Uint8Array(0)),
    ]),
  );
}
