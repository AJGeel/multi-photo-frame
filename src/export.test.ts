import { describe, expect, it } from "vitest";
import { buildPdf, coverCrop, effectiveDpi, EXPORT_DPI, exportFilename, exportSize, exportWarning, mmToPx, setJpegDpi } from "./export";

describe("export size", () => {
  it("is 300 DPI", () => {
    expect(EXPORT_DPI).toBe(300);
  });

  it("converts mm to px", () => {
    expect(mmToPx(25.4)).toBeCloseTo(300);
    expect(exportSize({ width: 297, height: 210 })).toEqual({ width: 3508, height: 2480 });
    expect(exportSize({ width: 420, height: 297 })).toEqual({ width: 4961, height: 3508 });
  });

  it("names files with size, orientation and rows x columns", () => {
    expect(exportFilename({ width: 420, height: 297, rows: 3, columns: 4 })).toBe("gallery-a3-landscape-3x4.jpg");
    expect(exportFilename({ width: 300, height: 400, rows: 2, columns: 2 }, "png")).toBe("gallery-30x40-portrait-2x2.png");
    expect(exportFilename({ width: 1500, height: 1000, rows: 1, columns: 5 }, "pdf")).toBe("gallery-1500x1000mm-landscape-1x5.pdf");
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

describe("coverCrop focus", () => {
  it("moves the crop window with the focus point", () => {
    const source = { width: 400, height: 200 };
    const target = { width: 100, height: 100 };
    expect(coverCrop(source, target, { x: 0, y: 0 }).x).toBe(0);
    expect(coverCrop(source, target, { x: 1, y: 1 }).x).toBe(200);
  });
});

describe("effectiveDpi", () => {
  const photo = { id: "a", src: "", name: "a.jpg", width: 3000, height: 2000 };

  it("is the source pixels across the cell width, per inch", () => {
    // 3000 px across a 254 mm (10 inch) wide cell of the same shape: 300 DPI.
    expect(effectiveDpi(photo, { width: 254, height: 169.333333 })).toBeCloseTo(300, 0);
  });

  it("counts only the visible part of a cropped photo", () => {
    // Square cell: 2000 source px across 100 mm.
    expect(effectiveDpi(photo, { width: 100, height: 100 })).toBeCloseTo(508, 0);
  });

  it("is null when the size is unknown", () => {
    expect(effectiveDpi({ id: "b", src: "", name: "b.jpg" }, { width: 100, height: 100 })).toBeNull();
  });
});

describe("setJpegDpi", () => {
  it("rewrites the density of an existing JFIF header", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const out = setJpegDpi(jpeg, 300);
    expect([...out.subarray(13, 18)]).toEqual([1, 1, 44, 1, 44]);
    expect(out).toHaveLength(jpeg.length);
    expect(jpeg[13]).toBe(0);
  });

  it("inserts a header when there is none", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0xff, 0xd9]);
    const out = setJpegDpi(jpeg, 300);
    expect([...out.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect([...out.subarray(13, 18)]).toEqual([1, 1, 44, 1, 44]);
    expect([...out.subarray(out.length - 4)]).toEqual([0xff, 0xdb, 0xff, 0xd9]);
  });
});

describe("buildPdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = buildPdf(jpeg, { width: 4961, height: 3508 }, { width: 420, height: 297 });
  const text = new TextDecoder("latin1").decode(pdf);

  it("sets the page to the physical size in points", () => {
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 1190.55 841.89]");
    expect(text).toContain("/Width 4961 /Height 3508");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("points every xref entry at its object", () => {
    const xrefAt = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const offsets = [...text.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(5);
    for (const [i, offset] of offsets.entries()) expect(text.slice(offset, offset + 7)).toBe(`${i + 1} 0 obj`);
  });
});
