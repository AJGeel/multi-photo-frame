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
  /** Sidebar sections the user collapsed, by id. */
  collapsed: Record<string, boolean>;
  setCollapsed: (id: string, collapsed: boolean) => void;
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

const STORAGE_KEY = "multi-photo-frame:preferences";
const LEGACY_STORAGE_KEY = "gallery-frame-maker:preferences";

/** Copies settings saved under the app's old name, once. Call before rehydrating. */
export function migrateLegacyPreferences(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null && localStorage.getItem(STORAGE_KEY) === null) localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be blocked. The defaults apply then.
  }
}

export function parseCollapsed(value: unknown): Record<string, boolean> {
  const stored = (value as { collapsed?: Record<string, unknown> } | null)?.collapsed;
  if (typeof stored !== "object" || stored === null) return {};
  return Object.fromEntries(Object.entries(stored).filter(([, v]) => typeof v === "boolean")) as Record<string, boolean>;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      collapsed: {},
      setCollapsed: (id, collapsed) => set((state) => ({ collapsed: { ...state.collapsed, [id]: collapsed } })),
      updateConfig: (update) => set((state) => ({ config: update(state.config) })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // Hydrate after mount (see `FrameMaker`), so the first client render matches the static HTML.
      skipHydration: true,
      partialize: (state) => ({ config: state.config, collapsed: state.collapsed }),
      merge: (persisted, current) => ({ ...current, config: parseStoredConfig(persisted), collapsed: parseCollapsed(persisted) }),
    },
  ),
);
