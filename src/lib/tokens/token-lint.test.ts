// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// ESLint loads Tailwind's design system on first use, which takes a few seconds.
const LINT_TIMEOUT_MS = 30_000;
const PROBE_PATH = "src/features/probe/probe.tsx";

const eslint = new ESLint();

/** Rule ids ESLint reports for `code`, linted as if it were a feature component. */
async function reportedRules(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: PROBE_PATH });
  return (result?.messages ?? []).map((message) => message.ruleId ?? message.message);
}

function componentWithClasses(className: string): string {
  return `export const Probe = () => <p className="${className}">Text</p>;\n`;
}

describe("token lint", { timeout: LINT_TIMEOUT_MS }, () => {
  it("accepts classes built from tokens", async () => {
    const className = "mx-auto max-w-page px-6 font-serif text-display text-ink md:p-4";

    expect(await reportedRules(componentWithClasses(className))).toEqual([]);
  });

  it.each([
    ["a text size outside the type scale", "text-sm", "better-tailwindcss/no-unknown-classes"],
    ["a color outside the palette", "bg-red-500", "better-tailwindcss/no-unknown-classes"],
    ["spacing off the grid", "p-7", "better-tailwindcss/no-unknown-classes"],
    ["an arbitrary value", "text-[13px]", "better-tailwindcss/no-restricted-classes"],
    ["a CSS variable shorthand", "bg-(--color-ink)", "better-tailwindcss/no-restricted-classes"],
    ["a per-class duration", "duration-200", "better-tailwindcss/no-restricted-classes"],
    ["a per-class dark override", "dark:bg-ground", "better-tailwindcss/no-restricted-classes"],
    [
      "a removed focus outline",
      "focus-visible:outline-none",
      "better-tailwindcss/no-restricted-classes",
    ],
  ])("rejects %s", async (_name, className, rule) => {
    expect(await reportedRules(componentWithClasses(className))).toEqual([rule]);
  });

  it.each([
    [
      "a constant named for classes",
      'const BADGE_CLASSES = { sm: "p-7" };\nexport const Badge = () => <p className={BADGE_CLASSES.sm}>Text</p>;\n',
    ],
    [
      "a className key in an object",
      'export const items = [{ label: "Text", className: "p-7" }];\n',
    ],
  ])("checks classes kept in %s", async (_name, code) => {
    expect(await reportedRules(code)).toEqual(["better-tailwindcss/no-unknown-classes"]);
  });

  it.each([
    [
      "a literal value in an inline style",
      "export const P = () => <p style={{ padding: 7 }}>Text</p>;\n",
    ],
    // eslint-disable-next-line no-restricted-syntax -- the probe needs a raw color to prove lint rejects it
    ["a color function in code", 'export const accent = "oklch(0.5 0.1 200)";\n'],
    ["a raw hex color in code", 'export const accent = "#c0ffee";\n'],
  ])("rejects %s", async (_name, code) => {
    expect(await reportedRules(code)).toEqual(["no-restricted-syntax"]);
  });

  it("accepts a number sign in ordinary text", async () => {
    expect(await reportedRules('export const label = "Order #1042";\n')).toEqual([]);
  });

  it("rejects CSS imports outside the root layout", async () => {
    expect(await reportedRules('import "./probe.css";\n')).toEqual(["no-restricted-imports"]);
  });
});

interface Report {
  ruleId: string | null;
  message: string;
}

/**
 * What lint reports of `code`, linted as the module at `filePath`. Every layer shares one rule,
 * so a report is told apart by its message.
 */
async function reportsAt(filePath: string, code: string): Promise<Report[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map(({ ruleId, message }) => ({ ruleId, message }));
}

function importing(specifier: string): string {
  return `import { probe } from "${specifier}";\nexport const used = probe;\n`;
}

const ROUTE_MESSAGE = "Nothing outside src/app imports a route or a page";
const EVAL_MESSAGE = "Only src/eval itself, scripts and tests import the paid eval";
const FEATURE_MESSAGE = "The features build on this layer, so it imports none of them";
const TOKENS_MESSAGE = "The primitives build on the design tokens alone";

describe("layer lint", { timeout: LINT_TIMEOUT_MS }, () => {
  it.each([
    [
      "a route into a feature",
      "src/features/probe/probe.tsx",
      "@/app/api/day/route",
      ROUTE_MESSAGE,
    ],
    ["a route into the library", "src/lib/probe/probe.ts", "@/app/api/day/route", ROUTE_MESSAGE],
    ["the paid eval into a feature", "src/features/probe/probe.tsx", "@/eval/round", EVAL_MESSAGE],
    ["the paid eval into a page", "src/app/probe/page.tsx", "@/eval/round", EVAL_MESSAGE],
    ["the paid eval into the lab", "src/app/lab/probe/page.tsx", "@/eval/round", EVAL_MESSAGE],
    ["the paid eval into the library", "src/lib/probe/probe.ts", "@/eval/round", EVAL_MESSAGE],
    [
      "a feature into the library",
      "src/lib/probe/probe.ts",
      "@/features/day/facts",
      FEATURE_MESSAGE,
    ],
    [
      "a feature into a live module",
      "src/lib/live/probe.ts",
      "@/features/day/facts",
      FEATURE_MESSAGE,
    ],
    [
      "a feature by a relative path",
      "src/lib/probe/probe.ts",
      "../../features/day/facts",
      FEATURE_MESSAGE,
    ],
    ["a route into the paid eval", "src/eval/probe.ts", "@/app/api/day/route", ROUTE_MESSAGE],
    [
      "a feature into a primitive",
      "src/components/ui/probe.tsx",
      "@/features/day/link-classes",
      FEATURE_MESSAGE,
    ],
    [
      "the library into a primitive",
      "src/components/ui/probe.tsx",
      "@/lib/time/clock",
      TOKENS_MESSAGE,
    ],
    [
      "the stream reader into the root layout",
      "src/app/layout.tsx",
      "@/lib/stream/read-day-stream",
      "Play days through useDayStream",
    ],
  ])("rejects an import of %s", async (_name, filePath, specifier, message) => {
    expect(await reportsAt(filePath, importing(specifier))).toEqual([
      { ruleId: "no-restricted-imports", message: expect.stringContaining(message) },
    ]);
  });

  it.each([
    ["a feature into a page", "src/app/probe/page.tsx", "@/features/day/facts"],
    ["a feature into another", "src/features/probe/probe.tsx", "@/features/day/facts"],
    ["the tokens into a primitive", "src/components/ui/probe.tsx", "@/lib/tokens/motion"],
    ["a route into a test", "src/lib/probe/probe.test.ts", "@/app/api/day/route"],
    ["the paid eval into a test", "src/lib/probe/probe.test.ts", "@/eval/round"],
    ["a feature into a test", "src/lib/probe/probe.test.ts", "@/features/day/facts"],
    ["a feature into the paid eval", "src/eval/probe.ts", "@/features/abacus/replan-frame"],
    ["the stylesheet into the root layout", "src/app/layout.tsx", "./globals.css"],
  ])("accepts an import of %s", async (_name, filePath, specifier) => {
    expect(await reportsAt(filePath, importing(specifier))).toEqual([]);
  });
});
