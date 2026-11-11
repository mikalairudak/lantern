import { expect, test, type Page, waitMs } from "./fixtures";
import { BROWSER_STORAGE } from "../src/lib/browser-storage";
import { writtenVersionOf } from "../src/lib/days/written/version";
import { ENERGY_LEVELS } from "../src/lib/schema/itinerary.schema";
import { writtenDayAt } from "../src/lib/days/written/days";

// The places a visitor chose on a day are kept on this device, so the day opens as they left it; a
// day rewritten in a later build opens as written, and nothing of it leaves the browser.

const DAY_TIMEOUT_MS = waitMs(30_000);
const PICKS_KEY = BROWSER_STORAGE.picks.key;
const SEEN_KEY = BROWSER_STORAGE.seen.key;
const KANAZAWA = writtenDayAt("kanazawa")!.itinerary;
const KANAZAWA_KEY = `kanazawa:${writtenVersionOf(KANAZAWA)}`;

type Stop = (typeof KANAZAWA.stops)[number];
type Place = Stop["primary"];

/** A place's energy as a level, from reflective to social. */
function levelOf(place: Place): number {
  return ENERGY_LEVELS.indexOf(place.sensory.energy);
}

/** The first stop with a version livelier than the one written, which the keyboard steps to. */
const STOP = KANAZAWA.stops.find((stop) =>
  stop.alternatives.some((place) => levelOf(place) > levelOf(writtenOf(stop))),
)!;

function writtenOf(stop: Stop): Place {
  return [stop.primary, ...stop.alternatives].find(({ id }) => id === stop.selectedPlaceId)!;
}

/** How the stop's slider names a version: its energy and its name. */
function valueOf(place: Place): string {
  return `${place.sensory.energy}: ${place.name}`;
}

const WRITTEN_VALUE = valueOf(writtenOf(STOP));

function sliderOf(page: Page) {
  return page.getByRole("slider", { name: `Energy at ${STOP.startTime}` });
}

/** The day on screen is written whole: its chart, seen or not, is still. */
async function waitForTheDay(page: Page): Promise<void> {
  await expect(page.locator('[aria-label^="The day\'s energy"]')).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: DAY_TIMEOUT_MS },
  );
}

/** Steps the stop to a livelier version from the keyboard, and says which it shows. */
async function chooseLivelier(page: Page): Promise<string> {
  const slider = sliderOf(page);
  await expect(slider).toHaveAttribute("aria-valuetext", WRITTEN_VALUE);
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).not.toHaveAttribute("aria-valuetext", WRITTEN_VALUE);
  return (await slider.getAttribute("aria-valuetext")) ?? "";
}

async function storedOf(page: Page, key: string): Promise<unknown> {
  return page.evaluate((stored) => JSON.parse(localStorage.getItem(stored) ?? "null"), key);
}

test("a version chosen on a day is there after a reload, and nothing of it goes to the server", async ({
  page,
  productEvents,
}) => {
  test.setTimeout(3 * DAY_TIMEOUT_MS);
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const chosen = await chooseLivelier(page);
  const chosenPlace = [STOP.primary, ...STOP.alternatives].find(
    (place) => valueOf(place) === chosen,
  )!;
  await expect
    .poll(() => storedOf(page, PICKS_KEY))
    .toEqual([{ day: KANAZAWA_KEY, places: { [STOP.id]: chosenPlace.id } }]);

  // Every request the page makes from here: none says what was chosen, and the seen day's
  // header, where one is sent, is its address and version alone.
  const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
  page.on("request", (request) =>
    sent.push({ url: request.url(), headers: request.headers(), body: request.postData() ?? "" }),
  );
  const swapsBefore = productEvents.length;
  await page.reload();
  await waitForTheDay(page);

  await expect(sliderOf(page)).toHaveAttribute("aria-valuetext", chosen);
  const told = sent.filter(({ url, headers, body }) =>
    [url, JSON.stringify(headers), body].some(
      (text) => text.includes(chosenPlace.id) || text.includes(PICKS_KEY),
    ),
  );
  expect(told).toEqual([]);
  for (const { headers } of sent) {
    const seen = headers["x-lantern-seen-day"];
    if (seen !== undefined) expect(seen).toMatch(/^[a-z0-9-]+:[0-9a-f]{16}$/);
  }
  // Shown again, the version is no gesture of the visitor's.
  expect(
    productEvents.slice(swapsBefore).filter((event) => {
      const { kind } = event as { kind?: string };
      return kind === "stop-swapped" || kind === "curve-dragged";
    }),
  ).toEqual([]);

  // Back to the version written, the day is let go.
  await sliderOf(page).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(sliderOf(page)).toHaveAttribute("aria-valuetext", WRITTEN_VALUE);
  await expect.poll(() => storedOf(page, PICKS_KEY)).toBeNull();
});

test("a day rewritten in a later build opens as written, and a place it no longer has is let go", async ({
  page,
}) => {
  const livelier = STOP.alternatives.find((place) => levelOf(place) > levelOf(writtenOf(STOP)))!;
  await page.addInitScript(
    ({ picksKey, seenKey, day, stop, place }) => {
      // Seen in this version, so it opens whole; chosen on in another, and on this one with
      // a place it does not have.
      localStorage.setItem(seenKey, JSON.stringify([day]));
      localStorage.setItem(
        picksKey,
        JSON.stringify([
          { day: "kanazawa:0000000000000000", places: { [stop]: place } },
          { day, places: { [stop]: "a-place-from-another-build" } },
        ]),
      );
    },
    {
      picksKey: PICKS_KEY,
      seenKey: SEEN_KEY,
      day: KANAZAWA_KEY,
      stop: STOP.id,
      place: livelier.id,
    },
  );
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);

  await expect(sliderOf(page)).toHaveAttribute("aria-valuetext", WRITTEN_VALUE);
  // What the day shows is kept in its place: its written places, so nothing for it.
  await expect
    .poll(() => storedOf(page, PICKS_KEY))
    .toEqual([{ day: "kanazawa:0000000000000000", places: { [STOP.id]: livelier.id } }]);
});

test("without storage a version chosen holds on the page alone", async ({ page }) => {
  test.setTimeout(3 * DAY_TIMEOUT_MS);
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException("The storage is blocked", "SecurityError");
    };
    Storage.prototype.getItem = blocked;
    Storage.prototype.setItem = blocked;
    Storage.prototype.removeItem = blocked;
  });
  await page.goto("/day/kanazawa");
  await waitForTheDay(page);
  const chosen = await chooseLivelier(page);
  // The day on screen keeps it.
  await page.keyboard.press("Tab");
  await expect(sliderOf(page)).toHaveAttribute("aria-valuetext", chosen);

  await page.reload();
  await waitForTheDay(page);
  await expect(sliderOf(page)).toHaveAttribute("aria-valuetext", WRITTEN_VALUE);
});
