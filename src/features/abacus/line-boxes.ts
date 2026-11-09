/** A line of words as laid out, in pixels from the top left of the box that holds them. */
export interface LineBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Two pieces of text are on one line when their boxes overlap this much of the shorter. */
const SAME_LINE_SHARE = 0.5;

function isSameLine(a: LineBox, b: LineBox): boolean {
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlap >= SAME_LINE_SHARE * Math.min(a.height, b.height);
}

function union(a: LineBox, b: LineBox): LineBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Pieces of text joined into one box per line: a name and its kind on one line are one
 * stretch of words, the gap between them included, so whatever passes under them steps back
 * once rather than twice. Pieces with no area are dropped.
 */
export function mergeLines(pieces: readonly LineBox[]): LineBox[] {
  return pieces
    .filter((piece) => piece.width > 0 && piece.height > 0)
    .reduce<LineBox[]>((lines, piece) => {
      const at = lines.findIndex((line) => isSameLine(line, piece));
      const line = lines[at];
      if (line === undefined) return [...lines, piece];
      return lines.map((each, index) => (index === at ? union(line, piece) : each));
    }, [])
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Where the lines of words inside an element sit, relative to it: one box per line, measured
 * from the text itself rather than the element, so the empty end of a short last line is not
 * counted. Empty where the browser cannot measure text, as in tests.
 */
export function lineBoxesOf(element: HTMLElement): LineBox[] {
  const origin = element.getBoundingClientRect();
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = element.ownerDocument.createRange();
  if (typeof range.getClientRects !== "function") return [];
  const pieces: LineBox[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      pieces.push({
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      });
    }
  }
  return mergeLines(pieces);
}

/** Whether two sets of lines are the same to half a pixel, so a remeasure can be ignored. */
export function isSameLines(a: readonly LineBox[], b: readonly LineBox[]): boolean {
  return (
    a.length === b.length &&
    a.every((line, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        Math.abs(line.x - other.x) < 0.5 &&
        Math.abs(line.y - other.y) < 0.5 &&
        Math.abs(line.width - other.width) < 0.5 &&
        Math.abs(line.height - other.height) < 0.5
      );
    })
  );
}
