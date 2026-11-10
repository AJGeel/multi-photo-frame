import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GridConfig } from "./grid";

/** Millimetres. A3 landscape. */
export const DEFAULT_CONFIG: GridConfig = {
  rows: 3,
  columns: 4,
  spacingX: 10,
  spacingY: 10,
  padding: 20,
  width: 420,
  height: 297,
};

interface PreferencesState {
  /** Raw values as typed. Run through `sanitizeConfig` before use. */
  config: GridConfig;
  updateConfig: (update: (current: GridConfig) => GridConfig) => void;
  resetConfig: () => void;
}

/** Returns the stored config if it is complete and numeric, otherwise the defaults. */
export function parseStoredConfig(value: unknown): GridConfig {
  const stored = (value as { config?: Record<string, unknown> } | null)?.config;
  const entries = Object.keys(DEFAULT_CONFIG).map((key) => [key, stored?.[key]] as const);
  if (entries.every(([, v]) => typeof v === "number" && Number.isFinite(v))) {
    return Object.fromEntries(entries) as unknown as GridConfig;
  }
  return DEFAULT_CONFIG;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      updateConfig: (update) => set((state) => ({ config: update(state.config) })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),
    }),
    {
      name: "gallery-frame-maker:preferences",
      version: 1,
      // Hydrate after mount (see `FrameMaker`), so the first client render matches the static HTML.
      skipHydration: true,
      partialize: (state) => ({ config: state.config }),
      merge: (persisted, current) => ({ ...current, config: parseStoredConfig(persisted) }),
    },
  ),
);
