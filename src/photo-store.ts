import type { Focus, Photo } from "./photos";

/** Saved photos are dropped after this long without being touched. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DB_NAME = "multi-photo-frame";
const PHOTOS = "photos";
const META = "meta";
const SESSION_KEY = "session";

interface SessionEntry {
  id: string;
  name: string;
  width?: number;
  height?: number;
  focus?: Focus;
}

interface Session {
  savedAt: number;
  /** In display order. */
  photos: SessionEntry[];
}

interface BlobRecord {
  original: Blob;
  thumb?: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PHOTOS);
      request.result.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function blobOf(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

/** Saves the photo list. Only photos not stored yet have their files written. Never throws. */
export async function saveSession(photos: Photo[]): Promise<void> {
  try {
    const db = await openDb();
    try {
      const stored = new Set((await done(db.transaction(PHOTOS).objectStore(PHOTOS).getAllKeys())) as string[]);
      const fresh = new Map<string, BlobRecord>();
      for (const photo of photos) {
        if (stored.has(photo.id)) continue;
        fresh.set(photo.id, {
          original: await blobOf(photo.src),
          thumb: photo.thumb ? await blobOf(photo.thumb) : undefined,
        });
      }
      const alive = new Set(photos.map((p) => p.id));
      const tx = db.transaction([PHOTOS, META], "readwrite");
      const store = tx.objectStore(PHOTOS);
      for (const [id, record] of fresh) store.put(record, id);
      for (const id of stored) if (!alive.has(id)) store.delete(id);
      if (photos.length === 0) {
        tx.objectStore(META).delete(SESSION_KEY);
      } else {
        const session: Session = {
          savedAt: Date.now(),
          photos: photos.map(({ id, name, width, height, focus }) => ({ id, name, width, height, focus })),
        };
        tx.objectStore(META).put(session, SESSION_KEY);
      }
      await finished(tx);
    } finally {
      db.close();
    }
  } catch {
    // Storage can be blocked or full. The photos then stay in this tab only.
  }
}

/** Returns the saved photos with fresh object URLs, or an empty list if none or expired. Never throws. */
export async function loadSession(): Promise<Photo[]> {
  try {
    const db = await openDb();
    try {
      const session = (await done(db.transaction(META).objectStore(META).get(SESSION_KEY))) as Session | undefined;
      if (session === undefined) return [];
      if (Date.now() - session.savedAt > MAX_AGE_MS) {
        await saveSession([]);
        return [];
      }
      const store = db.transaction(PHOTOS).objectStore(PHOTOS);
      const photos: Photo[] = [];
      for (const entry of session.photos) {
        const record = (await done(store.get(entry.id))) as BlobRecord | undefined;
        if (record === undefined) continue;
        photos.push({
          ...entry,
          src: URL.createObjectURL(record.original),
          thumb: record.thumb ? URL.createObjectURL(record.thumb) : undefined,
        });
      }
      return photos;
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}
