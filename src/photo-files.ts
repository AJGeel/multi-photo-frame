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

/** Loads files a few at a time, keeping their order. Failed files are null. */
export async function loadPhotos(files: File[]): Promise<(Photo | null)[]> {
  const results: (Photo | null)[] = Array.from({ length: files.length }, () => null);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const index = next++;
      results[index] = await loadPhoto(files[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
  return results;
}
