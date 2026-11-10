/** Paper colours for the layout. Unlike frames, the paper colour is part of the exported image. */
export const PAPER_COLORS: { value: string; label: string }[] = [
  { value: "#ffffff", label: "White" },
  { value: "#111111", label: "Black" },
  { value: "#f3ead8", label: "Cream" },
  { value: "#d9d9dc", label: "Light grey" },
  { value: "#c5d5c0", label: "Sage" },
  { value: "#2b3a55", label: "Navy" },
];

export const DEFAULT_PAPER_COLOR = "#ffffff";

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function paperLabel(color: string): string {
  return PAPER_COLORS.find((c) => c.value === color.toLowerCase())?.label ?? "Custom";
}
