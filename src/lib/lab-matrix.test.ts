import { describe, expect, it } from "vitest";
import { defaultViewOf, gridOf, labMatrix, propsAt, type MatrixAxis } from "./lab-matrix";

interface Props {
  state: string;
  name: string;
  isDark: boolean;
}

const BASE: Props = { state: "complete", name: "Honen-in", isDark: false };
const AXES: MatrixAxis<Props>[] = [
  {
    name: "state",
    values: [
      { label: "skeleton", props: { state: "skeleton" } },
      { label: "streaming", props: { state: "streaming" } },
    ],
  },
  {
    name: "data",
    values: [
      { label: "short", props: { name: "M+" } },
      { label: "long", props: { name: "Basílica i Temple Expiatori de la Sagrada Família" } },
      { label: "as base", props: {} },
    ],
  },
];

describe("props at a choice", () => {
  it("lay each axis's value over the base, in order", () => {
    expect(propsAt(BASE, AXES, [1, 0])).toEqual({ state: "streaming", name: "M+", isDark: false });
  });

  it("keep an axis's first value when the choice leaves it out", () => {
    expect(propsAt(BASE, AXES, [1])).toEqual({ ...BASE, state: "streaming", name: "M+" });
  });

  it("keep the base where a value sets nothing", () => {
    expect(propsAt(BASE, AXES, [0, 2])).toEqual({ ...BASE, state: "skeleton" });
  });
});

describe("a grid", () => {
  it("runs one axis down and one across, holding the rest", () => {
    expect(gridOf([2, 3, 4], 1, 0, [0, 0, 3])).toEqual([
      [
        [0, 0, 3],
        [1, 0, 3],
      ],
      [
        [0, 1, 3],
        [1, 1, 3],
      ],
      [
        [0, 2, 3],
        [1, 2, 3],
      ],
    ]);
  });

  it("is a single line when rows and columns are the same axis", () => {
    expect(gridOf([2, 3], 0, 0, [0, 1])).toEqual([[[0, 1]], [[1, 1]]]);
  });
});

describe("a lab matrix", () => {
  const matrix = labMatrix<Props>({
    key: "test",
    title: "Test",
    note: "A matrix for the test",
    base: BASE,
    axes: AXES,
    render: (props, width) => `${props.state}: ${props.name} (${width})`,
  });

  it("lists each axis by name with its labels", () => {
    expect(matrix.axes).toEqual([
      { name: "state", labels: ["skeleton", "streaming"] },
      { name: "data", labels: ["short", "long", "as base"] },
    ]);
  });

  it("renders the cell at a choice and a width", () => {
    expect(matrix.renderCell([0, 1], "phone")).toBe(
      "skeleton: Basílica i Temple Expiatori de la Sagrada Família (phone)",
    );
    expect(matrix.renderCell([1, 0], "wide")).toBe("streaming: M+ (wide)");
  });
});

describe("a matrix's wide cell", () => {
  const entry = {
    key: "test",
    title: "Test",
    note: "A matrix for the test",
    base: BASE,
    axes: AXES,
    render: (props: Props) => props.name,
  };

  it("takes the abacus column, where the chart's parts stand, unless the entry says", () => {
    expect(labMatrix<Props>(entry).wide).toBe("abacus");
  });

  it("takes the column the entry declares, the component's on a laptop", () => {
    expect(labMatrix<Props>({ ...entry, wide: "page" }).wide).toBe("page");
  });
});

describe("a matrix's baseline", () => {
  const entry = {
    key: "test",
    title: "Test",
    note: "A matrix for the test",
    base: BASE,
    axes: AXES,
    render: (props: Props) => props.name,
  };

  it("is the renderer's own view when the entry declares none", () => {
    expect(labMatrix<Props>(entry).baseline).toEqual([{ rows: 0, columns: 1 }]);
  });

  it("runs a single axis down a single line", () => {
    expect(labMatrix<Props>({ ...entry, axes: AXES.slice(0, 1) }).baseline).toEqual([
      { rows: 0, columns: 0 },
    ]);
  });

  it("keeps the views an entry declares, and none when it declares none", () => {
    const views = [{ rows: 1, columns: 0 }];
    expect(labMatrix<Props>({ ...entry, baseline: views }).baseline).toEqual(views);
    expect(labMatrix<Props>({ ...entry, baseline: [] }).baseline).toEqual([]);
  });
});

describe("a matrix's default view", () => {
  it("runs the first axis down and the second across", () => {
    expect(defaultViewOf(3)).toEqual({ rows: 0, columns: 1 });
  });

  it("is a single line for a single axis", () => {
    expect(defaultViewOf(1)).toEqual({ rows: 0, columns: 0 });
  });
});
