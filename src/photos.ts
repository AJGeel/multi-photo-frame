export interface Photo {
  id: string;
  /** Object URL or data URL. */
  src: string;
  name: string;
}

/** Undo/redo covers the photo list only. Selection is not part of history. */
export interface PhotosState {
  photos: Photo[];
  /** Selected ids, kept in list order. */
  selection: string[];
  /** Last plain or toggle click, the anchor for range selection. */
  anchor: string | null;
  past: Photo[][];
  future: Photo[][];
}

export type SelectMode = "replace" | "toggle" | "range";

export type PhotosAction =
  | { type: "add"; photos: Photo[]; index?: number }
  | { type: "remove"; ids: string[] }
  /** Moves ids (kept in their current relative order) so they start at
   *  `toIndex`, an index into the list with the moved photos removed. */
  | { type: "move"; ids: string[]; toIndex: number }
  | { type: "select"; id: string; mode: SelectMode }
  | { type: "selectAll" }
  | { type: "clearSelection" }
  | { type: "undo" }
  | { type: "redo" };

export const initialPhotosState: PhotosState = {
  photos: [],
  selection: [],
  anchor: null,
  past: [],
  future: [],
};

function commit(state: PhotosState, photos: Photo[]): PhotosState {
  const alive = new Set(photos.map((p) => p.id));
  const selection = state.selection.filter((id) => alive.has(id));
  return {
    photos,
    selection,
    anchor: state.anchor !== null && alive.has(state.anchor) ? state.anchor : null,
    past: [...state.past, state.photos],
    future: [],
  };
}

function restore(state: PhotosState, photos: Photo[]): Pick<PhotosState, "photos" | "selection" | "anchor"> {
  const alive = new Set(photos.map((p) => p.id));
  return {
    photos,
    selection: state.selection.filter((id) => alive.has(id)),
    anchor: state.anchor !== null && alive.has(state.anchor) ? state.anchor : null,
  };
}

function inListOrder(photos: Photo[], ids: ReadonlySet<string>): string[] {
  return photos.filter((p) => ids.has(p.id)).map((p) => p.id);
}

export function photosReducer(state: PhotosState, action: PhotosAction): PhotosState {
  switch (action.type) {
    case "add": {
      const known = new Set(state.photos.map((p) => p.id));
      const fresh = action.photos.filter((p) => {
        if (known.has(p.id)) return false;
        known.add(p.id);
        return true;
      });
      if (fresh.length === 0) return state;
      const index = Math.min(Math.max(action.index ?? state.photos.length, 0), state.photos.length);
      const photos = [...state.photos.slice(0, index), ...fresh, ...state.photos.slice(index)];
      return commit(state, photos);
    }
    case "remove": {
      const ids = new Set(action.ids);
      const photos = state.photos.filter((p) => !ids.has(p.id));
      if (photos.length === state.photos.length) return state;
      return commit(state, photos);
    }
    case "move": {
      const ids = new Set(action.ids);
      const moving = state.photos.filter((p) => ids.has(p.id));
      if (moving.length === 0) return state;
      const rest = state.photos.filter((p) => !ids.has(p.id));
      const index = Math.min(Math.max(action.toIndex, 0), rest.length);
      const photos = [...rest.slice(0, index), ...moving, ...rest.slice(index)];
      if (photos.every((p, i) => p === state.photos[i])) return state;
      return commit(state, photos);
    }
    case "select": {
      if (!state.photos.some((p) => p.id === action.id)) return state;
      if (action.mode === "replace") {
        return { ...state, selection: [action.id], anchor: action.id };
      }
      if (action.mode === "toggle") {
        const next = new Set(state.selection);
        if (!next.delete(action.id)) next.add(action.id);
        return { ...state, selection: inListOrder(state.photos, next), anchor: action.id };
      }
      const from = state.photos.findIndex((p) => p.id === state.anchor);
      if (from === -1) {
        return { ...state, selection: [action.id], anchor: action.id };
      }
      const to = state.photos.findIndex((p) => p.id === action.id);
      const [lo, hi] = from < to ? [from, to] : [to, from];
      const selection = state.photos.slice(lo, hi + 1).map((p) => p.id);
      return { ...state, selection };
    }
    case "selectAll":
      return { ...state, selection: state.photos.map((p) => p.id) };
    case "clearSelection":
      if (state.selection.length === 0 && state.anchor === null) return state;
      return { ...state, selection: [], anchor: null };
    case "undo": {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return {
        ...restore(state, previous),
        past: state.past.slice(0, -1),
        future: [state.photos, ...state.future],
      };
    }
    case "redo": {
      const next = state.future[0];
      if (next === undefined) return state;
      return {
        ...restore(state, next),
        past: [...state.past, state.photos],
        future: state.future.slice(1),
      };
    }
  }
}

/** Converts "dropped on cell `cellIndex`" into the `toIndex` the `move` action expects. */
export function dropIndex(photos: Photo[], ids: readonly string[], cellIndex: number): number {
  const moving = new Set(ids);
  const movingBefore = photos.slice(0, Math.max(cellIndex, 0)).filter((p) => moving.has(p.id)).length;
  const restLength = photos.filter((p) => !moving.has(p.id)).length;
  return Math.min(Math.max(cellIndex - movingBefore, 0), restLength);
}
