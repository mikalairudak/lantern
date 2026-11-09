// Pointer-target scan (ui-review SKILL.md section 3, "Hands and keys"). Read-only: after the day
// is written it scrolls each interactive element into view (never clicks or types) and walks
// elementFromPoint down its horizontal centre, and along its vertical centre, in 0.25 px steps.
// The longest unbroken run that hits the element (or something inside it) is its effective
// target. Prints ONE compact JSON.
//
// Usage:
//   node .claude/skills/ui-review/tools/targets.cjs <url> [--width 390] [--theme light|dark]
//                                                   [--selector "<css>"] [--ms 20000]
// Example:
//   node .claude/skills/ui-review/tools/targets.cjs http://localhost:3000/day/bologna --width 390
//
// Output: scanned, minHeight (the least effective height), under24 (elements with height or
// width under 24 px: label, tag, height, width, as a pointer meets them), errors.
// Without --selector it scans a, button, input, select, textarea, summary and the roles
// button, link, slider, tab, checkbox, switch, radio, menuitem. Refuses lanternday.com.
const lib = require("./lib.cjs");

const STEP_PX = 0.25;
const MIN_TARGET_PX = 24;
const DEFAULT_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
].join(",");

/** In-page: the effective size of every matching element, as a pointer meets it. */
function scanTargets({ selector, step, limit }) {
  const results = [];
  const label = (el) =>
    (el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || el.id || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 36);
  const longestRun = (el, from, to, pointAt) => {
    let best = 0;
    let run = 0;
    for (let v = from; v < to; v += step) {
      const [x, y] = pointAt(v);
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) {
        run += step;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    return best;
  };
  const elements = [...document.querySelectorAll(selector)].filter((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    // pointer-events: none is a keyboard-only stop (the chart's sliders), not a pointer target.
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.pointerEvents !== "none" &&
      !el.disabled
    );
  });
  for (const el of elements.slice(0, limit)) {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const rect = el.getBoundingClientRect();
    const viewHeight = document.documentElement.clientHeight;
    const viewWidth = document.documentElement.clientWidth;
    const centreX = Math.min(Math.max(rect.left + rect.width / 2, 0), viewWidth - 0.01);
    const centreY = Math.min(Math.max(rect.top + rect.height / 2, 0), viewHeight - 0.01);
    const height = longestRun(
      el,
      Math.max(rect.top - 24, 0),
      Math.min(rect.bottom + 24, viewHeight),
      (v) => [centreX, v],
    );
    const width = longestRun(
      el,
      Math.max(rect.left - 24, 0),
      Math.min(rect.right + 24, viewWidth),
      (v) => [v, centreY],
    );
    results.push({
      label: label(el),
      tag: el.tagName.toLowerCase(),
      height: Math.round(height * 100) / 100,
      width: Math.round(width * 100) / 100,
    });
  }
  return { count: elements.length, results };
}

async function main() {
  const { positionals, flags } = lib.parseArgs(process.argv.slice(2), ["help"]);
  if (flags.help || process.argv.length < 3) lib.helpAndExit(__filename);
  const url = positionals[0];
  lib.checkUrl(url);
  const width = Number(flags.width ?? 390);
  const browser = await lib.chromium.launch();
  try {
    const { page, errors } = await lib.openPage(browser, {
      width,
      theme: flags.theme ?? "light",
      reduced: true,
    });
    await page.goto(url, { waitUntil: "load" });
    const isWritten = await lib.waitUntilWritten(page, Number(flags.ms ?? 20000));
    await page.waitForTimeout(500);
    const { count, results } = await page.evaluate(scanTargets, {
      selector: flags.selector ?? DEFAULT_SELECTOR,
      step: STEP_PX,
      limit: 400,
    });
    const under24 = results.filter((r) => r.height < MIN_TARGET_PX || r.width < MIN_TARGET_PX);
    console.log(
      JSON.stringify({
        url,
        width,
        isWritten,
        scanned: results.length,
        matched: count,
        minHeight: results.length ? Math.min(...results.map((r) => r.height)) : null,
        under24,
        errors: [...new Set(errors)].slice(0, 10),
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
