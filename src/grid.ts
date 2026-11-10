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
