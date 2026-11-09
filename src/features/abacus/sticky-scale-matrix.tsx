import { labMatrix } from "@/lib/lab-matrix";
import { chartScale } from "./geometry";
import { StickyScale } from "./sticky-scale";

/** The band's own states, as a still sets them rather than the page's scroll. */
interface StickyScaleCellProps {
  isCurveNamed: boolean;
  clause: string | null;
  isDragging: boolean;
  isHeld: boolean;
}

/** A phone's chart at 390 px: its column 358 px wide, the day's hours as asked. */
const PHONE_CHART = chartScale(358, 96, 7 * 60, 21 * 60);
/** A row passing under the band where it is held, as on the page. */
const ROW_UNDER = "Churros by Plaza Mayor";

/** How far under the band's hairline the row passing under it stands, clear of it. */
const ROW_UNDER_GAP = 4;

function StickyScaleCell({ isCurveNamed, clause, isDragging, isHeld }: StickyScaleCellProps) {
  const band = PHONE_CHART.plotTop - PHONE_CHART.chart.laneTick;
  // The row stands just under the band, as a row a moment from passing under it.
  const top = band + ROW_UNDER_GAP;
  const height = top + PHONE_CHART.plotTop;
  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      {/* Held at the screen's top, the band stands over the rows that scroll under it. */}
      {isHeld && (
        <p className="absolute left-20 type-name text-ink" style={{ top }}>
          {ROW_UNDER}
        </p>
      )}
      <StickyScale
        scale={PHONE_CHART}
        isCurveNamed={isCurveNamed}
        clause={clause}
        isDragging={isDragging}
        onBackToPlan={() => undefined}
        isHeldInStill={isHeld}
      />
    </div>
  );
}

/** The day's moments the band says something different in. */
const MOMENTS: readonly { label: string; props: Partial<StickyScaleCellProps> }[] = [
  { label: "while the day is written", props: { isCurveNamed: false } },
  { label: "the curve can be dragged", props: { isCurveNamed: true } },
  { label: "changed", props: { clause: "livelier at lunch" } },
  {
    label: "changed, the longest clause",
    props: { clause: "livelier at breakfast and quieter in the morning" },
  },
  {
    label: "changed, a hand on the curve",
    props: { clause: "livelier at lunch", isDragging: true },
  },
];

/**
 * The energy scale's band on a phone (2026-11-05): where it rests over the chart's ticks and
 * held at the screen's top over the rows passing under it, while the day is written, once the
 * curve can be dragged, once the day differs from its plan with a short clause and the longest
 * one, and while a hand is on the curve, when the held band steps aside. A laptop draws the
 * chart's own words and no band.
 */
export const STICKY_SCALE_MATRIX = labMatrix<StickyScaleCellProps>({
  key: "sticky-scale",
  title: "Sticky scale",
  note: "The energy scale held at a phone's top: at rest or held, named, changed, and under a drag",
  base: { isCurveNamed: true, clause: null, isDragging: false, isHeld: false },
  // One axis, a cell to a row in each theme, so the grid fits a laptop's page: each moment
  // where the band rests, then held at the screen's top.
  axes: [
    {
      name: "state",
      // While the day is written the band is never held: it rests where the chart's words stood.
      values: MOMENTS.flatMap(({ label, props }) => [
        { label: `${label}, where it rests`, props: { ...props, isHeld: false } },
        ...(props.isCurveNamed === false
          ? []
          : [{ label: `${label}, held at the screen's top`, props: { ...props, isHeld: true } }]),
      ]),
    },
  ],
  render: (props, width) =>
    width === "wide" ? (
      <p className="type-note text-muted">On a laptop the chart says its own scale; no band.</p>
    ) : (
      <StickyScaleCell {...props} />
    ),
});
