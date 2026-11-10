export interface SizePreset {
  id: string;
  label: string;
  /** Millimetres, portrait (width <= height). */
  width: number;
  height: number;
}

const preset = (id: string, label: string, width: number, height: number): SizePreset => ({ id, label, width, height });

/** Sizes common in Europe: ISO 216 paper, photo prints and metric frame sizes (cm in the shops). */
export const PRESET_GROUPS: { label: string; presets: SizePreset[] }[] = [
  {
    label: "Paper (ISO A)",
    presets: [
      preset("a5", "A5", 148, 210),
      preset("a4", "A4", 210, 297),
      preset("a3", "A3", 297, 420),
      preset("a2", "A2", 420, 594),
      preset("a1", "A1", 594, 841),
      preset("a0", "A0", 841, 1189),
    ],
  },
  {
    label: "Photo prints",
    presets: [preset("10x15", "10 × 15 cm", 100, 150), preset("13x18", "13 × 18 cm", 130, 180)],
  },
  {
    label: "Frames",
    presets: [
      preset("15x20", "15 × 20 cm", 150, 200),
      preset("18x24", "18 × 24 cm", 180, 240),
      preset("20x30", "20 × 30 cm", 200, 300),
      preset("24x30", "24 × 30 cm", 240, 300),
      preset("30x40", "30 × 40 cm", 300, 400),
      preset("40x50", "40 × 50 cm", 400, 500),
      preset("40x60", "40 × 60 cm", 400, 600),
      preset("50x70", "50 × 70 cm", 500, 700),
      preset("60x80", "60 × 80 cm", 600, 800),
      preset("70x100", "70 × 100 cm", 700, 1000),
      preset("20x20", "20 × 20 cm (square)", 200, 200),
      preset("30x30", "30 × 30 cm (square)", 300, 300),
      preset("40x40", "40 × 40 cm (square)", 400, 400),
      preset("50x50", "50 × 50 cm (square)", 500, 500),
    ],
  },
];

export const PRESETS: SizePreset[] = PRESET_GROUPS.flatMap((group) => group.presets);

export function isLandscape(size: { width: number; height: number }): boolean {
  return size.width >= size.height;
}

/** Preset dimensions in the given orientation. */
export function presetSize(p: SizePreset, landscape: boolean): { width: number; height: number } {
  return landscape ? { width: p.height, height: p.width } : { width: p.width, height: p.height };
}

/** The preset matching this size in either orientation, if any. */
export function findPreset(size: { width: number; height: number }): SizePreset | undefined {
  const short = Math.min(size.width, size.height);
  const long = Math.max(size.width, size.height);
  return PRESETS.find((p) => p.width === short && p.height === long);
}
