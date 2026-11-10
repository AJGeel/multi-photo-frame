"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const THRESHOLD = 4;

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Options {
  getSelection: () => string[];
  setSelection: (ids: string[]) => void;
  /** Elements that start no marquee when pressed, such as photos and buttons. */
  ignore: string;
}

/** Selecting photos by dragging a rectangle over them, like on a desktop. Shift or Ctrl/Cmd adds to the selection. */
export function useMarquee({ getSelection, setSelection, ignore }: Options) {
  const [rect, setRect] = useState<MarqueeRect | null>(null);
  const suppressClick = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  const latest = useRef({ getSelection, setSelection });
  useEffect(() => {
    latest.current = { getSelection, setSelection };
  });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      if ((event.target as Element).closest(ignore)) return;
      cleanup.current?.();
      const origin = { x: event.clientX, y: event.clientY };
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const base = additive ? latest.current.getSelection() : [];
      let started = false;
      let targets: { id: string; box: DOMRect }[] = [];
      let last = "";

      const apply = (ids: string[]) => {
        const key = ids.join("\n");
        if (key === last) return;
        last = key;
        latest.current.setSelection(ids);
      };

      const onMove = (e: PointerEvent) => {
        if (!started) {
          if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < THRESHOLD) return;
          started = true;
          targets = [...document.querySelectorAll<HTMLElement>("[data-photo-id]")].map((el) => ({ id: el.dataset.photoId!, box: el.getBoundingClientRect() }));
          if (!additive) apply([]);
        }
        const box = {
          left: Math.min(origin.x, e.clientX),
          top: Math.min(origin.y, e.clientY),
          width: Math.abs(e.clientX - origin.x),
          height: Math.abs(e.clientY - origin.y),
        };
        setRect(box);
        const hit = targets
          .filter((t) => t.box.left < box.left + box.width && t.box.right > box.left && t.box.top < box.top + box.height && t.box.bottom > box.top)
          .map((t) => t.id);
        apply([...new Set([...base, ...hit])]);
      };

      const finish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("keydown", onKey, true);
        cleanup.current = null;
        setRect(null);
      };
      const onUp = () => {
        finish();
        if (started) {
          suppressClick.current = true;
          setTimeout(() => (suppressClick.current = false), 0);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && started) {
          e.preventDefault();
          e.stopImmediatePropagation();
          finish();
          apply(base);
          suppressClick.current = true;
          setTimeout(() => (suppressClick.current = false), 0);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("keydown", onKey, true);
      cleanup.current = finish;
    },
    [ignore],
  );

  useEffect(() => () => cleanup.current?.(), []);

  return { rect, onPointerDown, consumeClick: () => suppressClick.current };
}
