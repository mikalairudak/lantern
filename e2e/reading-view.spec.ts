import { expect, test, type Locator, type Page, waitMs } from "./fixtures";
import { logStatuses } from "./status-log";
import { BROWSER_STORAGE } from "../src/lib/browser-storage";
import { NOTICE_HEARD_MS } from "../src/features/day/notice-status";
import type { StoredDay } from "../src/lib/days/stored-day";
import { writtenVersionOf } from "../src/lib/days/written/version";
import { writtenDayAt } from "../src/lib/days/written/days";
import { candidatesOf, keyStepOf } from "../src/features/abacus/curve";
import { KYOTO_REQUEST } from "../src/lib/fixtures/curated/requests";
import { KYOTO_ITINERARY } from "../src/lib/fixtures/replan/kyoto-morning";

// The view a visitor chose holds on this device wherever a day is shown (`docs/decisions.md`,
// "A day can be read as a list, written as the chart is"): after a reload, on another city's
// day, on a re-planned day and on a kept day's page.

const DAY_TIMEOUT_MS = waitMs(30_000);
const ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
/** A visitor's Kyoto day, kept in the log: no day the site has written. */
const WRITTEN: StoredDay = {
  status: "written",
  request: KYOTO_REQUEST,
  itinerary: KYOTO_ITINERARY,
  checks: {},
  writtenAt: "2026-10-31T20:00:00.000Z",
  seconds: 46,
  round: 0,
};

test.use({ reducedMotion: "reduce" });

type View = "Chart" | "Plan";

/** What shows the day in a view: the chart, or its plan; the styles show one. */
function viewOf(page: Page, view: View) {
  return view === "Plan"
    ? page.getByRole("list", { name: "The day, to read" })
    : page.getByRole("group", { name: /The day's energy/ });
}

/** The day on screen is written whole: its chart, seen or not, is still. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/**
 * The page has played its day for a visitor who has not seen it: its first HTML holds the
 * day whole, list and all, until the page's script plays it from its empty frame.
 */
async function waitForThePlaying(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-day-seen"), null, {
    timeout: DAY_TIMEOUT_MS,
  });
}

/** The day is shown in this view, and the other is not on the page's face. */
async function expectTheView(page: Page, view: View): Promise<void> {
  const other: View = view === "Plan" ? "Chart" : "Plan";
  await expect(viewOf(page, view)).toBeVisible({ timeout: DAY_TIMEOUT_MS });
  await expect(viewOf(page, other)).toBeHidden();
  await expect(
    page.getByRole("group", { name: "View" }).getByRole("button", { name: view }),
  ).toHaveAttribute("aria-pressed", "true");
}

for (const view of ["Plan", "Chart"] as const) {
  test(`${view}, once chosen, holds after a reload, on another city, a re-planned day and a kept day's page`, async ({
    page,
  }) => {
    // Five days played, Kanazawa's twice, each at the landing's pace.
    test.setTimeout(5 * DAY_TIMEOUT_MS);
    // The other view was the visitor's before, so choosing this one changes something.
    const before = view === "Plan" ? "chart" : "read";
    await page.addInitScript(
      ([key, value]) => {
        if (sessionStorage.getItem("chosen") === null) localStorage.setItem(key!, value!);
        sessionStorage.setItem("chosen", "yes");
      },
      ["lantern-day-view", before],
    );
    await page.goto("/day/kanazawa");
    await waitForTheDay(page);
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: view }).click();
    await expectTheView(page, view);

    await page.reload();
    await waitForTheDay(page);
    await expectTheView(page, view);

    // Another city's day, from the city word.
    const headline = page.getByRole("heading", { level: 1 });
    await headline.getByRole("button", { name: "Kanazawa", exact: true }).click();
    await page.getByRole("button", { name: /^Bologna/ }).click();
    await expect(headline).toContainText("Bologna");
    await waitForTheDay(page);
    await expectTheView(page, view);

    // A day's proposal for a word, taken, on the re-plan's lab: Elche's late dinner.
    await page.goto("/lab/concepts/replan");
    await waitForTheDay(page);
    await expectTheView(page, view);
    await headline.getByRole("button", { name: "early dinner", exact: true }).click();
    await page.getByRole("option", { name: /eating late/ }).click();
    const take = page
      .getByRole("radio", { name: "eating late Take, proposed", exact: true })
      .filter({ visible: true })
      .first();
    await expect(take).toBeVisible({ timeout: DAY_TIMEOUT_MS });
    await take.click();
    await expect(headline).not.toContainText("early dinner", { timeout: DAY_TIMEOUT_MS });
    await waitForTheDay(page);
    // The proposal's new lunch, taken, in the view on show.
    await expect(
      page
        .getByText("Arròs on Passeig de l'Estació", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expectTheView(page, view);

    // A kept day's own page, which the log answers here: the e2e server keeps no day.
    await page.route(`**/api/day/${ID}`, (route) => route.fulfill({ json: WRITTEN }));
    await page.goto(`/day/${ID}`);
    await expect(headline).toContainText("A calm Saturday in Kyoto", { timeout: DAY_TIMEOUT_MS });
    await waitForTheDay(page);
    await expectTheView(page, view);
  });
}

const KANAZAWA = writtenDayAt("kanazawa")!.itinerary;
/** Where a stop's planned place stands among its versions. */
const plannedAt = (stop: (typeof KANAZAWA.stops)[number]) =>
  candidatesOf(stop).findIndex(({ id }) => id === stop.selectedPlaceId);
/** The first of Kanazawa's stops whose right arrow key bends the curve to a livelier version. */
const LIVELIER_STOP = KANAZAWA.stops.find(
  (stop) => keyStepOf(stop, plannedAt(stop), "livelier")?.kind === "energy",
)!;
/**
 * Another of Kanazawa's stops, with an arrow key that swaps it to a version at its own energy,
 * which changes nothing the headline says.
 */
const TWIN = KANAZAWA.stops.flatMap((stop) =>
  stop === LIVELIER_STOP
    ? []
    : (
        [
          ["ArrowRight", "livelier"],
          ["ArrowLeft", "quieter"],
        ] as const
      ).flatMap(([key, step]) => {
        const next = keyStepOf(stop, plannedAt(stop), step);
        return next?.kind === "version"
          ? [{ stop, key, place: candidatesOf(stop)[next.index]! }]
          : [];
      }),
)[0]!;

/** Kanazawa's written day, seen on this device so it opens whole, shown in this view. */
async function openSeenKanazawa(page: Page, view: View): Promise<void> {
  const day = `kanazawa:${writtenVersionOf(KANAZAWA)}`;
  await page.addInitScript(
    ([seenKey, seen, viewKey, shown]) => {
      localStorage.setItem(seenKey!, JSON.stringify([seen]));
      localStorage.setItem(viewKey!, shown!);
    },
    [BROWSER_STORAGE.seen.key, day, "lantern-day-view", view === "Plan" ? "read" : "chart"],
  );
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  await expectTheView(page, view);
}

/** What the page's statuses say now, each that says anything. */
async function saidNow(page: Page): Promise<string[]> {
  const said = await page.getByRole("status").allTextContents();
  return said.filter((text) => text !== "");
}

/** The place a version's arrow on the plan, or a stop's slider on the chart, names. */
async function placeNamedBy(control: Locator, attribute: string): Promise<string> {
  const label = (await control.getAttribute(attribute)) ?? "";
  return label.slice(label.indexOf(": ") + 2);
}

/** Swaps Kanazawa's first livelier stop, on the plan by its arrow or on the chart by its key. */
async function swapLivelier(page: Page, view: View): Promise<string> {
  if (view === "Plan") {
    const arrow = page.getByRole("button", { name: /^Livelier: / }).first();
    const place = await placeNamedBy(arrow, "aria-label");
    await arrow.click();
    return place;
  }
  const slider = page.getByRole("slider", { name: `Energy at ${LIVELIER_STOP.startTime}` });
  const before = await slider.getAttribute("aria-valuetext");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).not.toHaveAttribute("aria-valuetext", before!);
  return placeNamedBy(slider, "aria-valuetext");
}

for (const view of ["Plan", "Chart"] as const) {
  test(`${view}: a swap is said once from a status, as the place and the clause it brought, and not when the day opens with it`, async ({
    page,
  }) => {
    test.setTimeout(3 * DAY_TIMEOUT_MS);
    await openSeenKanazawa(page, view);
    expect(await saidNow(page)).toEqual([]);

    const place = await swapLivelier(page, view);
    await expect.poll(() => saidNow(page)).toHaveLength(1);
    const [line] = await saidNow(page);
    expect(line!.startsWith(`${place}, `)).toBe(true);
    const clause = line!.slice(place.length + 2);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`, ${clause}, in`);
    await expect(page.getByRole("status").filter({ hasText: clause })).toHaveCount(1);
    // Then quiet, so a read-through meets the clause once, in the headline.
    await expect.poll(() => saidNow(page), { timeout: waitMs(NOTICE_HEARD_MS * 2) }).toEqual([]);

    // Opened again as it was left, the day shows the clause and says nothing of it.
    await page.reload();
    await waitForTheDay(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`, ${clause}, in`);
    expect(await saidNow(page)).toEqual([]);
  });
}

test("Plan: a swap back to the plan is said as the place and the day as first planned", async ({
  page,
}) => {
  await openSeenKanazawa(page, "Plan");
  const rows = viewOf(page, "Plan").getByRole("listitem");
  const livelierIn = (index: number) =>
    rows.nth(index).getByRole("button", { name: /^Livelier: / });
  // Held by its place in the plan, as its arrows and heading change with the swap.
  const count = await rows.count();
  let at = 0;
  while (at < count && (await livelierIn(at).count()) === 0) at += 1;
  const row = rows.nth(at);
  const arrow = livelierIn(at).first();
  const planned = (await row.getByRole("heading").textContent()) ?? "";
  await arrow.click();
  await expect.poll(() => saidNow(page)).toHaveLength(1);

  await row.getByRole("button", { name: planned }).click();
  await expect.poll(() => saidNow(page)).toEqual([`${planned}, as first planned`]);
});

test("Chart: a stop's key to a version at its own energy says the place alone, not another stop's clause", async ({
  page,
}) => {
  await openSeenKanazawa(page, "Chart");
  await swapLivelier(page, "Chart");
  await expect.poll(() => saidNow(page)).toHaveLength(1);

  const slider = page.getByRole("slider", { name: `Energy at ${TWIN.stop.startTime}` });
  await slider.focus();
  await page.keyboard.press(TWIN.key);
  const { name, sensory } = TWIN.place;
  await expect(slider).toHaveAttribute("aria-valuetext", `${sensory.energy}: ${name}`);
  await expect.poll(() => saidNow(page)).toEqual([name]);
});

test("Chart: a stop's key back to its planned place says the place and the day as first planned", async ({
  page,
}) => {
  await openSeenKanazawa(page, "Chart");
  const slider = page.getByRole("slider", { name: `Energy at ${LIVELIER_STOP.startTime}` });
  const planned = await placeNamedBy(slider, "aria-valuetext");
  await swapLivelier(page, "Chart");
  await expect.poll(() => saidNow(page)).toHaveLength(1);

  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => placeNamedBy(slider, "aria-valuetext")).toBe(planned);
  await expect.poll(() => saidNow(page)).toEqual([`${planned}, as first planned`]);
});

/** A drag of a knob moves the mouse in this many steps, as a hand does. */
const DRAG_MOVES = 10;

/** Presses a stop's knob on the chart and drags it this far along the scale, still held. */
async function holdKnobDragged(page: Page, slider: Locator, by: number): Promise<void> {
  await slider.scrollIntoViewIfNeeded();
  const knob = await slider.locator("circle").boundingBox();
  if (!knob) throw new Error("The knob has no box");
  const from = { x: knob.x + knob.width / 2, y: knob.y + knob.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let move = 1; move <= DRAG_MOVES; move += 1) {
    await page.mouse.move(from.x + (by * move) / DRAG_MOVES, from.y);
  }
}

/** Drags a stop's knob on the chart this far along the scale, and lets it go. */
async function dragKnob(page: Page, slider: Locator, by: number): Promise<void> {
  await holdKnobDragged(page, slider, by);
  await page.mouse.up();
}

/** Another of Kanazawa's stops than the one the right arrow key makes livelier. */
const OTHER_STOP = KANAZAWA.stops.find((stop) => stop.startTime !== LIVELIER_STOP.startTime)!;
/** Far enough along the scale to be a drag, and short of a lane, as a hand still dragging. */
const HELD_DRAG_PX = 24;
/** Frames the page is given to say an act, which it writes a frame after the act. */
const FRAMES_TO_SAY = 3;

test("Chart: a stop's arrow key while a drag of the curve is held changes nothing and says nothing", async ({
  page,
}) => {
  await page.addInitScript(logStatuses);
  await openSeenKanazawa(page, "Chart");
  const keyed = page.getByRole("slider", { name: `Energy at ${LIVELIER_STOP.startTime}` });
  const before = await keyed.getAttribute("aria-valuetext");

  await holdKnobDragged(
    page,
    page.getByRole("slider", { name: `Energy at ${OTHER_STOP.startTime}` }),
    HELD_DRAG_PX,
  );
  await keyed.focus();
  const since = await page.evaluate(() => performance.now());
  await page.keyboard.press("ArrowRight");
  await page.evaluate(async (frames) => {
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, FRAMES_TO_SAY);
  const said = await page.evaluate(
    (since) => window.statusLog.filter(({ t, text }) => t >= since && text !== ""),
    since,
  );
  const after = await keyed.getAttribute("aria-valuetext");
  await page.mouse.up();

  expect(after).toBe(before);
  expect(said).toEqual([]);
});

test("Chart: a drag is said as the clause it changed, and a drag back as the day as first planned", async ({
  page,
}) => {
  await openSeenKanazawa(page, "Chart");
  const chartBox = await viewOf(page, "Chart").boundingBox();
  if (!chartBox) throw new Error("The chart has no box");
  const rows = page.getByRole("list", { name: "The day" });
  const written = await rows.getByRole("listitem").allTextContents();
  const slider = page.getByRole("slider", { name: /^Energy at/ }).nth(3);
  const knob = await slider.locator("circle").boundingBox();
  if (!knob) throw new Error("The knob has no box");
  const toward = knob.x < chartBox.x + chartBox.width / 2 ? 1 : -1;
  const reach = (chartBox.width / 5) * 1.5 * toward;

  await dragKnob(page, slider, reach);
  await expect.poll(() => saidNow(page)).toHaveLength(1);
  const [clause] = await saidNow(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`, ${clause}, in`);

  await dragKnob(page, slider, -reach);
  await expect.poll(() => rows.getByRole("listitem").allTextContents()).toEqual(written);
  await expect.poll(() => saidNow(page)).toEqual(["as first planned"]);
});

test("an energy press on the plan's bar is said from a status, as the headline's list counts it", async ({
  page,
}) => {
  await openSeenKanazawa(page, "Plan");
  await page
    .getByRole("group", { name: "How lively the day is" })
    .getByRole("button", { name: "lively", exact: true })
    .click();
  await expect.poll(() => saidNow(page)).toEqual(["lively: four stops re-picked"]);
});

test("an energy press on the headline's word is said from a status on the chart too", async ({
  page,
}) => {
  await openSeenKanazawa(page, "Chart");
  const headline = page.getByRole("heading", { level: 1 });
  await headline.getByRole("button", { name: "calm", exact: true }).click();
  await page.getByRole("option", { name: "lively", exact: true }).click();

  await expect.poll(() => saidNow(page)).toEqual(["lively: four stops re-picked"]);
});

test.describe("with motion", { tag: "@frame" }, () => {
  test.use({ reducedMotion: "no-preference" });

  test("the chart shown first after the plan stands in place from its first frame", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
    await page.goto("/day/kanazawa");
    await waitForTheDay(page);
    await expectTheView(page, "Plan");

    // Every frame's row tops from the press on, against the chart's own top: drawn first behind
    // the list under display: none, they slid 1.4 s to their places over one another. The bar
    // over the day drops the energy's words on the chart, which moves the whole chart once.
    await page.evaluate(() => {
      const tops: number[][] = [];
      (window as unknown as { tops: number[][] }).tops = tops;
      const sample = () => {
        const chart = document.querySelector('[aria-label="The day"]');
        const chartTop = chart?.getBoundingClientRect().top ?? 0;
        const rows = [...document.querySelectorAll('[aria-label="The day"] > li')];
        tops.push(rows.map((row) => row.getBoundingClientRect().top - chartTop));
        if (tops.length < 60) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Chart" }).click();
    await expectTheView(page, "Chart");
    await page.waitForFunction(() => (window as unknown as { tops: number[][] }).tops.length >= 60);
    const tops = await page.evaluate(() => (window as unknown as { tops: number[][] }).tops);
    const steps = tops
      .slice(1)
      .flatMap((frame, at) => frame.map((top, row) => Math.abs(top - (tops[at]?.[row] ?? top))));
    expect(Math.max(0, ...steps)).toBeLessThan(1);
  });

  test("the line under the plan counts the stops and versions the plan shows, never more", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lantern-day-view", "read");
      // Every frame from the first: how many rows the plan shows, how many of them with their
      // versions to swipe to, and what the line under it says.
      const said: { rows: number; versions: number; line: string }[] = [];
      (window as unknown as { said: typeof said }).said = said;
      const sample = () => {
        const rows = [...document.querySelectorAll('ol[aria-label="The day, to read"] > li')];
        const line = [...document.querySelectorAll("p")].find((element) =>
          /^Writing (the day ·|quieter)/.test(element.textContent ?? ""),
        );
        said.push({
          rows: rows.length,
          versions: rows.filter((row) =>
            [...row.querySelectorAll("button")].some((arrow) =>
              /^(Quieter|Livelier|Same energy): /.test(arrow.getAttribute("aria-label") ?? ""),
            ),
          ).length,
          line: line?.textContent ?? "",
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto("/day/kanazawa");
    await waitForThePlaying(page);
    await expect(page.getByRole("list", { name: "The day, to read" })).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: DAY_TIMEOUT_MS },
    );
    const said = await page.evaluate(
      () =>
        (window as unknown as { said: { rows: number; versions: number; line: string }[] }).said,
    );
    // Counted from the chart, it said a stop so far over an empty list, and a set ahead.
    const ahead = said.filter(({ rows, versions, line }) => {
      // A count is tied to its unit by a no-break space (`TIED`), which \s matches.
      const stops = /· (\d+)\sstops? so far/.exec(line);
      const sets = /· (\d+)\sof\s\d+/.exec(line);
      return (
        (stops !== null && Number(stops[1]) > rows) || (sets !== null && Number(sets[1]) > versions)
      );
    });
    expect(said.some(({ line }) => line.includes("so far"))).toBe(true);
    expect(ahead).toEqual([]);
  });

  test("a new energy reshapes the plan in about 1.5 s, the rows on screen gliding under 3 px a frame", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("lantern-day-view", "read"));
    // Kyoto's, written by hand, on the lab's bench, where the bar was measured. On a phone the
    // calm starts take longer, Kanazawa's 1.8 s and Porto's 2.0 (2026-11-04): a cost to weigh
    // against the bar where the bar is set, not this test's to loosen.
    await page.goto("/lab/concepts/day");
    const list = page.getByRole("list", { name: "The day, to read" });
    await expect(list).toHaveAttribute("aria-busy", "false", { timeout: DAY_TIMEOUT_MS });

    // The rows on screen as the word is changed, and every frame's row tops from then on.
    const onScreen = await list.evaluate((element) =>
      [...element.querySelectorAll(":scope > li")]
        .map((row, at) => (row.getBoundingClientRect().top < innerHeight ? at : -1))
        .filter((at) => at >= 0),
    );
    await list.evaluate((element) => {
      const frames: { t: number; tops: number[] }[] = [];
      (window as unknown as { frames: typeof frames }).frames = frames;
      const sample = () => {
        const rows = [...element.querySelectorAll(":scope > li")];
        frames.push({
          t: performance.now(),
          tops: rows.map((row) => row.getBoundingClientRect().top),
        });
        if (frames.length < 240) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const headline = page.getByRole("heading", { level: 1 });
    await headline.getByRole("button", { name: "calm", exact: true }).click();
    await page.getByRole("option", { name: "lively" }).click();
    await page.waitForFunction(
      () => (window as unknown as { frames: unknown[] }).frames.length >= 240,
    );
    const frames = await page.evaluate(
      () => (window as unknown as { frames: { t: number; tops: number[] }[] }).frames,
    );

    // How far each row on screen moves in a 60 Hz frame's time, over a tenth of a second,
    // so a frame a busy machine drops is not counted as a step.
    const FRAME_MS = 1000 / 60;
    let fastest = 0;
    let first: number | null = null;
    let last: number | null = null;
    frames.forEach((frame, index) => {
      const before = frames[index - 1];
      if (
        before &&
        frame.tops.some((top, row) => Math.abs(top - (before.tops[row] ?? top)) > 0.5)
      ) {
        first ??= before.t;
        last = frame.t;
      }
      let back = index;
      while (back > 0 && frame.t - frames[back - 1]!.t <= 100) back -= 1;
      const from = frames[back]!;
      if (frame.t - from.t < 80) return;
      for (const row of onScreen) {
        const moved = Math.abs((frame.tops[row] ?? 0) - (from.tops[row] ?? 0));
        fastest = Math.max(fastest, (moved * FRAME_MS) / (frame.t - from.t));
      }
    });
    expect(first, "the rows moved").not.toBeNull();
    expect(fastest).toBeLessThanOrEqual(3);
    expect(last! - first!).toBeLessThanOrEqual(1600);
  });
});
