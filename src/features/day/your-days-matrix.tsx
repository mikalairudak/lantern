import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import type { YourDay } from "./your-days";
import { YourDaysList, type YourDaysListProps } from "./your-days-list";
import { writtenPool } from "./written-pool";

const ignore = () => undefined;

/** Saturday evening in the visitor's own calendar, as the matrix is set. */
const NOW = new Date(2026, 9, 31, 21, 0);

/** The written days' requests and shapes, as a visitor's own days would hold them. */
const POOL = writtenPool();

/** One of the pool's days as the visitor's own, asked `hoursAgo` before `NOW`. */
function yourDayOf(at: number, hoursAgo: number, change: Partial<YourDay> = {}): YourDay {
  const written = POOL[at % POOL.length]!;
  return {
    id: `lab-${at}`,
    request: written.request,
    startedAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
    energies: [...written.energies],
    ending: "written",
    seconds: 41,
    ...change,
  };
}

/** A day still written: its shape so far, `stops` beads of it. */
function writingOf(at: number, stops: number): YourDay {
  const day = yourDayOf(at, 0, { ending: "writing", seconds: null });
  return { ...day, energies: day.energies.slice(0, stops) };
}

/** A full list: twelve, the most it keeps. */
const TWELVE = Array.from({ length: 12 }, (_, at) => yourDayOf(at, at * 9));

/**
 * The longest sentence a day can say: a town of 58 letters with no break in it, every word
 * the visitor's and each word its longest, eight stops.
 */
const LONGEST = yourDayOf(0, 30, {
  request: {
    ...POOL[0]!.request,
    city: "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch",
    timezone: "Europe/London",
    energy: "balanced",
    travel: "transit",
    start: "slow",
    dinner: "early",
    end: "early",
    company: "partner",
  },
  energies: ["calm", "balanced", "balanced", "lively", "calm", "balanced", "social", "calm"],
});

/**
 * The visitor's own days over the starts, in every way a day stands: still with no stop, with
 * its stops so far, written today, cut short yesterday, not finished last week, a full list
 * of twelve, the most it keeps, of which the newest three show and then all, and the longest
 * sentence a day can say.
 */
export const YOUR_DAYS_MATRIX: LabMatrix = labMatrix<YourDaysListProps>({
  key: "your-days",
  title: "Your days",
  note: "The visitor's own days over the starts, as each stands, from one still written to twelve",
  base: { days: [yourDayOf(3, 1)], now: NOW, onOpen: ignore, onForget: ignore },
  axes: [
    {
      name: "days",
      values: [
        { label: "one, before its first stop", props: { days: [writingOf(3, 0)] } },
        { label: "one, its stops so far", props: { days: [writingOf(3, 4)] } },
        { label: "one, written today", props: { days: [yourDayOf(3, 1)] } },
        {
          label: "three, as each can end",
          props: {
            days: [
              writingOf(4, 3),
              yourDayOf(6, 26, { ending: "cut", seconds: null }),
              yourDayOf(8, 24 * 7, { ending: "failed", seconds: null, energies: [] }),
            ],
          },
        },
        {
          label: "twelve: the newest three, and a way to all",
          props: { days: TWELVE },
        },
        { label: "twelve, all shown", props: { days: TWELVE, isAllShownAtFirst: true } },
        { label: "the longest sentence, a 58-letter town", props: { days: [LONGEST] } },
      ],
    },
  ],
  render: (props) => <YourDaysList {...props} />,
  wide: "page",
});
