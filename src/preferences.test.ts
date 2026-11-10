import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, parseCollapsed, parseStoredConfig, usePreferences } from "./preferences";

const KEY = "gallery-frame-maker:preferences";

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({ config: DEFAULT_CONFIG });
});

describe("usePreferences", () => {
  it("persists config changes to localStorage", () => {
    usePreferences.getState().updateConfig((c) => ({ ...c, rows: 5, width: 594 }));
    const saved = JSON.parse(localStorage.getItem(KEY)!);
    expect(saved.state.config).toMatchObject({ rows: 5, width: 594 });
    expect(saved.state.updateConfig).toBeUndefined();
  });

  it("restores saved config on rehydrate", async () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { config: { ...DEFAULT_CONFIG, columns: 7 } }, version: 1 }));
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().config.columns).toBe(7);
  });

  it("falls back to defaults for corrupt storage", async () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { config: { rows: "lots" } }, version: 1 }));
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().config).toEqual(DEFAULT_CONFIG);
  });

  it("resets to defaults", () => {
    usePreferences.getState().updateConfig((c) => ({ ...c, rows: 9 }));
    usePreferences.getState().resetConfig();
    expect(usePreferences.getState().config).toEqual(DEFAULT_CONFIG);
  });
});

describe("parseStoredConfig", () => {
  it("rejects missing keys and non-finite numbers", () => {
    expect(parseStoredConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parseStoredConfig({ config: { ...DEFAULT_CONFIG, rows: null } })).toEqual(DEFAULT_CONFIG);
    expect(parseStoredConfig({ config: { rows: 2 } })).toEqual(DEFAULT_CONFIG);
  });
});

describe("collapsed sections", () => {
  it("persists and restores", async () => {
    usePreferences.getState().setCollapsed("grid", true);
    expect(JSON.parse(localStorage.getItem(KEY)!).state.collapsed).toEqual({ grid: true });
    localStorage.setItem(KEY, JSON.stringify({ state: { config: DEFAULT_CONFIG, collapsed: { grid: true } }, version: 1 }));
    await usePreferences.persist.rehydrate();
    expect(usePreferences.getState().collapsed).toEqual({ grid: true });
  });

  it("ignores junk", () => {
    expect(parseCollapsed({ collapsed: { a: true, b: "yes" } })).toEqual({ a: true });
    expect(parseCollapsed(null)).toEqual({});
  });
});
