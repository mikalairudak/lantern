// Frame sampler for a day streaming in (ui-review SKILL.md section 3). Read-only: it opens a
// fresh context (no storage, so a written day plays), never types, and prints ONE compact JSON.
//
// Usage:
//   node .claude/skills/ui-review/tools/stream.cjs <url> [--width 390] [--theme light|dark]
//                                                  [--reduced] [--cpu 1|2|4] [--ms 20000]
// Example:
//   node .claude/skills/ui-review/tools/stream.cjs http://localhost:3000/day/bologna --width 390
//
// Output: headerSettledMs and firstRowMs (from first paint), worstPace {px per 60 Hz frame over
// a 100 ms window, row index, label, atMs}, dayGlides (frames in which the list itself moved),
// movedAfterWritten (rows that moved once the day was written), wordsOutside (text that left the
// viewport, after the day), errors (console errors, warnings and failed requests), timedOut.
// Refuses lanternday.com. Do not scroll or touch the page while it runs.
const lib = require("./lib.cjs");

const SETTLE_AFTER_WRITTEN_MS = 1500;
const WINDOW_MS = 100;
const MOVED_EPSILON_PX = 0.5;
const FRAME_MS = 1000 / 60;

/** In-page: starts sampling at document start; the result lands on window.__probe. */
function installSampler({ timeoutMs, settleMs, writtenSelector }) {
  const probe = { frames: [], done: false, paint: 0, writtenAt: null, timedOut: false, labels: [] };
  window.__probe = probe;
  const day = () => document.querySelector('ol[aria-label="The day"]');
  const rows = () => [...document.querySelectorAll('ol[aria-label="The day"] > li')];
  const isWritten = () =>
    document.querySelector(writtenSelector)?.getAttribute("aria-busy") === "false";
  const tick = () => {
    const now = performance.now();
    const dayTop = day()?.getBoundingClientRect().top ?? null;
    probe.frames.push({
      t: now,
      header: document.querySelector("header")?.getBoundingClientRect().height ?? 0,
      dayTop,
      tops: rows().map((li) => li.getBoundingClientRect().top - (dayTop ?? 0)),
    });
    if (probe.writtenAt === null && isWritten()) probe.writtenAt = now;
    probe.timedOut = probe.writtenAt === null && now > timeoutMs;
    if (probe.timedOut || (probe.writtenAt !== null && now - probe.writtenAt > settleMs)) {
      probe.paint = performance.getEntriesByName("first-paint")[0]?.startTime ?? 0;
      probe.labels = rows().map((li) =>
        (li.innerText || "").replace(/\s+/g, " ").trim().slice(0, 32),
      );
      probe.done = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The SKILL.md section 3 measures, from the sampled frames. */
function analyse(probe) {
  const { frames, paint, writtenAt, labels } = probe;
  const fromPaint = (t) => Math.round(t - paint);
  let headerSettled = null;
  let dayGlides = 0;
  for (let i = 1; i < frames.length; i++) {
    if (writtenAt !== null && frames[i].t > writtenAt) break;
    // A spring's sub-pixel tail is not the header still growing.
    if (Math.abs(frames[i].header - frames[i - 1].header) > MOVED_EPSILON_PX)
      headerSettled = frames[i].t;
    if (frames[i].dayTop !== frames[i - 1].dayTop) dayGlides += 1;
  }
  let worst = { px: 0, row: -1, at: 0 };
  const movedAfter = new Set();
  for (let i = 1; i < frames.length; i++) {
    let j = i - 1;
    while (j > 0 && frames[i].t - frames[j].t < WINDOW_MS) j--;
    const elapsed = (frames[i].t - frames[j].t) / FRAME_MS;
    const isAfter = writtenAt !== null && frames[i].t > writtenAt;
    frames[i].tops.forEach((top, row) => {
      const before = frames[j].tops[row];
      if (before === undefined || elapsed <= 0) return;
      if (isAfter) {
        if (Math.abs(top - before) > MOVED_EPSILON_PX) movedAfter.add(row);
        return;
      }
      const px = Math.abs(top - before) / elapsed;
      if (px > worst.px) worst = { px, row, at: frames[i].t };
    });
  }
  const firstRow = frames.find((frame) => frame.tops.length > 0);
  return {
    headerSettledMs: headerSettled === null ? null : fromPaint(headerSettled),
    firstRowMs: firstRow ? fromPaint(firstRow.t) : null,
    worstPace: {
      px: Math.round(worst.px * 100) / 100,
      row: worst.row,
      label: labels[worst.row] ?? null,
      atMs: worst.row === -1 ? null : fromPaint(worst.at),
    },
    dayGlides,
    movedAfterWritten: [...movedAfter],
    writtenAtMs: writtenAt === null ? null : fromPaint(writtenAt),
    frames: frames.length,
  };
}

async function main() {
  const { positionals, flags } = lib.parseArgs(process.argv.slice(2), ["reduced", "help"]);
  if (flags.help || process.argv.length < 3) lib.helpAndExit(__filename);
  const url = positionals[0];
  lib.checkUrl(url);
  const width = Number(flags.width ?? 390);
  const timeoutMs = Number(flags.ms ?? 20000);
  const cpu = Number(flags.cpu ?? 1);
  const browser = await lib.chromium.launch();
  try {
    const { page, errors } = await lib.openPage(browser, {
      width,
      theme: flags.theme ?? "light",
      reduced: Boolean(flags.reduced),
      cpu,
    });
    await page.addInitScript(installSampler, {
      timeoutMs,
      settleMs: SETTLE_AFTER_WRITTEN_MS,
      writtenSelector: lib.WRITTEN_SELECTOR,
    });
    await page.goto(url, { waitUntil: "commit" });
    await page.waitForFunction(() => window.__probe?.done === true, null, {
      timeout: timeoutMs + 15000,
      polling: 250,
    });
    const probe = await page.evaluate(() => window.__probe);
    const wordsOutside = await page.evaluate(lib.wordsOutsideViewport, 10);
    console.log(
      JSON.stringify({
        url,
        width,
        reduced: Boolean(flags.reduced),
        cpu,
        ...analyse(probe),
        timedOut: probe.timedOut,
        wordsOutside,
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
