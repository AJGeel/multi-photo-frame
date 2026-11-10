"use client";

import { useEffect, useRef, useState } from "react";

export interface FileDropState {
  /** Number of items being dragged. */
  count: number;
  /** Cell under the pointer, or null to append. */
  cellIndex: number | null;
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

/**
 * Files dragged in from the desktop, anywhere in the window. A depth counter keeps the overlay from flickering
 * as the pointer crosses elements. `onDrop` gets the files and the cell they landed on.
 */
export function useFileDrop(onDrop: (files: File[], cellIndex: number | null) => void, photoCount: () => number) {
  const [state, setState] = useState<FileDropState | null>(null);
  const latest = useRef({ onDrop, photoCount });
  useEffect(() => {
    latest.current = { onDrop, photoCount };
  });

  useEffect(() => {
    let depth = 0;
    let count = 0;
    let cellIndex: number | null = null;

    const cellAt = (event: DragEvent) => {
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-cell-index]");
      return cell ? Math.min(Number(cell.dataset.cellIndex), latest.current.photoCount()) : null;
    };

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      count = event.dataTransfer?.items.length ?? 0;
      setState({ count, cellIndex });
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      const next = cellAt(event);
      if (next !== cellIndex) {
        cellIndex = next;
        setState({ count, cellIndex });
      }
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(depth - 1, 0);
      if (depth === 0) {
        cellIndex = null;
        setState(null);
      }
    };
    const onDropEvent = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      const target = cellAt(event);
      depth = 0;
      cellIndex = null;
      setState(null);
      latest.current.onDrop([...(event.dataTransfer?.files ?? [])], target);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDropEvent);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDropEvent);
    };
  }, []);

  return state;
}
