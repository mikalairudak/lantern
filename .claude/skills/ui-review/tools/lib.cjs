// Shared helpers for the ui-review probes: arguments, the repo's chromium, a context set up
// the way the app keeps its theme and view, and the in-page scans several probes share.
// Not a command; run stream.cjs, targets.cjs, overflow.cjs or shot.cjs.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const requireFromRepo = createRequire(path.resolve(__dirname, "../../../../package.json"));
const { chromium } = requireFromRepo("@playwright/test");

const PHONE_HEIGHT = 844;
const LAPTOP_HEIGHT = 900;
const PHONE_MAX_WIDTH = 800;
const WRITTEN_SELECTOR = '[role="group"][aria-label^="The day\'s energy"]';

/** Splits argv into positionals and --flags (a flag takes the next word unless it is boolean). */
function parseArgs(argv, booleans = []) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i];
    if (!word.startsWith("--")) positionals.push(word);
    else if (booleans.includes(word.slice(2))) flags[word.slice(2)] = true;
    else flags[word.slice(2)] = argv[++i];
  }
  return { positionals, flags };
}

/** Prints the usage comment at the top of a script and exits. */
function helpAndExit(scriptFile) {
  const lines = [];
  for (const line of fs.readFileSync(scriptFile, "utf8").split("\n")) {
    if (!line.startsWith("//")) break;
    lines.push(line.replace(/^\/\/ ?/, ""));
  }
  console.log(lines.join("\n"));
  process.exit(0);
}

/** Refuses production, and anything that is not an http(s) URL. */
function checkUrl(url) {
  if (!url) throw new Error("missing <url>; see --help");
  const parsed = new URL(url);
  if (/(^|\.)lanternday\.com$/i.test(parsed.hostname)) {
    throw new Error("refusing to open production (lanternday.com); use a dev server");
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("only http(s) URLs");
}

/** A fresh context: no storage, the app's own theme and view keys set before load. */
async function openPage(browser, { width, theme, view, reduced, cpu }) {
  const context = await browser.newContext({
    viewport: { width, height: width < PHONE_MAX_WIDTH ? PHONE_HEIGHT : LAPTOP_HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await context.addInitScript(
    ({ theme, view }) => {
      try {
        if (theme) localStorage.setItem("lantern-theme", theme);
        if (view === "read") localStorage.setItem("lantern-day-view", "read");
      } catch {
        // Storage can be blocked; the page then keeps its defaults.
      }
    },
    { theme, view },
  );
  const page = await context.newPage();
  if (cpu && cpu > 1) {
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  }
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error.message).slice(0, 160)));
  page.on("console", (message) => {
    // The reduced-motion notice is the probe's own doing, not the page's.
    if (message.text().includes("Reduced Motion enabled")) return;
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${message.type()}: ${message.text().slice(0, 160)}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url().slice(0, 120)}`);
  });
  return { context, page, errors };
}

/** Resolves true once the day's energy group is no longer busy, false after timeoutMs. */
async function waitUntilWritten(page, timeoutMs) {
  try {
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.getAttribute("aria-busy") === "false",
      WRITTEN_SELECTOR,
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * In-page: text that leaves the viewport sideways. A word is a text node's line box
 * (Range rects), skipping hidden elements; returns up to `limit` offenders.
 */
function wordsOutsideViewport(limit) {
  const viewport = document.documentElement.clientWidth;
  const found = [];
  // Text only a screen reader hears, as an `sr-only` box's: clipped to nothing, or a pixel's
  // box that hides what overflows it, so its words never reach the screen wherever they lie.
  const isClippedAway = (element) => {
    for (let box = element; box; box = box.parentElement) {
      if (box.classList.contains("sr-only")) return true;
      const style = getComputedStyle(box);
      if (style.clip !== "" && style.clip !== "auto") return true;
      if (style.clipPath.startsWith("inset(50%")) return true;
      const rect = box.getBoundingClientRect();
      if (style.overflow === "hidden" && rect.width <= 1 && rect.height <= 1) return true;
    }
    return false;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && found.length < limit; node = walker.nextNode()) {
    const text = node.textContent.trim();
    const element = node.parentElement;
    if (!text || !element || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0")
      continue;
    if (isClippedAway(element)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.left < -0.5 || rect.right > viewport + 0.5) {
        found.push({
          text: text.slice(0, 40),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          tag: element.tagName.toLowerCase(),
        });
        break;
      }
    }
  }
  return found;
}

module.exports = {
  chromium,
  parseArgs,
  helpAndExit,
  checkUrl,
  openPage,
  waitUntilWritten,
  wordsOutsideViewport,
  WRITTEN_SELECTOR,
};
