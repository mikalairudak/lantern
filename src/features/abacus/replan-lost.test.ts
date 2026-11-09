// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { writtenDayAt } from "@/lib/days/written/days";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { goldenReplansOf } from "@/lib/fixtures/replan/golden-replans";
import { KANAZAWA_LATE_DINNER } from "@/lib/fixtures/replan/kanazawa-dinner";
import { KYOTO_EVENING_BASIS, KYOTO_LATE_EVENING } from "@/lib/fixtures/replan/kyoto-evening";
import {
  KYOTO_MORNING_BASIS,
  KYOTO_SLOW_MORNING,
  KYOTO_SLOW_MORNING_ONE,
  KYOTO_SLOW_MORNING_THREE,
  KYOTO_SLOW_MORNING_WITH_VERSIONS,
} from "@/lib/fixtures/replan/kyoto-morning";
import { LISBON_LATE_DINNER } from "@/lib/fixtures/replan/lisbon-dinner";
import {
  keptPlaceNamesOf,
  mergeShownReplan,
  windowBoundsOf,
  type ReplanBasis,
} from "@/lib/replan/merge";
import { withPicks } from "@/lib/replan/request";
import { formatClock } from "@/lib/time/clock";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { readReplanStream } from "@/lib/stream/read-replan-stream";
import { replanFrameOf } from "./replan-frame";

/**
 * A re-plan the page ends early, lost (`ReplanFrame.isLost`), is one the server's merge refuses
 * at its end (`mergeShownReplan`): were they ever to differ, the page would let go a re-plan
 * the server then finishes, and the visitor's list would hold a day they were told failed.
 */

/** The re-plan's text sent a few letters at a time, as a model streams it, ending whole. */
function streamOf(replan: GeneratedReplan): Response {
  const text = JSON.stringify(replan);
  const deltas: string[] = [];
  for (let from = 0; from < text.length; from += 4) deltas.push(text.slice(from, from + 4));
  const events = [
    ...deltas.map((delta) => ({ type: "text-delta", id: "t", delta })),
    { type: "finish", finishReason: "stop" },
  ];
  const body = [...events.map((event) => JSON.stringify(event)), "[DONE]"]
    .map((line) => `data: ${line}\n\n`)
    .join("");
  return new Response(body);
}

/** Past a window's close: well clear of it, and of the next kept stop's start. */
const OUTSIDE_BY = 30;

/** Before a window's close: a stop starting there is cut to under the merge's quarter hour. */
const TOO_SHORT_BY = 10;

/** The merge's repairs that leave no new stop out: one cut short, a kept stop's version given up. */
const NOT_DROPS: ReadonlySet<string> = new Set(["shortened-at-kept", "yielded-version"]);

/** Whether any frame of the re-plan, as the page reads its stream, says it is lost. */
async function isEverLost(basis: ReplanBasis, replan: GeneratedReplan): Promise<boolean> {
  let isLost = false;
  await readReplanStream({
    basis,
    response: Promise.resolve(streamOf(replan)),
    onPartial: (partial) => {
      isLost ||= replanFrameOf(basis, partial).isLost;
    },
  });
  return isLost;
}

const golden = goldenReplansOf(
  readFileSync("src/lib/fixtures/replan/golden-replans.jsonl", "utf8"),
);
const lisbon = golden.find((each) => each.name === "dinner: early to late");
const kanazawa = writtenDayAt("kanazawa");
if (!lisbon || !kanazawa) throw new Error("Lisbon and Kanazawa are recorded");

/** Every re-plan recorded, with the day it was written for. */
const RECORDED: readonly { name: string; basis: ReplanBasis; replan: GeneratedReplan }[] = [
  { name: "Kyoto, two for two", basis: KYOTO_MORNING_BASIS, replan: KYOTO_SLOW_MORNING },
  { name: "Kyoto, one for two", basis: KYOTO_MORNING_BASIS, replan: KYOTO_SLOW_MORNING_ONE },
  { name: "Kyoto, three for two", basis: KYOTO_MORNING_BASIS, replan: KYOTO_SLOW_MORNING_THREE },
  {
    name: "Kyoto, with versions",
    basis: KYOTO_MORNING_BASIS,
    replan: KYOTO_SLOW_MORNING_WITH_VERSIONS,
  },
  { name: "Kyoto, the evening", basis: KYOTO_EVENING_BASIS, replan: KYOTO_LATE_EVENING },
  {
    name: "Lisbon, the dinner",
    basis: {
      itinerary: lisbon.itinerary,
      request: lisbon.request,
      changed: lisbon.changed,
      windows: lisbon.windows,
      idPrefix: "r1",
    },
    replan: LISBON_LATE_DINNER,
  },
  {
    name: "Kanazawa, the dinner",
    basis: {
      itinerary: kanazawa.itinerary,
      request: { ...kanazawa.request, dinner: "late" },
      changed: "dinner",
      windows: [{ from: 6, to: 7 }],
      idPrefix: "r1",
    },
    replan: KANAZAWA_LATE_DINNER,
  },
  {
    name: "Elche, the dinner as production had it",
    basis: ELCHE_DINNER_BASIS,
    replan: ELCHE_LATE_DINNER,
  },
  {
    name: "Elche, the dinner less its coffee",
    basis: ELCHE_DINNER_BASIS,
    replan: ELCHE_LATE_DINNER_UNREPEATED,
  },
];

/**
 * Each recorded re-plan as it could have gone wrong, one way for each stop the merge drops: its
 * last new stop at a kept place, by its name, and, where its last window closes before the
 * day's end, half an hour past it, outside every window, or ten minutes before it, too short
 * once cut there.
 */
const WRONG = RECORDED.flatMap(({ name, basis, replan }) => {
  const last = replan.stops.length - 1;
  const lastStop = replan.stops[last];
  const kept = keptPlaceNamesOf(basis.itinerary, basis.windows)[0];
  const closes = windowBoundsOf(basis.itinerary, basis.windows).at(-1)?.closes;
  if (!lastStop || kept === undefined || closes === undefined) return [];
  const withLast = (stop: typeof lastStop): GeneratedReplan => ({
    ...replan,
    stops: replan.stops.map((each, at) => (at === last ? stop : each)),
  });
  return [
    {
      name: `${name}, its last stop at a kept place`,
      basis,
      replan: withLast({ ...lastStop, place: { ...lastStop.place, name: kept } }),
    },
    ...(Number.isFinite(closes)
      ? [
          {
            name: `${name}, its last stop outside every window`,
            basis,
            replan: withLast({ ...lastStop, startTime: formatClock(closes + OUTSIDE_BY) }),
          },
          {
            name: `${name}, its last stop too short once cut at its window's close`,
            basis,
            replan: withLast({
              ...lastStop,
              startTime: formatClock(closes - TOO_SHORT_BY),
              durationMinutes: TOO_SHORT_BY * 4,
            }),
          },
        ]
      : []),
  ];
});

describe("a re-plan the page knows lost", () => {
  it.each([...RECORDED, ...WRONG])(
    "is lost before its end exactly where the merge refuses it for a stop it drops: $name",
    async ({ basis, replan }) => {
      const merged = mergeShownReplan({ ...basis, replan });
      const isDroppedByMerge =
        !merged.ok && merged.mergeRepairs.some(({ kind }) => !NOT_DROPS.has(kind));

      // Never lost where the merge shows the day: the page never lets go a day the server keeps.
      if (merged.ok) expect(await isEverLost(basis, replan)).toBe(false);
      // Lost wherever the merge drops a stop by its own rule, which the page reads as it streams.
      if (isDroppedByMerge) expect(await isEverLost(basis, replan)).toBe(true);
    },
  );

  it("is not lost for a new stop at a kept stop's version off screen, which yields, and lost at the version the visitor shows", async () => {
    const stops = ELCHE_DINNER_BASIS.itinerary.stops;
    const basilica = stops.find(({ alternatives }) =>
      alternatives.some(({ name }) => name === "Plaça de Baix"),
    );
    const quieter = basilica?.alternatives.find(({ name }) => name === "Plaça de Baix");
    if (basilica === undefined || quieter === undefined)
      throw new Error("Elche keeps its basilica");
    const atVersion: GeneratedReplan = {
      ...ELCHE_LATE_DINNER_UNREPEATED,
      stops: ELCHE_LATE_DINNER_UNREPEATED.stops.map((stop, index) =>
        index === 0 ? { ...stop, place: { ...stop.place, name: "Plaça de Baix" } } : stop,
      ),
    };
    const picked: ReplanBasis = {
      ...ELCHE_DINNER_BASIS,
      itinerary: withPicks(ELCHE_DINNER_BASIS.itinerary, { [basilica.id]: quieter.id }),
    };

    expect(mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: atVersion }).ok).toBe(true);
    expect(await isEverLost(ELCHE_DINNER_BASIS, atVersion)).toBe(false);
    expect(mergeShownReplan({ ...picked, replan: atVersion }).ok).toBe(false);
    expect(await isEverLost(picked, atVersion)).toBe(true);
  });

  it("knows production's Elche lost as its coffee is whole, before its versions are written", async () => {
    const frames: boolean[] = [];
    await readReplanStream({
      basis: ELCHE_DINNER_BASIS,
      response: Promise.resolve(streamOf(ELCHE_LATE_DINNER)),
      onPartial: (partial) => {
        const frame = replanFrameOf(ELCHE_DINNER_BASIS, partial);
        if (frame.isLost) frames.push(frame.writing === "stops");
      },
    });

    expect(frames[0]).toBe(true);
  });

  // So the rule is held to the merge where it bites: every wrong one is a stop the merge drops.
  it("finds every re-plan made wrong refused by the merge, for a stop it drops itself", () => {
    const refused = WRONG.filter(({ basis, replan }) => {
      const merged = mergeShownReplan({ ...basis, replan });
      return !merged.ok && merged.mergeRepairs.some(({ kind }) => !NOT_DROPS.has(kind));
    });

    expect(WRONG.length).toBeGreaterThan(RECORDED.length);
    expect(refused.map(({ name }) => name)).toEqual(WRONG.map(({ name }) => name));
  });
});
