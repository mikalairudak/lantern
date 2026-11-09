import { CROWDED_DAY } from "@/lib/fixtures/edge/crowded";
import type { EdgeDay } from "@/lib/fixtures/edge/edge-day";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/minimal";
import { NEVER_QUIET_DAY } from "@/lib/fixtures/edge/never-quiet";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { EnergyLevel } from "@/lib/schema/itinerary.schema";
import { shownEnergiesOf } from "./day-shape";
import { QuickStartRow } from "./start-header";
import { startOffersOf, type StartOffer } from "./start-offers";
import { writtenPool } from "./written-pool";

const ignore = () => undefined;

/** An edge day as a start would offer it, under the country its city is in. */
function offerOf({ request, day }: EdgeDay, country: string): StartOffer {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`An edge day does not normalize: ${normalized.reason}`);
  return { country, request, energies: shownEnergiesOf(normalized.itinerary) };
}

const [BOLOGNA, , , MADRID, , NAFPLIO] = startOffersOf(writtenPool());

/** A day whose every stop stands in one lane: the shape is a straight line down. */
function inOneLane(offer: StartOffer, energy: EnergyLevel): StartOffer {
  return { ...offer, energies: offer.energies.map(() => energy) };
}

/**
 * A quick start's shape at the extremes a day can give it, set as the start screen sets it,
 * beside its words: one stop, where the curve is a lone bead; the most stops a day has, a
 * shape taller than its words; every stop in one lane, at each end of the scale; and the
 * starts' own, the liveliest and the quietest of them and the one whose words run longest.
 */
export const DAY_SHAPE_MATRIX: LabMatrix = labMatrix<{ start: StartOffer }>({
  key: "day-shape",
  title: "Day shape",
  note: "A quick start's shape of its day, at one stop, twelve, one lane, and the starts' own",
  base: { start: BOLOGNA! },
  axes: [
    {
      name: "day",
      values: [
        { label: "one stop", props: { start: offerOf(MINIMAL_DAY, "China") } },
        { label: "twelve stops", props: { start: offerOf(CROWDED_DAY, "Spain") } },
        { label: "never quiet", props: { start: offerOf(NEVER_QUIET_DAY, "United States") } },
        { label: "all reflective", props: { start: inOneLane(NAFPLIO!, "reflective") } },
        { label: "all social", props: { start: inOneLane(BOLOGNA!, "social") } },
        { label: "Bologna, lively", props: { start: BOLOGNA! } },
        { label: "Madrid, its words the longest", props: { start: MADRID! } },
        { label: "Nafplio, quiet", props: { start: NAFPLIO! } },
      ],
    },
  ],
  render: ({ start }) => <QuickStartRow start={start} onChoose={ignore} />,
});
