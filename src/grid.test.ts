import { describe, expect, it } from "vitest";
import { computeCells, type GridConfig } from "./grid";

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
