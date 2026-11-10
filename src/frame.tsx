"use client";

import type { CSSProperties, ReactNode } from "react";
import { FRAME_STYLES, type FrameStyle } from "./frames";

/** Draws a frame around the paper: four mitred sides, lit from the top left. Preview only. */
export function Frame({ style, width, children }: { style: FrameStyle; /** Moulding width in px. */ width: number; children: ReactNode }) {
  return (
    <div className="framed" data-frame={style} style={{ "--f": `${style === "none" ? 0 : width}px` } as CSSProperties}>
      <span className="frame-side top" aria-hidden="true" />
      <span className="frame-side left" aria-hidden="true" />
      <span className="frame-side right" aria-hidden="true" />
      <span className="frame-side bottom" aria-hidden="true" />
      {children}
    </div>
  );
}

export function FramePicker({ value, onChange }: { value: FrameStyle; onChange: (style: FrameStyle) => void }) {
  return (
    <>
      <div role="radiogroup" aria-label="Frame style" className="frame-grid">
        {FRAME_STYLES.map((style) => (
          <button key={style.id} type="button" role="radio" aria-checked={value === style.id} className="frame-choice" onClick={() => onChange(style.id)}>
            <span className="frame-swatch" data-frame={style.id} />
            {style.label}
          </button>
        ))}
      </div>
      <p className="frame-note">{value === "none" ? "Preview your layout inside a frame." : "Preview only, not part of the exported image."}</p>
    </>
  );
}
