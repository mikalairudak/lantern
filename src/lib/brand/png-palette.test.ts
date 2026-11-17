// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { themeColor, themeColorsOf } from "@/lib/tokens/theme-colors";
import { indexedPngOf, rgbImageOf, type RgbImage } from "./png-palette";

const COLORS = themeColorsOf(
  readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8"),
);
/** Two of the card's flat colours, by day. */
const GROUND = themeColor(COLORS, "ground", "light");
const LAMP = themeColor(COLORS, "lamp", "light");
const bytesOf = (hex: string): number[] =>
  [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const [toLeft, toUp, toUpLeft] = [left, up, upLeft].map((each) => Math.abs(estimate - each));
  if (toLeft! <= toUp! && toLeft! <= toUpLeft!) return left;
  return toUp! <= toUpLeft! ? up : upLeft;
}

/** A PNG of 8-bit RGBA, as the card's renderer writes one, each row under the next of the five filters. */
function rgbaPngOf(width: number, height: number, rgba: Uint8Array, colorType = 6): Uint8Array {
  const stride = width * 4;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const filter = row % 5;
    rows[row * (stride + 1)] = filter;
    for (let byte = 0; byte < stride; byte += 1) {
      const at = row * stride + byte;
      const left = byte >= 4 ? rgba[at - 4]! : 0;
      const up = row > 0 ? rgba[at - stride]! : 0;
      const upLeft = row > 0 && byte >= 4 ? rgba[at - stride - 4]! : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter]!;
      rows[row * (stride + 1) + 1 + byte] = (rgba[at]! - predicted) & 0xff;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, colorType, 0, 0, 0], 8);
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** An indexed PNG's pixels, read back through its palette. */
function pixelsOfIndexed(png: Uint8Array): { colorType: number; entries: number; rgb: number[] } {
  const buffer = Buffer.from(png);
  const chunks = new Map<string, Buffer>();
  for (let at = 8; at < buffer.length; at += 12 + buffer.readUInt32BE(at)) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("latin1", at + 4, at + 8);
    chunks.set(
      type,
      Buffer.concat([
        chunks.get(type) ?? Buffer.alloc(0),
        buffer.subarray(at + 8, at + 8 + length),
      ]),
    );
  }
  const header = chunks.get("IHDR")!;
  const width = header.readUInt32BE(0);
  const palette = chunks.get("PLTE")!;
  const rows = inflateSync(chunks.get("IDAT")!);
  const rgb: number[] = [];
  for (let at = 0; at < rows.length; at += width + 1) {
    expect(rows[at]).toBe(0);
    for (const index of rows.subarray(at + 1, at + 1 + width)) {
      rgb.push(...palette.subarray(index * 3, index * 3 + 3));
    }
  }
  return { colorType: header[9]!, entries: palette.length / 3, rgb };
}

/** A ramp of many greys between a ground and an ink, with flat runs of a few colours. */
function rampImage(width: number, height: number): RgbImage & { rgba: Uint8Array } {
  const rgba = new Uint8Array(width * height * 4);
  const rgb = new Uint8Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const x = pixel % width;
    const color =
      x < 8
        ? bytesOf(GROUND)
        : x < 12
          ? bytesOf(LAMP)
          : [x % 256, (x * 7) % 256, (pixel * 13) % 256];
    rgba.set([...color, 0xff], pixel * 4);
    rgb.set(color, pixel * 3);
  }
  return { width, height, rgb, rgba };
}

describe("an image read from the renderer's PNG", () => {
  it("reads every row back, whichever filter it was written under", () => {
    const { width, height, rgb, rgba } = rampImage(40, 10);
    expect(rgbImageOf(rgbaPngOf(width, height, rgba))).toEqual({ width, height, rgb });
  });

  it("refuses a file that is not a PNG, or not one it reads", () => {
    const { width, height, rgba } = rampImage(4, 2);
    expect(() => rgbImageOf(new Uint8Array(16))).toThrow("Not a PNG");
    expect(() => rgbImageOf(rgbaPngOf(width, height, rgba, 2))).toThrow("true colour with alpha");
  });

  it("refuses an image that is not opaque, since the card has a ground everywhere", () => {
    const { width, height, rgba } = rampImage(4, 2);
    rgba[3] = 0x80;
    expect(() => rgbImageOf(rgbaPngOf(width, height, rgba))).toThrow("not opaque");
  });
});

describe("an image in a palette of 256 colours", () => {
  it("keeps an image of few colours exactly", () => {
    const image = rampImage(12, 3);
    const { colorType, rgb } = pixelsOfIndexed(indexedPngOf(image, [GROUND]));
    expect(colorType).toBe(3);
    expect(rgb).toEqual([...image.rgb]);
  });

  it("keeps the colours it is given exactly, and shares the rest out closely", () => {
    const image = rampImage(600, 20);
    const { entries, rgb } = pixelsOfIndexed(indexedPngOf(image, [GROUND, LAMP]));
    expect(entries).toBeLessThanOrEqual(256);
    for (let pixel = 0; pixel < image.width * image.height; pixel += 1) {
      if (pixel % image.width < 12) {
        expect(rgb.slice(pixel * 3, pixel * 3 + 3)).toEqual([
          ...image.rgb.slice(pixel * 3, pixel * 3 + 3),
        ]);
      }
    }
    const error =
      rgb.reduce((sum, value, at) => sum + Math.abs(value - image.rgb[at]!), 0) / rgb.length;
    expect(error).toBeLessThan(12);
  });

  it("refuses a colour that is not #rrggbb", () => {
    expect(() => indexedPngOf(rampImage(2, 2), ["white"])).toThrow(
      '"white" is not a #rrggbb colour',
    );
  });
});
