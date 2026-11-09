import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BROWSER_STORAGE,
  BROWSER_STORAGE_KEYS,
  OWNER_BROWSER_STORAGE,
  browserStorageLine,
} from "./browser-storage";

const SRC = join(__dirname, "..");

/** Every source file of the app, its tests aside. */
function sourcesOf(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesOf(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** The files that read or write the browser's storage. */
const STORING = sourcesOf(SRC).filter((path) =>
  /\b(localStorage|sessionStorage)\b/.test(readFileSync(path, "utf8")),
);

/** A storage call with its key written in place. */
const KEY_IN_PLACE =
  /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g;
/** A key named as a constant of its own. */
const KEY_CONSTANT = /const [A-Z_]*KEY[A-Z_]* = ["'`][^"'`]+["'`]/g;

/** Keys a file uses that are not the catalog's: written in place, or named as its own. */
function straysIn(text: string, where: string): string[] {
  const strays: string[] = [];
  for (const [, key] of text.matchAll(KEY_IN_PLACE)) {
    if (!BROWSER_STORAGE_KEYS.includes(key ?? "")) strays.push(`${where}: "${key}"`);
  }
  for (const [line] of text.matchAll(KEY_CONSTANT)) strays.push(`${where}: ${line}`);
  return strays;
}

describe("what Lantern keeps in the browser", () => {
  it("names each key once, with what the privacy page says of it", () => {
    expect(new Set(BROWSER_STORAGE_KEYS).size).toBe(BROWSER_STORAGE_KEYS.length);
    for (const stored of Object.values(BROWSER_STORAGE)) {
      expect(stored.keeps.length).toBeGreaterThan(0);
    }
  });

  it("names the owner's mark beside the visitor's keys, and leaves it off the privacy page", () => {
    const visitorKeys = Object.values(BROWSER_STORAGE).map(({ key }) => key);
    for (const { key } of Object.values(OWNER_BROWSER_STORAGE)) {
      expect(BROWSER_STORAGE_KEYS).toContain(key);
      expect(visitorKeys).not.toContain(key);
    }
  });

  it("is read and written by keys from the catalog alone", () => {
    expect(STORING.length).toBeGreaterThan(0);
    const strays = STORING.flatMap((path) =>
      straysIn(readFileSync(path, "utf8"), relative(SRC, path)),
    );
    expect(strays).toEqual([]);
  });

  it("catches a key written in place, or named as a constant outside the catalog", () => {
    expect(straysIn('localStorage.setItem("lantern.other.v1", "1");', "a.ts")).toEqual([
      'a.ts: "lantern.other.v1"',
    ]);
    expect(straysIn('sessionStorage.getItem("lantern-theme");', "a.ts")).toEqual([]);
    expect(straysIn('export const OTHER_STORAGE_KEY = "lantern.other.v1";', "b.ts")).toEqual([
      'b.ts: const OTHER_STORAGE_KEY = "lantern.other.v1"',
    ]);
  });

  it("says on the privacy page every key it keeps, and which one leaves the browser", () => {
    const line = browserStorageLine();
    for (const stored of Object.values(BROWSER_STORAGE)) {
      expect(line).toContain(stored.keeps);
      if (stored.sent !== null) expect(line.toLowerCase()).toContain(stored.sent.toLowerCase());
    }
    expect(line).toContain("The rest never leaves your browser.");
  });
});
