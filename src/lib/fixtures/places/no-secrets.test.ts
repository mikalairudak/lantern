// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every fixture, recorded or written by hand, wherever under this folder it sits. */
const FIXTURES = "src/lib/fixtures";
/** This file, which has to spell out what it looks for. */
const THIS_FILE = join(FIXTURES, "places", "no-secrets.test.ts");

/**
 * A key by name, a key as a query parameter, any URL with a query string, or a bare token of
 * 32 hex digits, the shape of a Geoapify key.
 */
const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /key=/i,
  /https?:\/\/[^\s"'`]*\?/i,
  /(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/i,
];

function fixtureFiles(): string[] {
  return readdirSync(FIXTURES, { recursive: true, encoding: "utf8" })
    .map((file) => join(FIXTURES, file))
    .filter((file) => statSync(file).isFile() && file !== THIS_FILE);
}

describe("the fixtures", () => {
  it("are read in every folder", () => {
    expect(fixtureFiles()).toEqual(
      expect.arrayContaining([
        "src/lib/fixtures/places/coverage-run.ts",
        "src/lib/fixtures/intake/places.ts",
        "src/lib/fixtures/curated/kyoto.ts",
        "src/lib/fixtures/edge/minimal.ts",
        "src/lib/fixtures/city-readings.ts",
      ]),
    );
  });

  it.each(fixtureFiles())("%s carries no key and no URL with a query", (file) => {
    const text = readFileSync(file, "utf8");
    for (const pattern of SECRET_PATTERNS) expect(text).not.toMatch(pattern);
  });

  it.each([
    '{ "url": "https://api.geoapify.com/v1/geocode/search?text=Lisbon&apiKey=abc" }',
    "GEOAPIFY_API_KEY=abc",
    'const token = "0123456789abcdef0123456789ABCDEF";',
  ])("would catch a key left in a recording: %s", (leaked) => {
    expect(SECRET_PATTERNS.some((pattern) => pattern.test(leaked))).toBe(true);
  });

  it("takes a commit hash or a longer id for no key", () => {
    const hash = "0b21854f3c9a2e7d1b6c4a8f9e0d2c3b4a5f6e7d";
    expect(SECRET_PATTERNS.some((pattern) => pattern.test(hash))).toBe(false);
  });
});
