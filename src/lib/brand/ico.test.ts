// @vitest-environment node
import { describe, expect, it } from "vitest";
import { icoOf, icoSidesOf } from "./ico";

/** Stand-ins for PNGs: the file keeps each image's bytes as given, so any bytes will do. */
const IMAGES = [
  { px: 16, png: new Uint8Array([1, 2, 3]) },
  { px: 32, png: new Uint8Array([4, 5, 6, 7]) },
  { px: 48, png: new Uint8Array([8]) },
];

function viewOf(file: Uint8Array): DataView {
  return new DataView(file.buffer, file.byteOffset, file.byteLength);
}

describe("icoOf", () => {
  it("heads the file as an icon of as many images as it holds", () => {
    const view = viewOf(icoOf(IMAGES));

    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([
      0, 1, 3,
    ]);
  });

  it("lists each image's side, and where its bytes are, which follow the list in order", () => {
    const file = icoOf(IMAGES);
    const view = viewOf(file);

    expect(icoSidesOf(file)).toEqual([16, 32, 48]);
    for (const [index, { png }] of IMAGES.entries()) {
      const entry = 6 + 16 * index;
      const size = view.getUint32(entry + 8, true);
      const offset = view.getUint32(entry + 12, true);
      expect(file.slice(offset, offset + size)).toEqual(png);
    }
    expect(file.byteLength).toBe(6 + 16 * 3 + 3 + 4 + 1);
  });

  it("says a side of 256 px as the format does, 0, and reads it back", () => {
    const file = icoOf([{ px: 256, png: new Uint8Array([0]) }]);

    expect(viewOf(file).getUint8(6)).toBe(0);
    expect(icoSidesOf(file)).toEqual([256]);
  });

  it("refuses a file with no image, and a side the format cannot say", () => {
    expect(() => icoOf([])).toThrow("at least one image");
    expect(() => icoOf([{ px: 300, png: new Uint8Array([0]) }])).toThrow("not 300");
    expect(() => icoOf([{ px: 0, png: new Uint8Array([0]) }])).toThrow("not 0");
  });
});
