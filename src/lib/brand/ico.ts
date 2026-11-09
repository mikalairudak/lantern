/**
 * An ICO file of PNG images, as every browser since Windows Vista's reads one: a header, one
 * entry per image, then the images themselves. `scripts/favicon.mts` writes the favicon with it.
 */

/** One image in the file, square, at most 256 px a side. */
export interface IcoImage {
  px: number;
  png: Uint8Array;
}

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;
/** The header's type for an icon, as against a cursor's 2. */
const ICON_TYPE = 1;
const PLANES = 1;
const BITS_PER_PIXEL = 32;
/** An entry says a side of 256 px as 0, since it has one byte for it. */
const LARGEST_PX = 256;

/** The images as one ICO file, each kept as the PNG it is. */
export function icoOf(images: readonly IcoImage[]): Uint8Array {
  if (images.length === 0) throw new Error("An ICO needs at least one image");
  const header = new DataView(new ArrayBuffer(HEADER_BYTES));
  header.setUint16(2, ICON_TYPE, true);
  header.setUint16(4, images.length, true);

  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;
  const entries = images.map(({ px, png }) => {
    if (!Number.isInteger(px) || px < 1 || px > LARGEST_PX) {
      throw new Error(`An ICO image is 1 to ${LARGEST_PX} px a side, not ${px}`);
    }
    const entry = new DataView(new ArrayBuffer(ENTRY_BYTES));
    entry.setUint8(0, px % LARGEST_PX);
    entry.setUint8(1, px % LARGEST_PX);
    entry.setUint16(4, PLANES, true);
    entry.setUint16(6, BITS_PER_PIXEL, true);
    entry.setUint32(8, png.byteLength, true);
    entry.setUint32(12, offset, true);
    offset += png.byteLength;
    return new Uint8Array(entry.buffer);
  });

  const parts = [new Uint8Array(header.buffer), ...entries, ...images.map(({ png }) => png)];
  const file = new Uint8Array(offset);
  let at = 0;
  for (const part of parts) {
    file.set(part, at);
    at += part.byteLength;
  }
  return file;
}

/** The side of each image an ICO file holds, in the order it lists them. */
export function icoSidesOf(file: Uint8Array): number[] {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const count = view.getUint16(4, true);
  return Array.from({ length: count }, (_, index) => {
    const side = view.getUint8(HEADER_BYTES + ENTRY_BYTES * index);
    return side === 0 ? LARGEST_PX : side;
  });
}
