// One viewport screenshot at css scale, for evidence of a finding only (never full-page).
// Read-only: it opens a fresh context, waits, and saves a PNG.
//
// Usage:
//   node .claude/skills/ui-review/tools/shot.cjs <url> <out.png> [--width 390]
//                                                [--theme light|dark] [--view read]
//                                                [--wait 1500] [--reduced]
// Example:
//   node .claude/skills/ui-review/tools/shot.cjs http://localhost:3000/day/bologna \
//     .playwright-mcp/bologna-390.png --width 390 --theme dark --wait 12000
//
// --wait is milliseconds after load before the shot (default 1500); --view read opens the day
// as a list. Prints one line of JSON with the path. Refuses lanternday.com.
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./lib.cjs");

const DEFAULT_WAIT_MS = 1500;

async function main() {
  const { positionals, flags } = lib.parseArgs(process.argv.slice(2), ["reduced", "help"]);
  if (flags.help || process.argv.length < 3) lib.helpAndExit(__filename);
  const [url, out] = positionals;
  lib.checkUrl(url);
  if (!out) throw new Error("missing <out.png>; see --help");
  const width = Number(flags.width ?? 390);
  const browser = await lib.chromium.launch();
  try {
    const { page } = await lib.openPage(browser, {
      width,
      theme: flags.theme ?? "light",
      view: flags.view,
      reduced: Boolean(flags.reduced),
    });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(Number(flags.wait ?? DEFAULT_WAIT_MS));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await page.screenshot({ path: out, scale: "css", fullPage: false });
    console.log(JSON.stringify({ shot: path.resolve(out), width, theme: flags.theme ?? "light" }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
