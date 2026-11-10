export interface GridConfig {
  rows: number;
  columns: number;
  /** Horizontal gap between cells. */
  spacingX: number;
  /** Vertical gap between cells. */
  spacingY: number;
  padding: number;
  /** Total canvas size. */
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Returns one rect per cell, row-major. */
export function computeCells(config: GridConfig): Rect[] {
  const { rows, columns, spacingX, spacingY, padding, width, height } = config;
  const cellWidth = (width - 2 * padding - spacingX * (columns - 1)) / columns;
  const cellHeight = (height - 2 * padding - spacingY * (rows - 1)) / rows;
  const cells: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      cells.push({
        x: padding + col * (cellWidth + spacingX),
        y: padding + row * (cellHeight + spacingY),
        width: cellWidth,
        height: cellHeight,
      });
    }
  }
  return cells;
}

const MAX_CELLS_PER_AXIS = 50;
/** Largest canvas side in mm (5 m). */
const MAX_SIZE = 5000;

function whole(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/** Rounds to 0.1 (mm) and clamps. */
function tenth(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value * 10) / 10, min), max);
}

function floorTenth(value: number): number {
  return Math.floor(value * 10 + 1e-9) / 10;
}

/** Clamps config values coming from the UI so `computeCells` gets valid input:
 *  at least 1 row and column, no negative gaps, and cells that keep a positive size.
 *  Lengths are in mm, rounded to 0.1. */
export function sanitizeConfig(config: GridConfig): GridConfig {
  const width = tenth(config.width, 1, MAX_SIZE);
  const height = tenth(config.height, 1, MAX_SIZE);
  const columns = whole(config.columns, 1, MAX_CELLS_PER_AXIS);
  const rows = whole(config.rows, 1, MAX_CELLS_PER_AXIS);
  // Leave at least 1mm per cell: padding and gaps may not eat the whole canvas.
  const padding = tenth(config.padding, 0, Math.max(floorTenth(Math.min(width - columns, height - rows) / 2), 0));
  const maxSpacingX = floorTenth((width - 2 * padding - columns) / Math.max(columns - 1, 1));
  const maxSpacingY = floorTenth((height - 2 * padding - rows) / Math.max(rows - 1, 1));
  const spacingX = tenth(config.spacingX, 0, Math.max(maxSpacingX, 0));
  const spacingY = tenth(config.spacingY, 0, Math.max(maxSpacingY, 0));
  return { rows, columns, spacingX, spacingY, padding, width, height };
}
