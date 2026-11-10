import type { Photo } from "./photos";

/** Longest side of the preview image. The export always uses the original file. */
const THUMB_SIDE = 800;
/** Photos decoded at once. Decoding hundreds of full-size photos together can exhaust memory. */
const CONCURRENCY = 3;

async function thumbnail(bitmap: ImageBitmap): Promise<Blob | null> {
  const scale = Math.min(1, THUMB_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.round(bitmap.width * scale), 1);
  canvas.height = Math.max(Math.round(bitmap.height * scale), 1);
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
}

/**
 * Reads one file into a photo, or null if the browser can't decode it. The photo keeps the original
 * for export and a small preview for the screen, so a few hundred photos stay light on memory.
 */
export async function loadPhoto(file: File): Promise<Photo | null> {
  // Object URLs are not revoked on remove, because undo can bring the photo back.
  const src = URL.createObjectURL(file);
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      try {
        const blob = await thumbnail(bitmap);
        return {
          id: crypto.randomUUID(),
          src,
          thumb: blob ? URL.createObjectURL(blob) : undefined,
          name: file.name,
          width: bitmap.width,
          height: bitmap.height,
        };
      } finally {
        bitmap.close();
      }
    }
    const image = new Image();
    image.src = src;
    await image.decode();
    return { id: crypto.randomUUID(), src, name: file.name, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    URL.revokeObjectURL(src);
    return null;
  }
}

export interface LoadOptions {
  /** Called after each file, whether it loaded or failed. */
  onProgress?: (done: number, total: number) => void;
  /** Stops starting new files. Files already loading finish. */
  signal?: AbortSignal;
}

export interface LoadResult {
  /** Photos that loaded, in the order of the files. */
  photos: Photo[];
  /** Files the browser couldn't decode. */
  failed: number;
  /** Files never started because the import was cancelled. */
  cancelled: number;
}

/** Loads files a few at a time, keeping their order, and hands the main thread back between files. */
export async function loadPhotos(files: File[], options: LoadOptions = {}): Promise<LoadResult> {
  const results: (Photo | null | undefined)[] = Array.from({ length: files.length }, () => undefined);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < files.length && !options.signal?.aborted) {
      const index = next++;
      results[index] = await loadPhoto(files[index]!);
      options.onProgress?.(++done, files.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
  return {
    photos: results.filter((photo): photo is Photo => photo != null),
    failed: results.filter((photo) => photo === null).length,
    cancelled: results.filter((photo) => photo === undefined).length,
  };
}
