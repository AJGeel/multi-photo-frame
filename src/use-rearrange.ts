"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Pointer movement before a press becomes a drag. */
const DRAG_THRESHOLD = 4;
const RETURN_MS = 150;

export interface DragState {
  /** Photos being moved, in list order. */
  ids: string[];
  /** Pointer position. */
  x: number;
  y: number;
  /** Cell under the pointer, clamped to the first empty cell. Null outside the canvas. */
  targetIndex: number | null;
  /** ⌥ held: swap instead of insert. */
  alt: boolean;
  /** The ghost is flying back to where the drag started. */
  returning: boolean;
}

interface Options {
  /** Selected ids in list order. */
  getSelection: () => string[];
  photoCount: () => number;
  select: (id: string) => void;
  /** Applies the drop. Returns false when nothing changed, so the ghost flies back. */
  drop: (ids: string[], cellIndex: number, alt: boolean) => boolean;
}

function cellUnder(x: number, y: number, photoCount: number): number | null {
  const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell-index]");
  if (!cell) return null;
  return Math.min(Number(cell.dataset.cellIndex), photoCount);
}

/** Rearranging with pointer events: press a photo, move 4 px, drop on a cell. Esc cancels. */
export function useRearrange(options: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const flyBack = useCallback(
    (origin: { x: number; y: number }) => {
      const current = dragRef.current;
      if (!current) return;
      update({ ...current, x: origin.x, y: origin.y, targetIndex: null, returning: true });
      returnTimer.current = setTimeout(() => update(null), RETURN_MS);
    },
    [update],
  );

  const press = useCallback(
    (event: ReactPointerEvent, id: string) => {
      if (event.button !== 0 || dragRef.current) return;
      cleanup.current?.();
      const origin = { x: event.clientX, y: event.clientY };
      let started = false;

      const onMove = (e: PointerEvent) => {
        if (!started) {
          if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < DRAG_THRESHOLD) return;
          started = true;
          const selection = latest.current.getSelection();
          let ids = selection;
          if (!selection.includes(id)) {
            ids = [id];
            latest.current.select(id);
          }
          if (returnTimer.current) clearTimeout(returnTimer.current);
          dragRef.current = { ids, x: e.clientX, y: e.clientY, targetIndex: null, alt: e.altKey, returning: false };
        }
        const current = dragRef.current;
        if (!current || current.returning) return;
        update({ ...current, x: e.clientX, y: e.clientY, alt: e.altKey, targetIndex: cellUnder(e.clientX, e.clientY, latest.current.photoCount()) });
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && started) {
          e.preventDefault();
          e.stopImmediatePropagation();
          stop();
          flyBack(origin);
        }
      };

      const onUp = (e: PointerEvent) => {
        stop();
        const current = dragRef.current;
        if (!started || !current) return;
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        const target = cellUnder(e.clientX, e.clientY, latest.current.photoCount());
        if (target !== null && latest.current.drop(current.ids, target, e.altKey)) update(null);
        else flyBack(origin);
      };

      const stop = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        cleanup.current = null;
      };
      const onCancel = () => {
        stop();
        if (started) flyBack(origin);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
      cleanup.current = stop;
    },
    [flyBack, update],
  );

  useEffect(
    () => () => {
      cleanup.current?.();
      if (returnTimer.current) clearTimeout(returnTimer.current);
    },
    [],
  );

  return {
    drag,
    press,
    /** True once, right after a drag ends, so the click that follows the drop is ignored. */
    consumeClick: () => suppressClick.current,
  };
}
