import type { ReactNode } from "react";

/** One value along an axis: the name the lab shows, and the props it sets. */
export interface MatrixValue<Props> {
  label: string;
  props: Partial<Props>;
}

/** One dimension of a component's space, such as its lifecycle state or its data extremes. */
export interface MatrixAxis<Props> {
  name: string;
  values: readonly MatrixValue<Props>[];
}

/**
 * The column a component stands in on a laptop, which a matrix's wide cell takes: the
 * abacus column, where the chart's parts stand, or the page's, where the day's header does.
 */
export type WideColumn = "abacus" | "page";

/** The width a cell is set at: a phone's screen, or the component's column on a laptop. */
export type CellWidth = "phone" | "wide";

/** A way to lay a matrix's grid out: the axis down its rows and the one across, by index. */
export interface GridView {
  rows: number;
  columns: number;
}

/**
 * Every state the lab shows a component in, written as plain data beside it. Each cell is `base`
 * with one value from every axis laid over it, the earlier axes first. Themes and widths are not
 * axes: the renderer sets every cell in both themes, at a phone's width, inside the page's gutters
 * as a phone sets it, and at the width the component takes on a laptop.
 */
export interface MatrixEntry<Props> {
  /** The URL segment, as in `/lab/matrix/stop-row`. */
  key: string;
  title: string;
  /** One line on what the matrix shows, for the lab's index. */
  note: string;
  base: Props;
  axes: readonly MatrixAxis<Props>[];
  /**
   * A cell, at a phone's width or the wide cell's. A phone cell holds the page's gutters; a
   * component that stands in them on a laptop sets that gutter itself.
   */
  render: (props: Props, width: CellWidth) => ReactNode;
  /** The column the wide cell takes, the component's on a laptop. Left out, the abacus's. */
  wide?: WideColumn;
  /**
   * The views `pnpm e2e:visual` shoots, at a phone's width in both themes, other axes held
   * at their first value. Left out, it is the renderer's own view; `[]` is not shot.
   */
  baseline?: readonly GridView[];
}

/** A matrix with its props type closed over, so matrices of different components share a list. */
export interface LabMatrix {
  key: string;
  title: string;
  note: string;
  axes: readonly { name: string; labels: readonly string[] }[];
  /** The cell at one value index per axis, in the order of `axes`, at one width. */
  renderCell: (choice: readonly number[], width: CellWidth) => ReactNode;
  /** The column the wide cell takes, the default filled in. */
  wide: WideColumn;
  /** The views the visual baseline shoots, the default filled in. */
  baseline: readonly GridView[];
}

const FIRST_AXIS = 0;
const SECOND_AXIS = 1;

/** The view a matrix opens in: its first axis down, its second across, or one line. */
export function defaultViewOf(axisCount: number): GridView {
  return {
    rows: FIRST_AXIS,
    columns: Math.max(FIRST_AXIS, Math.min(SECOND_AXIS, axisCount - 1)),
  };
}

export function labMatrix<Props>(entry: MatrixEntry<Props>): LabMatrix {
  const { key, title, note, base, axes, render } = entry;
  return {
    key,
    title,
    note,
    axes: axes.map(({ name, values }) => ({ name, labels: values.map(({ label }) => label) })),
    renderCell: (choice, width) => render(propsAt(base, axes, choice), width),
    wide: entry.wide ?? "abacus",
    baseline: entry.baseline ?? [defaultViewOf(axes.length)],
  };
}

/** `base` with the chosen value of every axis laid over it; an axis left out keeps its first. */
export function propsAt<Props>(
  base: Props,
  axes: readonly MatrixAxis<Props>[],
  choice: readonly number[],
): Props {
  return axes.reduce<Props>(
    (props, axis, index) => ({ ...props, ...axis.values[choice[index] ?? 0]?.props }),
    base,
  );
}

/**
 * The choices a grid shows: every value of the row axis against every value of the column
 * axis, with each other axis held at its value in `held`. Rows and columns may be the same
 * axis, for a single line of cells.
 */
export function gridOf(
  sizes: readonly number[],
  rowAxis: number,
  columnAxis: number,
  held: readonly number[],
): number[][][] {
  const rows = sizes[rowAxis] ?? 1;
  const columns = rowAxis === columnAxis ? 1 : (sizes[columnAxis] ?? 1);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) =>
      sizes.map((_, axis) => {
        if (axis === rowAxis) return row;
        if (axis === columnAxis) return column;
        return held[axis] ?? 0;
      }),
    ),
  );
}
