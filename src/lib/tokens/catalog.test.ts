// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COLOR_TOKENS,
  DURATION_TOKENS,
  FOCUS_RING_TOKENS,
  RADIUS_TOKENS,
  ROOT_TOKENS,
  SPACING_TOKENS,
  TEXT_TOKENS,
} from "./catalog";

const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/** Token names declared in globals.css for one theme namespace, in source order. */
function declaredTokens(namespace: string): string[] {
  const declaration = new RegExp(`^\\s*--${namespace}-([a-z0-9_-]+):`, "gm");
  return (
    [...stylesheet.matchAll(declaration)]
      .map(([, name = ""]) => name)
      // `--text-body--line-height` and the like configure a token; they are not one.
      .filter((name) => !name.includes("--"))
      // Tailwind spells `0.5` as `0_5` in theme variables.
      .map((name) => name.replaceAll("_", "."))
  );
}

/** The focus rings globals.css defines as utilities, in source order. */
function declaredFocusRings(): string[] {
  return [...stylesheet.matchAll(/^@utility (focus-ring[a-z-]*) \{/gm)].map(
    ([, name = ""]) => name,
  );
}

describe("token catalog", () => {
  it.each([
    ["color", COLOR_TOKENS.map((token) => token.name)],
    ["text", TEXT_TOKENS],
    ["spacing", SPACING_TOKENS],
    ["radius", RADIUS_TOKENS],
    ["root", ROOT_TOKENS.map((token) => token.name)],
    ["duration", DURATION_TOKENS.map((token) => token.name)],
  ])("lists every %s token globals.css defines", (namespace, listed) => {
    expect(declaredTokens(namespace)).toEqual(listed);
  });

  it("lists every focus ring globals.css defines", () => {
    expect(declaredFocusRings()).toEqual(FOCUS_RING_TOKENS.map((token) => token.name));
  });
});
