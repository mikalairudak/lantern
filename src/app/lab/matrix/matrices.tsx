import { FRAME_POINTS } from "../stream/frames";
import { FrameCell, type FrameCellProps } from "../stream/frame-cell";
import { STREAM_DAYS } from "../stream/stream-days";
import { AXIS_LIGHT_MATRIX } from "@/features/abacus/axis-light-matrix";
import { SILENCE_MATRIX } from "@/features/abacus/silence-matrix";
import { STOP_ROW_MATRIX } from "@/features/abacus/stop-row-matrix";
import { PLACE_CHECK_MATRIX } from "@/features/abacus/place-check-matrix";
import { STICKY_SCALE_MATRIX } from "@/features/abacus/sticky-scale-matrix";
import { FORK_ROW_MATRIX } from "@/features/abacus/fork-row-matrix";
import { CITY_WORD_MATRIX } from "@/features/day/city-word-matrix";
import { DAY_SHAPE_MATRIX } from "@/features/day/day-shape-matrix";
import { YOUR_DAYS_MATRIX } from "@/features/day/your-days-matrix";
import { PROGRESS_LINE_MATRIX } from "@/features/day/progress-line-matrix";
import { DAY_MENU_MATRIX } from "@/features/day/day-menu-matrix";
import { PLAN_MATRIX } from "@/features/day/plan-matrix";
import { PLAN_BAR_MATRIX } from "@/features/day/plan-bar-matrix";
import { FOOT_LINE_MATRIX } from "@/features/day/foot-line-matrix";
import { DAY_END_MATRIX } from "@/features/day/day-end-matrix";
import { START_HEADER_MATRIX } from "@/features/day/start-header-matrix";
import { DAY_STAGE_HEADER_MATRIX } from "@/features/day/day-stage-header-matrix";
import { READING_LIST_MATRIX } from "@/features/day/reading-list-matrix";
import { THEME_WORD_MATRIX } from "@/features/theme/theme-word-matrix";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";

/**
 * Every component registered in `/lab/matrix`. A component's matrix lives beside it and is
 * added here; the renderer reads nothing else.
 */
export const MATRICES: readonly LabMatrix[] = [
  STOP_ROW_MATRIX,
  PLACE_CHECK_MATRIX,
  SILENCE_MATRIX,
  AXIS_LIGHT_MATRIX,
  STICKY_SCALE_MATRIX,
  FORK_ROW_MATRIX,
  PROGRESS_LINE_MATRIX,
  DAY_END_MATRIX,
  FOOT_LINE_MATRIX,
  DAY_MENU_MATRIX,
  START_HEADER_MATRIX,
  DAY_SHAPE_MATRIX,
  YOUR_DAYS_MATRIX,
  CITY_WORD_MATRIX,
  DAY_STAGE_HEADER_MATRIX,
  READING_LIST_MATRIX,
  PLAN_MATRIX,
  PLAN_BAR_MATRIX,
  THEME_WORD_MATRIX,
  labMatrix<FrameCellProps>({
    key: "stream-frames",
    title: "Stream frames",
    note: "Every fixture day at the moments a streaming component has to look right in",
    base: { dayIndex: 0, pointIndex: 0 },
    axes: [
      {
        name: "moment",
        values: FRAME_POINTS.map(({ label }, pointIndex) => ({ label, props: { pointIndex } })),
      },
      {
        name: "day",
        values: STREAM_DAYS.map(({ label }, dayIndex) => ({ label, props: { dayIndex } })),
      },
    ],
    render: (props) => <FrameCell {...props} />,
    // The lab's view of a partial day, not a product component: the baseline skips it.
    baseline: [],
  }),
];

export function matrixOf(key: string): LabMatrix | undefined {
  return MATRICES.find((matrix) => matrix.key === key);
}
