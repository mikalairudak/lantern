"use client";

import { MotionConfig } from "motion/react";
import { useState } from "react";
import { defaultViewOf, gridOf, type CellWidth, type WideColumn } from "@/lib/lab-matrix";
import { matrixOf } from "./matrices";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

/**
 * A phone's screen, from the width tokens. A phone cell is a container, so the title and
 * display sizes, which grow with `cqi`, read as on a phone in any viewport.
 */
const PHONE_CLASSES = "@container w-phone";
/**
 * The page's gutters on a phone (`px-4` in `day.tsx`), so a component in a phone cell takes
 * the width the page gives it there: 358 px of a 390 px phone. Inside the container, not on
 * it, so `cqi` and a list's bounds still read the whole screen, as on a phone.
 */
const PHONE_GUTTER_CLASSES = "px-4";
/**
 * The column a component takes on a laptop, from the width tokens: the abacus beside a wide
 * screen's intro, or the page's, whose header stands in its gutter. A wide cell is not a
 * container: as one it would get its own width's type, not a laptop's, so it keeps the
 * viewport's.
 */
const WIDE_CLASSES: Record<WideColumn, string> = { abacus: "w-abacus", page: "w-page" };

const THEME_VIEWS = { both: THEMES, light: ["light"], dark: ["dark"] } as const;
type ThemeView = keyof typeof THEME_VIEWS;

const CONTROL_CLASSES = "rounded-sm border border-line bg-surface px-3 py-1 text-small text-ink";
const LABEL_CLASSES = "flex flex-col gap-1 text-small text-muted";
// The border sits outside the width, so a phone cell holds a phone's 390 px and a wide cell
// its whole column: inside it, a 388 px cell broke lines a phone does not.
const CELL_CLASSES =
  "box-content shrink-0 overflow-hidden rounded-md border border-line bg-ground text-ink";

interface MatrixViewProps {
  matrixKey: string;
}

/**
 * Lays a component's matrix out as a grid: one axis down the rows, one across the columns,
 * every other held at one value, and each cell in both themes at one width. The page
 * scrolls the grid sideways inside itself, never the page.
 */
export function MatrixView({ matrixKey }: MatrixViewProps) {
  const matrix = matrixOf(matrixKey);
  const defaultView = defaultViewOf(matrix?.axes.length ?? 1);
  const [rowAxis, setRowAxis] = useState(defaultView.rows);
  const [columnAxis, setColumnAxis] = useState(defaultView.columns);
  const [held, setHeld] = useState<number[]>(() => matrix?.axes.map(() => 0) ?? []);
  const [width, setWidth] = useState<CellWidth>("phone");
  const [themeView, setThemeView] = useState<ThemeView>("both");
  if (!matrix) return null;

  const { axes } = matrix;
  const grid = gridOf(
    axes.map(({ labels }) => labels.length),
    rowAxis,
    columnAxis,
    held,
  );
  const labelOf = (axis: number, index: number): string => axes[axis]?.labels[index] ?? "";
  const widthClasses = width === "phone" ? PHONE_CLASSES : WIDE_CLASSES[matrix.wide];
  const isSingleLine = rowAxis === columnAxis;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-4">
        <AxisPicker label="Rows" axes={axes} value={rowAxis} onChange={setRowAxis} />
        <AxisPicker label="Columns" axes={axes} value={columnAxis} onChange={setColumnAxis} />
        {axes.map(({ name, labels }, axis) =>
          axis === rowAxis || axis === columnAxis ? null : (
            <label key={name} className={LABEL_CLASSES}>
              {name}
              <select
                className={CONTROL_CLASSES}
                value={held[axis] ?? 0}
                onChange={(event) => {
                  const next = [...held];
                  next[axis] = Number(event.target.value);
                  setHeld(next);
                }}
              >
                {labels.map((valueLabel, index) => (
                  <option key={valueLabel} value={index}>
                    {valueLabel}
                  </option>
                ))}
              </select>
            </label>
          ),
        )}
        <label className={LABEL_CLASSES}>
          Width
          <select
            className={CONTROL_CLASSES}
            value={width}
            onChange={(event) => setWidth(event.target.value as CellWidth)}
          >
            <option value="phone">Phone</option>
            <option value="wide">Wide screen</option>
          </select>
        </label>
        <label className={LABEL_CLASSES}>
          Theme
          <select
            className={CONTROL_CLASSES}
            value={themeView}
            onChange={(event) => setThemeView(event.target.value as ThemeView)}
          >
            <option value="both">Both</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      {/* The baseline's views ride on the grid, so `pnpm e2e:visual` reads them from the
          page rather than importing the matrices. */}
      <div
        className="overflow-x-auto"
        data-testid="matrix-grid"
        data-baseline={JSON.stringify(matrix.baseline)}
      >
        <div className="flex w-max flex-col gap-10">
          {grid.map((row, rowIndex) => (
            <section key={rowIndex} className="flex flex-col gap-3">
              <h2 className="type-name text-quote">{labelOf(rowAxis, rowIndex)}</h2>
              <div className="flex gap-8">
                {row.map((choice, columnIndex) => (
                  // Keyed by the choice, not the position: when the axes change, a cell
                  // that keeps its own state must start again rather than carry it over.
                  <figure key={choice.join(",")} className="flex flex-col gap-2">
                    {!isSingleLine && (
                      <figcaption className="text-small text-muted">
                        {labelOf(columnAxis, columnIndex)}
                      </figcaption>
                    )}
                    <div className="flex gap-3">
                      {THEME_VIEWS[themeView].map((theme: Theme) => (
                        <div
                          key={theme}
                          data-theme={theme}
                          aria-label={`${theme} theme`}
                          className={`${CELL_CLASSES} ${widthClasses}`}
                        >
                          {/* As in the day: under reduced motion a move or a resize lands
                              at once. A fade or a colour still eases, and a screenshot
                              waits until two frames match. */}
                          <MotionConfig reducedMotion="user">
                            {width === "phone" ? (
                              <div className={PHONE_GUTTER_CLASSES}>
                                {matrix.renderCell(choice, width)}
                              </div>
                            ) : (
                              matrix.renderCell(choice, width)
                            )}
                          </MotionConfig>
                        </div>
                      ))}
                    </div>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AxisPickerProps {
  label: string;
  axes: readonly { name: string }[];
  value: number;
  onChange: (axis: number) => void;
}

function AxisPicker({ label, axes, value, onChange }: AxisPickerProps) {
  return (
    <label className={LABEL_CLASSES}>
      {label}
      <select
        className={CONTROL_CLASSES}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {axes.map(({ name }, axis) => (
          <option key={name} value={axis}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
