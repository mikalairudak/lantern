import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { ThemeButtonCell, type ThemeButtonCellProps } from "./theme-button-cell";

/**
 * The theme's button, by day and by night as the cell's own theme sets it: a moon and "Dark" on
 * a day page, a sun and "Light" on a night page. Under a finger it stands as at rest, its reach
 * unseen and no helper; forced colours, where it is not offered, are an e2e's emulation.
 */
export const THEME_BUTTON_MATRIX: LabMatrix = labMatrix<ThemeButtonCellProps>({
  key: "theme-button",
  title: "Theme button",
  note: "The masthead's theme button, offering the other look, with its helper under a pointer or the keyboard",
  base: { state: "rest" },
  axes: [
    {
      name: "state",
      values: [
        { label: "at rest, and under a finger", props: { state: "rest" } },
        { label: "pointed at: its helper after the wait", props: { state: "pointed" } },
        { label: "focused by keys: the ring, its helper at once", props: { state: "focused" } },
      ],
    },
  ],
  render: (props, width) => <ThemeButtonCell {...props} width={width} />,
  // The masthead's line is the page's width on a laptop.
  wide: "page",
});
