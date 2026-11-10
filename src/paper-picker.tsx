"use client";

import type { CSSProperties } from "react";
import { PAPER_COLORS } from "./paper";
import { usePreferences } from "./preferences";

export function PaperPicker() {
  const color = usePreferences((s) => s.paperColor);
  const setColor = usePreferences((s) => s.setPaperColor);
  const current = color.toLowerCase();
  const customActive = !PAPER_COLORS.some((c) => c.value === current);
  return (
    <>
      <div role="radiogroup" aria-label="Paper colour" className="color-row">
        {PAPER_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={current === c.value}
            aria-label={c.label}
            title={c.label}
            className="color-dot"
            style={{ "--dot": c.value } as CSSProperties}
            onClick={() => setColor(c.value)}
          />
        ))}
        <label className="color-dot color-custom" data-active={customActive} title="Custom colour" style={{ "--dot": color } as CSSProperties}>
          <input type="color" aria-label="Custom paper colour" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
      </div>
      <p className="frame-note">Included in the exported image.</p>
    </>
  );
}
