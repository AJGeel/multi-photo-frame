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

interface DecodedPhoto {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Frees the decoded pixels now, instead of waiting for garbage collection. */
  release: () => void;
}

/**
 * Decodes one photo for drawing. An ImageBitmap can be closed right after use, so a hundred
 * full-size photos never sit in memory at once. Browsers that run low on memory drop decoded
 * images silently, which leaves empty cells in the export.
 */
async function decodePhoto(src: string): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === "function") {
    const blob = await (await fetch(src)).blob();
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const image = new Image();
  image.src = src;
  await image.decode();
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => (image.src = "") };
}

export interface RenderOptions {
  /** Called after each photo is drawn. */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Paper colour, as a hex string. Defaults to white. */
  paperColor?: string;
}

/** Draws the grid on a canvas of the paper colour at `EXPORT_DPI`. Photos beyond the cell count are skipped. */
export async function renderFrame(config: GridConfig, photos: Photo[], options: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const size = exportSize(config);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Could not create a drawing surface. The size is probably too large for this browser.");
  context.fillStyle = options.paperColor ?? "#ffffff";
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
    const decoded = await decodePhoto(photo.src);
    try {
      const crop = coverCrop({ width: decoded.width, height: decoded.height }, target, photo.focus);
      context.drawImage(decoded.source, crop.x, crop.y, crop.width, crop.height, left, top, target.width, target.height);
    } finally {
      decoded.release();
    }
    options.onProgress?.(index + 1, total);
    // Let the page repaint between photos so progress shows.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  options.signal?.throwIfAborted();
  return canvas;
}

export type ExportFormat = "jpeg" | "png" | "pdf";

export interface ExportOptions {
  format: ExportFormat;
  /** JPEG quality in percent, 50 to 100. Used by JPEG and PDF. */
  quality: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = { format: "jpeg", quality: 95 };

export const FORMAT_LABELS: Record<ExportFormat, string> = { jpeg: "JPEG", png: "PNG", pdf: "PDF" };
const EXTENSIONS: Record<ExportFormat, string> = { jpeg: "jpg", png: "png", pdf: "pdf" };

/** For example `gallery-a3-landscape-3x4.jpg`: size, orientation, rows x columns. */
export function exportFilename(config: Pick<GridConfig, "width" | "height" | "rows" | "columns">, format: ExportFormat = "jpeg"): string {
  const size = findPreset(config)?.id ?? `${config.width}x${config.height}mm`;
  const orientation = isLandscape(config) ? "landscape" : "portrait";
  return `gallery-${size}-${orientation}-${config.rows}x${config.columns}.${EXTENSIONS[format]}`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error("The browser could not encode the image. The size is probably too large.")) : resolve(blob)),
      type,
      quality,
    );
  });
}

/** Writes the print resolution into a JPEG's JFIF header, so editors open it at its real size. */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const isJfif = jpeg[2] === 0xff && jpeg[3] === 0xe0 && jpeg[6] === 0x4a && jpeg[7] === 0x46 && jpeg[8] === 0x49 && jpeg[9] === 0x46;
  const density = [1, (dpi >> 8) & 0xff, dpi & 0xff, (dpi >> 8) & 0xff, dpi & 0xff];
  if (isJfif) {
    const out = jpeg.slice();
    out.set(density, 13); // units (1 = per inch), then X and Y density
    return out;
  }
  // No JFIF header: insert one right after the start-of-image marker.
  const header = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, ...density, 0x00, 0x00];
  const out = new Uint8Array(jpeg.length + header.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(header, 2);
  out.set(jpeg.subarray(2), 2 + header.length);
  return out;
}

/** A one-page PDF at the exact physical size, holding the JPEG as-is. No library needed. */
export function buildPdf(jpeg: Uint8Array, pixels: { width: number; height: number }, mm: { width: number; height: number }): Uint8Array<ArrayBuffer> {
  const pt = (value: number) => ((value / MM_PER_INCH) * 72).toFixed(2);
  const width = pt(mm.width);
  const height = pt(mm.height);
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}`);
    if (stream) {
      push("\nstream\n");
      push(stream);
      push("\nendstream");
    }
    push("\nendobj\n");
  };

  push("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${pixels.width} /Height ${pixels.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg,
  );
  object(5, `<< /Length ${content.length} >>`, encoder.encode(content));
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((id) => `${String(offsets[id]).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}

/** Encodes the rendered canvas in the chosen format. */
export async function encodeCanvas(canvas: HTMLCanvasElement, config: GridConfig, options: ExportOptions): Promise<Blob> {
  if (options.format === "png") return canvasToBlob(canvas);
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", options.quality / 100);
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  if (options.format === "jpeg") return new Blob([setJpegDpi(jpeg, EXPORT_DPI)], { type: "image/jpeg" });
  return new Blob([buildPdf(jpeg, { width: canvas.width, height: canvas.height }, config)], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
