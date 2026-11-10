/** Frame styles for the preview. They are drawn around the paper and are not part of the exported image. */
export type FrameStyle = "none" | "black" | "white" | "oak" | "walnut" | "cherry" | "birch" | "gold";

export const FRAME_STYLES: { id: FrameStyle; label: string }[] = [
  { id: "none", label: "None" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "oak", label: "Oak" },
  { id: "walnut", label: "Walnut" },
  { id: "cherry", label: "Cherry" },
  { id: "birch", label: "Birch" },
  { id: "gold", label: "Gold" },
];

export const DEFAULT_FRAME: FrameStyle = "none";

/** Moulding width as a fraction of the paper's shorter side. */
const WIDTH_RATIO: Record<FrameStyle, number> = {
  none: 0,
  black: 0.035,
  white: 0.04,
  oak: 0.045,
  walnut: 0.045,
  cherry: 0.045,
  birch: 0.045,
  gold: 0.07,
};

export function frameRatio(style: FrameStyle): number {
  return WIDTH_RATIO[style];
}

export function isFrameStyle(value: unknown): value is FrameStyle {
  return FRAME_STYLES.some((style) => style.id === value);
}

export function frameLabel(style: FrameStyle): string {
  return FRAME_STYLES.find((s) => s.id === style)?.label ?? "None";
}
