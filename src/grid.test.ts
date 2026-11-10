import { describe, expect, it } from "vitest";
import { computeCells, sanitizeConfig, suggestGrid, type GridConfig } from "./grid";

const base: GridConfig = {
  rows: 2,
  columns: 3,
  spacingX: 10,
  spacingY: 20,
  padding: 5,
  width: 320,
  height: 250,
};

describe("computeCells", () => {
  it("returns rows * columns cells in row-major order", () => {
    const cells = computeCells(base);
    expect(cells).toHaveLength(6);
    expect(cells[0]).toMatchObject({ x: 5, y: 5 });
    expect(cells[3]?.y).toBeGreaterThan(cells[0]!.y);
  });

  it("sizes cells so the grid fills the canvas minus padding", () => {
    const cells = computeCells(base);
    const last = cells.at(-1)!;
    expect(last.x + last.width).toBeCloseTo(base.width - base.padding);
    expect(last.y + last.height).toBeCloseTo(base.height - base.padding);
  });

  it("applies horizontal and vertical spacing independently", () => {
    const [a, b, , d] = computeCells(base);
    expect(b!.x - (a!.x + a!.width)).toBeCloseTo(base.spacingX);
    expect(d!.y - (a!.y + a!.height)).toBeCloseTo(base.spacingY);
  });
});

describe("sanitizeConfig", () => {
  const valid = { rows: 2, columns: 3, spacingX: 10, spacingY: 10, padding: 20, width: 1000, height: 800 };

  it("leaves valid config alone", () => {
    expect(sanitizeConfig(valid)).toEqual(valid);
  });

  it("keeps 0.1mm precision", () => {
    expect(sanitizeConfig({ ...valid, spacingX: 2.54, padding: 12.34 })).toMatchObject({ spacingX: 2.5, padding: 12.3 });
  });

  it("clamps rows, columns and negatives, and rejects NaN", () => {
    const result = sanitizeConfig({ ...valid, rows: 0, columns: Number.NaN, spacingX: -5, padding: -1 });
    expect(result).toMatchObject({ rows: 1, columns: 1, spacingX: 0, padding: 0 });
  });

  it("keeps every cell at least 1mm", () => {
    const result = sanitizeConfig({ ...valid, padding: 5000, spacingX: 5000, spacingY: 5000, width: 297, height: 210 });
    for (const cell of computeCells(result)) {
      expect(cell.width).toBeGreaterThanOrEqual(1);
      expect(cell.height).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("suggestGrid", () => {
  it("holds every photo with as few spare cells as it can", () => {
    for (const count of [1, 7, 13, 14, 20]) {
      const { rows, columns } = suggestGrid(count, base);
      expect(rows * columns).toBeGreaterThanOrEqual(count);
      expect(rows * columns - count).toBeLessThan(Math.max(columns, rows));
    }
  });
});
