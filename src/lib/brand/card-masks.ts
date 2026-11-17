/**
 * The grey files a link card draws its plates from. The page serves each plate's files as AVIF,
 * which the card's renderer cannot read, so the card reads a PNG of each, committed and written
 * from the AVIF by `scripts/card-masks.mts`, which is run again when a plate the card draws
 * changes. A PNG keeps its AVIF's name, hash included, so a plate drawn anew leaves the card
 * without its file until the script is run.
 */

/** Where the card's masks are committed, from the repository's root. */
export const CARD_MASKS_FOLDER = "assets/pictures";

const AVIF = /\.avif$/;

/** The card's mask for one of a plate's files: the same name, as a PNG. */
export function cardMaskOf(file: string): string {
  if (!AVIF.test(file)) throw new Error(`"${file}" is not a plate's AVIF file`);
  return file.replace(AVIF, ".png");
}

/** An image's size in px. */
export interface PixelSize {
  width: number;
  height: number;
}

/** A PNG's size, from its header chunk, which follows the 8-byte signature and the chunk's length and type. */
export function pngSizeOf(file: Uint8Array): PixelSize {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(12) !== 0x49484452) {
    throw new Error("Not a PNG");
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** The tag of an AVIF's image size box. */
const ISPE = [0x69, 0x73, 0x70, 0x65];

/**
 * An AVIF's size, from its image size box: the tag, the box's version and flags, then the width
 * and the height.
 */
export function avifSizeOf(file: Uint8Array): PixelSize {
  const at = file.findIndex((_, index) => ISPE.every((byte, step) => file[index + step] === byte));
  if (at < 0) throw new Error("Not an AVIF: it has no image size box");
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  return { width: view.getUint32(at + 8), height: view.getUint32(at + 12) };
}
