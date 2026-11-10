import { computeCells, type GridConfig } from "./grid";
import { findPreset, isLandscape } from "./presets";
import type { Focus, Photo } from "./photos";

/** Fixed for now. See "Future improvements" in HANDOFF.md. */
export const EXPORT_DPI = 300;

const MM_PER_INCH = 25.4;

/** Desktop Chrome canvas limit per side (area is capped at the same value squared). Safari and mobile browsers allow less. */
export const MAX_CANVAS_SIDE = 16_384;

export function mmToPx(mm: number, dpi = EXPORT_DPI): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function exportSize(config: Pick<GridConfig, "width" | "height">, dpi = EXPORT_DPI): { width: number; height: number } {
  return { width: Math.round(mmToPx(config.width, dpi)), height: Math.round(mmToPx(config.height, dpi)) };
}

/** A warning if the export is likely to exceed what browsers can render, otherwise null. */
export function exportWarning(config: Pick<GridConfig, "width" | "height">, dpi = EXPORT_DPI): string | null {
  const { width, height } = exportSize(config, dpi);
  if (Math.max(width, height) > MAX_CANVAS_SIDE) {
    return `At ${dpi} DPI this is ${width} × ${height} px, which is more than most browsers can render. The export will probably fail. Choose a smaller size.`;
  }
  return null;
}

/** True when either side is over what browsers can render. */
export function isOversize(config: Pick<GridConfig, "width" | "height">, dpi = EXPORT_DPI): boolean {
  const { width, height } = exportSize(config, dpi);
  return Math.max(width, height) > MAX_CANVAS_SIDE;
}

/** Source rectangle that fills the target box (object-fit: cover). `focus` is object-position: centre by default. */
export function coverCrop(
  source: { width: number; height: number },
  target: { width: number; height: number },
  focus: Focus = { x: 0.5, y: 0.5 },
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = target.width / scale;
  const height = target.height / scale;
  return { x: (source.width - width) * focus.x, y: (source.height - height) * focus.y, width, height };
}

/** Print resolution of a photo in a cell of `cellWidthMm`, after cropping. Null when the photo size is unknown. */
export function effectiveDpi(photo: Photo, cell: { width: number; height: number }): number | null {
  if (!photo.width || !photo.height) return null;
  const crop = coverCrop({ width: photo.width, height: photo.height }, cell);
  return crop.width / (cell.width / MM_PER_INCH);
}

/** Photos below this resolution in their cell get a warning. */
export const LOW_RES_DPI = 150;

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

export interface RenderOptions {
  /** Called after each photo is drawn. */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** Draws the grid on a white canvas at `EXPORT_DPI`. Photos beyond the cell count are skipped. */
export async function renderFrame(config: GridConfig, photos: Photo[], options: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const size = exportSize(config);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Could not create a drawing surface. The size is probably too large for this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingQuality = "high";

  const cells = computeCells(config);
  const total = Math.min(cells.length, photos.length);
  options.onProgress?.(0, total);
  for (const [index, cell] of cells.entries()) {
    const photo = photos[index];
    if (photo === undefined) break;
    options.signal?.throwIfAborted();
    // Round the edges, not the sizes, so neighbouring cells never leave seams.
    const left = Math.round(mmToPx(cell.x));
    const top = Math.round(mmToPx(cell.y));
    const target = { width: Math.round(mmToPx(cell.x + cell.width)) - left, height: Math.round(mmToPx(cell.y + cell.height)) - top };
    const image = await loadImage(photo.src);
    const crop = coverCrop({ width: image.naturalWidth, height: image.naturalHeight }, target, photo.focus);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, left, top, target.width, target.height);
    options.onProgress?.(index + 1, total);
    // Let the page repaint between photos so progress shows.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  options.signal?.throwIfAborted();
  return canvas;
}

/** For example `gallery-a3-landscape-3x4.png`: size, orientation, rows x columns. */
export function exportFilename(config: Pick<GridConfig, "width" | "height" | "rows" | "columns">): string {
  const size = findPreset(config)?.id ?? `${config.width}x${config.height}mm`;
  const orientation = isLandscape(config) ? "landscape" : "portrait";
  return `gallery-${size}-${orientation}-${config.rows}x${config.columns}.png`;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error("The browser could not encode the image. The size is probably too large.")) : resolve(blob)), "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
