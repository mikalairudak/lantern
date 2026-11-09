// Sideways overflow (ui-review SKILL.md section 3, "No word leaves the screen"). Read-only: for
// each width it opens a fresh context, waits for the day to be written, and compares the page's
// scrollWidth with the viewport and every text box with the viewport's edges. Prints ONE JSON.
//
// Usage:
//   node .claude/skills/ui-review/tools/overflow.cjs <url> [--widths 360,390,1440]
//                                                    [--theme light|dark] [--ms 20000]
// Example:
//   node .claude/skills/ui-review/tools/overflow.cjs http://localhost:3000/day/bologna
//
// Output: per width {width, scrollWidth, viewport, isOverflowing, wordsOutside: [{text, left,
// right, tag}] (up to 10)}, errors. Refuses lanternday.com.
const lib = require("./lib.cjs");

const DEFAULT_WIDTHS = "360,390,1440";
const OVERFLOW_TOLERANCE_PX = 0.5;

async function measureWidth(browser, url, width, flags) {
  const { page, errors } = await lib.openPage(browser, {
    width,
    theme: flags.theme ?? "light",
    reduced: true,
  });
  await page.goto(url, { waitUntil: "load" });
  await lib.waitUntilWritten(page, Number(flags.ms ?? 20000));
  await page.waitForTimeout(500);
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  const wordsOutside = await page.evaluate(lib.wordsOutsideViewport, 10);
  await page.context().close();
  return {
    width,
    ...sizes,
    isOverflowing: sizes.scrollWidth > sizes.viewport + OVERFLOW_TOLERANCE_PX,
    wordsOutside,
    errors,
  };
}

async function main() {
  const { positionals, flags } = lib.parseArgs(process.argv.slice(2), ["help"]);
  if (flags.help || process.argv.length < 3) lib.helpAndExit(__filename);
  const url = positionals[0];
  lib.checkUrl(url);
  const widths = (flags.widths ?? DEFAULT_WIDTHS).split(",").map(Number);
  const browser = await lib.chromium.launch();
  try {
    const perWidth = [];
    for (const width of widths) perWidth.push(await measureWidth(browser, url, width, flags));
    const errors = [...new Set(perWidth.flatMap((entry) => entry.errors))].slice(0, 10);
    console.log(
      JSON.stringify({
        url,
        widths: perWidth.map(({ errors: _errors, ...entry }) => entry),
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
