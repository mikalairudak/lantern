import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { YourDaysLedger, type YourDaysLedgerProps } from "./your-days-ledger";
import { LedgerPlayCell } from "./your-days-ledger-cell";
import { LEDGER_NOW, LEDGER_SETS } from "./your-days-ledger-examples";

const ignore = () => undefined;

/** The page's gutter on a laptop, so the wide cell's column is the start screen's. */
const LAPTOP_GUTTER_CLASSES = "px-16";

interface LedgerCellProps extends YourDaysLedgerProps {
  /** The newest day played from being written to written at a press. */
  isPlayed?: boolean;
}

/**
 * The visitor's own days as a ledger, in every set a list can hold and every state a row can
 * stand in. Its baseline is the sets at rest: the states are drawn still for the eye, and the
 * played cell waits on a press.
 */
export const YOUR_DAYS_LEDGER_MATRIX: LabMatrix = labMatrix<LedgerCellProps>({
  key: "your-days-ledger",
  title: "Your days, as a ledger",
  note: "The visitor's own days a line each, city, date and words, from one to twelve and as each can stand",
  base: { days: LEDGER_SETS[0]!.days, now: LEDGER_NOW, onOpen: ignore, onForget: ignore },
  axes: [
    {
      name: "days",
      values: LEDGER_SETS.map(({ label, days, isAllShownAtFirst = false }) => ({
        label,
        props: { days, isAllShownAtFirst },
      })),
    },
    {
      name: "state",
      values: [
        { label: "at rest", props: {} },
        { label: "first row pointed at", props: { still: { pointedRow: 0 } } },
        { label: "first row focused", props: { still: { focusedRow: 0 } } },
        { label: "forget asked", props: { still: { isForgetAsking: true } } },
        { label: "under reduced motion", props: { still: { isMotionReduced: true } } },
        { label: "newest played from writing to written", props: { isPlayed: true } },
      ],
    },
  ],
  render: ({ isPlayed = false, ...props }, width) => (
    <div className={cn("pb-6", width === "wide" && LAPTOP_GUTTER_CLASSES)}>
      {isPlayed ? (
        <LedgerPlayCell {...props} />
      ) : (
        // Keyed by its still, so a cell drawn again in another state starts from it.
        <YourDaysLedger key={JSON.stringify(props.still ?? {})} {...props} />
      )}
    </div>
  ),
  wide: "page",
  baseline: [{ rows: 0, columns: 0 }],
});
