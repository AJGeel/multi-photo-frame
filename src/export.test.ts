import { describe, expect, it } from "vitest";
import { coverCrop, EXPORT_DPI, exportFilename, exportSize, exportWarning, mmToPx } from "./export";

describe("export size", () => {
  it("is 300 DPI", () => {
    expect(EXPORT_DPI).toBe(300);
  });

  it("converts mm to px", () => {
    expect(mmToPx(25.4)).toBeCloseTo(300);
    expect(exportSize({ width: 297, height: 210 })).toEqual({ width: 3508, height: 2480 });
    expect(exportSize({ width: 420, height: 297 })).toEqual({ width: 4961, height: 3508 });
  });

  it("names files with size and DPI", () => {
    expect(exportFilename({ width: 420, height: 297 })).toBe("gallery-frame-420x297mm-300dpi.png");
  });
});

describe("exportWarning", () => {
  it("is quiet for common sizes, up to A0", () => {
    expect(exportWarning({ width: 420, height: 297 })).toBeNull();
    expect(exportWarning({ width: 841, height: 1189 })).toBeNull();
  });

  it("warns past the canvas side limit", () => {
    expect(exportWarning({ width: 1500, height: 100 })).toContain("17717 × 1181 px");
  });
});

describe("coverCrop", () => {
  it("crops the sides of a wide photo in a square cell", () => {
    expect(coverCrop({ width: 400, height: 200 }, { width: 100, height: 100 })).toEqual({ x: 100, y: 0, width: 200, height: 200 });
  });

  it("crops top and bottom of a tall photo in a wide cell", () => {
    expect(coverCrop({ width: 200, height: 400 }, { width: 200, height: 100 })).toEqual({ x: 0, y: 150, width: 200, height: 100 });
  });

  it("uses the whole photo when the ratios match", () => {
    expect(coverCrop({ width: 300, height: 200 }, { width: 30, height: 20 })).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });
});
