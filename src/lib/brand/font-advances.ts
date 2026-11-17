/**
 * What a TrueType file says of its letters' widths and its line box, read from its own tables,
 * so the link card can be laid out before it is drawn. The card's renderer does not kern, so a
 * row is as wide as the sum of its letters' advances.
 */

/** A font's measures at a size, in px. */
export interface FontMeasures {
  /** A row's width at a size: the sum of its letters' advances. Fails on a letter the file lacks. */
  widthOf: (text: string, size: number) => number;
  /** Where a row's baseline stands under the top of its line box, as a share of its size, at a line height. */
  baselineShareAt: (lineHeight: number) => number;
}

/** Where each table starts in the file, by its tag. */
function tablesOf(view: DataView): Map<string, number> {
  const tables = new Map<string, number>();
  const count = view.getUint16(4);
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(
      view.getUint8(record),
      view.getUint8(record + 1),
      view.getUint8(record + 2),
      view.getUint8(record + 3),
    );
    tables.set(tag, view.getUint32(record + 8));
  }
  return tables;
}

function tableAt(tables: Map<string, number>, tag: string): number {
  const offset = tables.get(tag);
  if (offset === undefined) throw new Error(`The font has no ${tag} table`);
  return offset;
}

/** The glyph of a code point, by the cmap's segment-mapped subtable (format 4); 0 where it has none. */
function glyphReaderOf(view: DataView, cmap: number): (code: number) => number {
  const subtables = view.getUint16(cmap + 2);
  let format4: number | null = null;
  for (let index = 0; index < subtables && format4 === null; index += 1) {
    const offset = cmap + view.getUint32(cmap + 4 + index * 8 + 4);
    if (view.getUint16(offset) === 4) format4 = offset;
  }
  if (format4 === null) throw new Error("The font has no format 4 cmap subtable");
  const segments = view.getUint16(format4 + 6) / 2;
  const ends = format4 + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  return (code) => {
    for (let segment = 0; segment < segments; segment += 1) {
      if (code > view.getUint16(ends + segment * 2)) continue;
      const start = view.getUint16(starts + segment * 2);
      if (code < start) return 0;
      const delta = view.getInt16(deltas + segment * 2);
      const range = view.getUint16(ranges + segment * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const glyph = view.getUint16(ranges + segment * 2 + range + (code - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/** A TrueType file's measures. */
export function fontMeasuresOf(file: Uint8Array): FontMeasures {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const tables = tablesOf(view);
  const unitsPerEm = view.getUint16(tableAt(tables, "head") + 18);
  const hhea = tableAt(tables, "hhea");
  const ascent = view.getInt16(hhea + 4);
  const descent = view.getInt16(hhea + 6);
  const advances = view.getUint16(hhea + 34);
  const hmtx = tableAt(tables, "hmtx");
  const glyphOf = glyphReaderOf(view, tableAt(tables, "cmap"));
  const advanceOf = (glyph: number): number =>
    view.getUint16(hmtx + Math.min(glyph, advances - 1) * 4);

  return {
    widthOf: (text, size) => {
      let units = 0;
      for (const letter of text) {
        const glyph = glyphOf(letter.codePointAt(0) ?? 0);
        if (glyph === 0) throw new Error(`The font has no glyph for "${letter}"`);
        units += advanceOf(glyph);
      }
      return (units / unitsPerEm) * size;
    },
    // The face stands in the middle of its line box, the leading shared over and under it.
    baselineShareAt: (lineHeight) =>
      (lineHeight - (ascent - descent) / unitsPerEm) / 2 + ascent / unitsPerEm,
  };
}
