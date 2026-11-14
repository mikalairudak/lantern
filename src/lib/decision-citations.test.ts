// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Comments and docs cite a decision by its heading, word for word, or by the first clause of a
 * long one (ARCHITECTURE.md, "Where decisions are recorded"). A heading reworded, or a citation
 * written from memory, sends a reader to an entry that is not there without a word, so every
 * quoted heading is held to the log by a test, as its Index is (`src/lib/decisions-index.test.ts`).
 */

const ROOT = join(__dirname, "..", "..");
const LOG = "docs/decisions.md";
/** This file, which quotes made-up headings to test how a citation is read. */
const THIS_FILE = "src/lib/decision-citations.test.ts";

/** The files whose words can cite the log. */
const CITING_FILE = /\.(ts|tsx|mts|md|css)$/;

/** An entry's sentence, its heading after the date: `## 2026-10-20 — Two-layer data contract`. */
const ENTRY_SENTENCE = /^## \d{4}-\d{2}-\d{2} — (.+)$/gm;

/** A line break and the next line's comment mark, `//` or ` * `, which a citation can wrap across. */
const LINE_BREAK = /\s*\n\s*(?:\/\/|\*(?!\/))?\s*/g;

/**
 * The log's name, an optional date, then one quoted heading or several, as in
 * `docs/decisions.md`, 2026-10-20, "Two-layer data contract" and "Field order is render order",
 * with or without a comma before the last one's "and".
 */
const CITATION =
  /decisions\.md`?,\s*(?:\d{4}-\d{2}-\d{2},\s*)?((?:"[^"]+"(?:,\s*(?:and\s+)?|\s+and\s+)?)+)/g;
const QUOTED = /"([^"]+)"/g;

/** What ends a heading's first clause. */
const CLAUSE_BREAK = /^[,;:]/;

/** Every heading a text quotes after the log's name, its comment lines joined. */
function citationsIn(text: string): string[] {
  const joined = text.replace(LINE_BREAK, " ");
  return [...joined.matchAll(CITATION)].flatMap(([, quotes = ""]) =>
    [...quotes.matchAll(QUOTED)].map(([, heading = ""]) => heading),
  );
}

/** Whether a quote is one entry's sentence, or the first clause of exactly one. */
function namesOneEntry(quote: string, sentences: readonly string[]): boolean {
  if (sentences.includes(quote)) return true;
  const startingWithIt = sentences.filter(
    (sentence) => sentence.startsWith(quote) && CLAUSE_BREAK.test(sentence.slice(quote.length)),
  );
  return startingWithIt.length === 1;
}

function trackedCitingFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((file) => CITING_FILE.test(file) && file !== LOG && file !== THIS_FILE)
    .filter((file) => existsSync(join(ROOT, file)));
}

const sentences = [...readFileSync(join(ROOT, LOG), "utf8").matchAll(ENTRY_SENTENCE)].map(
  ([, sentence = ""]) => sentence,
);
const citations = trackedCitingFiles().flatMap((file) =>
  citationsIn(readFileSync(join(ROOT, file), "utf8")).map((heading) => ({ file, heading })),
);

describe("the decision log's citations", () => {
  it("reads a heading wrapped across comment lines, after a date, and several in a row", () => {
    const text = [
      "/**",
      ' * As the log says (`docs/decisions.md`, "Two-layer data',
      ' * contract"), and (`docs/decisions.md`, 2026-10-20, "A" and "B").',
      " */",
      '// (`docs/decisions.md`, "C", "D"); `docs/decisions.md` alone quotes nothing.',
    ].join("\n");

    expect(citationsIn(text)).toEqual(["Two-layer data contract", "A", "B", "C", "D"]);
  });

  it("reads every heading of a list written with a comma before its last one", () => {
    const text = [
      '// (`docs/decisions.md`, "A", and "B"), and (`docs/decisions.md`, "C", "D", and "E");',
      '// a quote after the list\'s end, ", and "F"", is not read.',
    ].join("\n");

    expect(citationsIn(text)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("takes a whole heading or the first clause of one, never a clause two headings share", () => {
    const headings = [
      "The day is drawn as an abacus",
      "Sonnet writes the day, and Haiku writes it again",
      "A day is kept: for a link",
      "A day is kept: for a calendar",
    ];

    expect(namesOneEntry("The day is drawn as an abacus", headings)).toBe(true);
    expect(namesOneEntry("Sonnet writes the day", headings)).toBe(true);
    expect(namesOneEntry("The day is drawn", headings)).toBe(false);
    expect(namesOneEntry("A day is kept", headings)).toBe(false);
  });

  it("reads the log's entries and the tree's citations, so the check is not reading nothing", () => {
    expect(sentences.length).toBeGreaterThan(30);
    expect(citations.length).toBeGreaterThan(100);
  });

  it("finds every quoted heading in the log", () => {
    const missing = citations
      .filter(({ heading }) => !namesOneEntry(heading, sentences))
      .map(({ file, heading }) => `${file}: "${heading}"`);

    expect(missing).toEqual([]);
  });
});
