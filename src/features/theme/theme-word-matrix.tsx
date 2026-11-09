import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { ThemeWordCell, type ThemeWordCellProps } from "./theme-word-cell";

/**
 * The theme's icon, closed, hinted and open, in each theme a visitor can choose. The hint
 * is drawn as hover and the keyboard's focus show it; the focus ring itself is the page's,
 * checked there.
 */
export const THEME_WORD_MATRIX: LabMatrix = labMatrix<ThemeWordCellProps>({
  key: "theme-word",
  title: "Theme icon",
  note: "The masthead's theme icon, its hint, and its list marking the theme the page is set in",
  base: { choice: "system", isOpen: false, isHintShown: false },
  axes: [
    {
      name: "list",
      values: [
        { label: "closed", props: { isOpen: false } },
        { label: "hinted", props: { isHintShown: true } },
        { label: "open", props: { isOpen: true } },
      ],
    },
    {
      name: "chosen",
      values: [
        { label: "the system's", props: { choice: "system" } },
        { label: "light", props: { choice: "light" } },
        { label: "dark", props: { choice: "dark" } },
      ],
    },
  ],
  render: (props) => <ThemeWordCell {...props} />,
  // The masthead's line is the page's width on a laptop.
  wide: "page",
});
