import { describe, expect, it } from "vitest";
import { findPreset, isLandscape, PRESETS, presetSize } from "./presets";

describe("presets", () => {
  it("have unique ids and are defined portrait", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(p.width).toBeLessThanOrEqual(p.height);
  });

  it("have unique sizes, so a size maps back to one preset", () => {
    expect(new Set(PRESETS.map((p) => `${p.width}x${p.height}`)).size).toBe(PRESETS.length);
  });

  it("include the ISO A series with the exact mm sizes", () => {
    const a4 = PRESETS.find((p) => p.id === "a4");
    expect(a4).toMatchObject({ width: 210, height: 297 });
    expect(PRESETS.find((p) => p.id === "a3")).toMatchObject({ width: 297, height: 420 });
  });

  it("applies orientation and finds presets in either orientation", () => {
    const a4 = PRESETS.find((p) => p.id === "a4")!;
    expect(presetSize(a4, true)).toEqual({ width: 297, height: 210 });
    expect(presetSize(a4, false)).toEqual({ width: 210, height: 297 });
    expect(findPreset({ width: 297, height: 210 })).toBe(a4);
    expect(findPreset({ width: 123, height: 456 })).toBeUndefined();
  });

  it("treats squares as landscape", () => {
    expect(isLandscape({ width: 200, height: 200 })).toBe(true);
  });
});
