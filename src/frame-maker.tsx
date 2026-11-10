"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Canvas } from "./canvas";
import { ExportMenu } from "./export-menu";
import { downloadBlob, effectiveDpi, encodeCanvas, exportFilename, FORMAT_LABELS, exportSize, isOversize, LOW_RES_DPI, renderFrame } from "./export";
import { computeCells, sanitizeConfig, suggestGrid, type GridConfig } from "./grid";
import { Check, Close, Laptop, Logo, Plus, Redo, Settings, Spinner, Trash, Undo, Upload, Warning } from "./icons";
import { dropIndex, initialPhotosState, DEFAULT_GRID, photosReducer, type Focus, type Photo } from "./photos";
import { loadPhotos } from "./photo-files";
import { isTyping, NARROW_QUERY, useMediaQuery } from "./platform";
import { findPreset, isLandscape, PRESETS, presetSize } from "./presets";
import { migrateLegacyPreferences, usePreferences } from "./preferences";
import { Sidebar, type ClampNotice, type ConfigKey } from "./sidebar";
import { toastManager, ToastHost } from "./toasts";
import { Button, IconButton, Keys, Tip } from "./ui";
import { useFileDrop } from "./use-file-drop";
import { useMarquee } from "./use-marquee";
import { useRearrange } from "./use-rearrange";

const FIELD_NAMES: Record<ConfigKey, string> = {
  rows: "rows",
  columns: "columns",
  spacingX: "horizontal spacing",
  spacingY: "vertical spacing",
  padding: "padding",
  width: "width",
  height: "height",
};

const HALO_MS = 1500;
const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

function clampMessage(key: ConfigKey, wanted: number, got: number): string | null {
  if (wanted === got) return null;
  const name = FIELD_NAMES[key];
  const fmt = (n: number) => (key === "rows" || key === "columns" ? String(n) : n.toFixed(1));
  if (got > wanted) {
    return got === 0 ? `Set to 0 — ${name} can’t be negative.` : `Set to ${fmt(got)} — ${name} must be at least ${fmt(got)}.`;
  }
  if (key === "spacingX" || key === "spacingY" || key === "padding") return `Lowered to ${fmt(got)} so every cell stays at least 1 mm.`;
  return `Lowered to ${fmt(got)} — ${name} can’t go above ${fmt(got)}.`;
}

function sizeLabel(config: GridConfig): string {
  const preset = findPreset(config);
  const dims = `${+config.width.toFixed(1)} × ${+config.height.toFixed(1)} mm`;
  return preset ? `${preset.label} ${isLandscape(config) ? "landscape" : "portrait"} · ${dims}` : `Custom · ${dims}`;
}

export function FrameMaker() {
  return (
    <Tooltip.Provider delay={500} closeDelay={0}>
      <ToastHost>
        <App />
      </ToastHost>
    </Tooltip.Provider>
  );
}

function App() {
  const [state, dispatch] = useReducer(photosReducer, initialPhotosState);
  const stateRef = useRef(state);
  const rawConfig = usePreferences((s) => s.config);
  const setRawConfig = usePreferences((s) => s.updateConfig);
  const resetConfig = usePreferences((s) => s.resetConfig);
  const exportOptions = usePreferences((s) => s.exportOptions);
  const setExportOptions = usePreferences((s) => s.setExportOptions);
  const narrow = useMediaQuery(NARROW_QUERY);

  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<ClampNotice | null>(null);
  const [halo, setHalo] = useState<ConfigKey | null>(null);
  const [dismissedOverflow, setDismissedOverflow] = useState<number | null>(null);
  const [importing, setImporting] = useState(0);
  const [exporting, setExporting] = useState<{ percent: number } | null>(null);
  const [focusCell, setFocusCell] = useState(0);
  const [cropId, setCropId] = useState<string | null>(null);
  const [cropFocus, setCropFocus] = useState<Focus | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [workspace, setWorkspace] = useState<{ width: number; height: number } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const haloTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortExport = useRef<AbortController | null>(null);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  });

  // Saved settings load after mount, so the first render matches the static HTML.
  // Rows and columns live in the photo history (for undo) and are mirrored back to the saved settings.
  useEffect(() => {
    migrateLegacyPreferences();
    void Promise.resolve(usePreferences.persist.rehydrate()).then(() => {
      const saved = sanitizeConfig(usePreferences.getState().config);
      dispatch({ type: "syncGrid", grid: { rows: saved.rows, columns: saved.columns } });
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const { rows, columns } = state.grid;
    setRawConfig((c) => (c.rows === rows && c.columns === columns ? c : { ...c, rows, columns }));
  }, [ready, state.grid, setRawConfig]);

  const config = useMemo(() => sanitizeConfig({ ...rawConfig, ...state.grid }), [rawConfig, state.grid]);
  const cells = useMemo(() => computeCells(config), [config]);
  const selected = useMemo(() => new Set(state.selection), [state.selection]);
  const pixels = exportSize(config);
  const oversize = isOversize(config);
  const overflow = Math.max(state.photos.length - cells.length, 0);
  const overflowPhotos = state.photos.slice(cells.length);
  const noticeVisible = overflow > 0 && dismissedOverflow !== overflow;

  const lowRes = useMemo(() => {
    const ids = new Set<string>();
    for (const [index, cell] of cells.entries()) {
      const photo = state.photos[index];
      if (!photo) break;
      const dpi = effectiveDpi(photo, cell);
      if (dpi !== null && dpi < LOW_RES_DPI) ids.add(photo.id);
    }
    return ids;
  }, [cells, state.photos]);

  // Fit the paper to the workspace.
  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWorkspace({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const overflowExtra = overflow > 0 ? 72 + (noticeVisible ? 56 : 0) : 0;
  const scale = workspace
    ? Math.max(Math.min((workspace.width - (narrow ? 48 : 128)) / config.width, (workspace.height - (narrow ? 140 : 132) - overflowExtra) / config.height), 0.05)
    : 0.5;

  // ---- Settings -------------------------------------------------------------------------------

  function commitField(key: ConfigKey, raw: number) {
    const next = sanitizeConfig({ ...config, [key]: raw });
    const wanted = key === "rows" || key === "columns" ? Math.round(raw) : Math.round(raw * 10) / 10;
    if (key === "rows" || key === "columns") dispatch({ type: "setGrid", grid: { rows: next.rows, columns: next.columns } });
    else setRawConfig((current) => ({ ...current, [key]: next[key] }));
    const text = clampMessage(key, wanted, next[key]);
    if (haloTimer.current) clearTimeout(haloTimer.current);
    if (text === null) {
      setNotice(null);
      setHalo(null);
      return;
    }
    setNotice({ key, text });
    setHalo(key);
    haloTimer.current = setTimeout(() => setHalo(null), HALO_MS);
  }

  function rotate() {
    setRawConfig((current) => ({ ...current, width: config.height, height: config.width }));
  }

  function pickPreset(id: string) {
    const chosen = PRESETS.find((p) => p.id === id);
    if (chosen) setRawConfig((current) => ({ ...current, ...presetSize(chosen, isLandscape(config)) }));
  }

  function resetSettings() {
    resetConfig();
    dispatch({ type: "setGrid", grid: DEFAULT_GRID });
    setNotice(null);
    setHalo(null);
  }

  // ---- Adding photos --------------------------------------------------------------------------

  const addFiles = useCallback(async (files: File[], index?: number | null) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    let skipped = files.length - images.length;
    const controller = new AbortController();
    // Big imports take a while: show progress, and let the person stop.
    const progressId =
      images.length > 3
        ? toastManager.add({
            type: "progress",
            title: "Importing photos",
            description: `0 of ${images.length}`,
            timeout: 0,
            data: { percent: 0, onCancel: () => controller.abort() },
          })
        : null;
    setImporting((count) => count + 1);
    try {
      const result = await loadPhotos(images, {
        signal: controller.signal,
        onProgress: (done, total) => {
          if (progressId === null) return;
          toastManager.update(progressId, {
            description: `${done} of ${total}`,
            data: { percent: Math.round((done / total) * 100), onCancel: () => controller.abort() },
          });
        },
      });
      skipped += result.failed;
      // One undo entry for the whole import.
      if (result.photos.length > 0) dispatch({ type: "add", photos: result.photos, index: index ?? undefined });
      if (result.cancelled > 0) {
        toastManager.add({ type: "info", title: `Import stopped — ${result.photos.length} of ${images.length} photos added`, timeout: 6000 });
      }
    } finally {
      if (progressId !== null) toastManager.close(progressId);
      setImporting((count) => count - 1);
    }
    if (skipped > 0) {
      toastManager.add({ type: "info", title: skipped === 1 ? "1 file skipped — not an image" : `${skipped} files skipped — not images`, timeout: 6000 });
    }
  }, []);

  const openPicker = useCallback(() => fileInput.current?.click(), []);

  const fileDrop = useFileDrop(
    (files, index) => void addFiles(files, index),
    () => stateRef.current.photos.length,
  );

  // ---- Rearranging ----------------------------------------------------------------------------

  const { drag, press, consumeClick } = useRearrange({
    getSelection: () => stateRef.current.selection,
    photoCount: () => stateRef.current.photos.length,
    select: (id) => dispatch({ type: "select", id, mode: "replace" }),
    drop: (ids, cellIndex, alt) => {
      const current = stateRef.current;
      const targetPhoto = current.photos[cellIndex];
      const action =
        alt && ids.length === 1 && targetPhoto !== undefined
          ? ({ type: "swap", a: ids[0]!, b: targetPhoto.id } as const)
          : ({ type: "move", ids, toIndex: dropIndex(current.photos, ids, cellIndex) } as const);
      if (photosReducer(current, action) === current) return false;
      dispatch(action);
      return true;
    },
  });

  const marquee = useMarquee({
    getSelection: () => stateRef.current.selection,
    setSelection: (ids) => dispatch({ type: "setSelection", ids }),
    ignore: "[data-photo-id], button, [role=toolbar], .overflow-notice, .empty-card, .toast, .tray-text, input",
  });

  // ---- Cropping -------------------------------------------------------------------------------

  function startCrop(event: PointerEvent<HTMLElement>, photo: Photo) {
    if (event.button !== 0 || !photo.width || !photo.height) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const fit = Math.max(rect.width / photo.width, rect.height / photo.height);
    const overX = photo.width * fit - rect.width;
    const overY = photo.height * fit - rect.height;
    const start = { x: event.clientX, y: event.clientY };
    const from = photo.focus ?? { x: 0.5, y: 0.5 };
    let latest = from;
    const onMove = (e: globalThis.PointerEvent) => {
      latest = {
        x: overX > 0.5 ? clamp01(from.x - (e.clientX - start.x) / overX) : from.x,
        y: overY > 0.5 ? clamp01(from.y - (e.clientY - start.y) / overY) : from.y,
      };
      setCropFocus(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      dispatch({ type: "focus", id: photo.id, focus: latest });
      setCropFocus(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // ---- Cell events ----------------------------------------------------------------------------

  const tabCell = Math.min(focusCell, Math.max(state.photos.length - 1, 0));

  function onCellPointerDown(event: PointerEvent<HTMLElement>, photo: Photo) {
    if (photo.id === cropId) startCrop(event, photo);
    else press(event, photo.id);
  }

  function onCellClick(event: MouseEvent, index: number) {
    if (consumeClick() || marquee.consumeClick()) return;
    const photo = state.photos[index];
    if (cropId !== null && photo?.id !== cropId) setCropId(null);
    if (!photo) {
      dispatch({ type: "clearSelection" });
      return;
    }
    const mode = event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "replace";
    dispatch({ type: "select", id: photo.id, mode });
    setFocusCell(index);
  }

  function focusPhotoAt(index: number) {
    setFocusCell(index);
    canvasWrapRef.current?.querySelector<HTMLElement>(`[data-cell-index="${index}"]`)?.focus();
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    const photo = state.photos[index];
    if (!photo || event.target !== event.currentTarget) return;
    const { columns } = config;
    const last = state.photos.length - 1;
    const arrows: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    const step = arrows[event.key];
    if (step !== undefined) {
      event.preventDefault();
      if (event.altKey) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const ids = selected.has(photo.id) ? state.selection : [photo.id];
        if (!selected.has(photo.id)) dispatch({ type: "select", id: photo.id, mode: "replace" });
        const first = state.photos.findIndex((p) => ids.includes(p.id));
        const rest = state.photos.length - ids.length;
        const toIndex = Math.min(Math.max(first + step, 0), rest);
        if (toIndex !== first) {
          dispatch({ type: "move", ids, toIndex });
          pendingFocus.current = photo.id;
          setAnnouncement(`${ids.length === 1 ? "Photo" : `${ids.length} photos`} moved to position ${toIndex + 1}`);
        }
        return;
      }
      focusPhotoAt(Math.min(Math.max(index + step, 0), last));
    } else if (event.key === " ") {
      event.preventDefault();
      dispatch({ type: "select", id: photo.id, mode: "toggle" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      dispatch({ type: "select", id: photo.id, mode: "replace" });
    }
  }

  // After a keyboard move, put focus back on the photo that moved.
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    const index = state.photos.findIndex((p) => p.id === id);
    if (index !== -1) focusPhotoAt(index);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only runs when the order changes
  }, [state.photos]);

  function onWorkspaceClick(event: MouseEvent) {
    if (consumeClick() || marquee.consumeClick()) return;
    const inside = (event.target as Element).closest("[data-cell-index], [data-photo-id], [role=toolbar], .overflow-notice, .empty-card, .toast, button");
    if (inside) return;
    dispatch({ type: "clearSelection" });
    setCropId(null);
  }

  // ---- Export ---------------------------------------------------------------------------------

  async function runExport() {
    const current = stateRef.current;
    if (abortExport.current || current.photos.length === 0) return;
    const controller = new AbortController();
    abortExport.current = controller;
    const total = Math.min(current.photos.length, cells.length);
    const size = `${pixels.width} × ${pixels.height} px`;
    const options = exportOptions;
    const label = FORMAT_LABELS[options.format];
    const filename = exportFilename(config, options.format);
    const progressId = toastManager.add({
      type: "progress",
      title: `Rendering ${label}`,
      description: size,
      timeout: 0,
      data: { percent: 0, onCancel: () => controller.abort() },
    });
    setExporting({ percent: 0 });
    try {
      const canvas = await renderFrame(config, current.photos, {
        signal: controller.signal,
        onProgress: (done) => {
          // Keep the bar short of full until the file is encoded.
          const percent = total === 0 ? 0 : Math.min(Math.round((done / total) * 100), 99);
          setExporting({ percent });
          toastManager.update(progressId, {
            description: done >= total ? `${size} · encoding…` : `${size} · photo ${done + 1} of ${total}`,
            data: { percent, onCancel: () => controller.abort() },
          });
        },
      });
      setExporting({ percent: 99 });
      downloadBlob(await encodeCanvas(canvas, config, options), filename);
      toastManager.close(progressId);
      toastManager.add({ type: "success", title: `${label} exported`, description: `${filename} · ${size}\nCheck your downloads folder.`, timeout: 6000 });
    } catch (error) {
      toastManager.close(progressId);
      if (!controller.signal.aborted) {
        console.error(error);
        toastManager.add({
          type: "error",
          priority: "high",
          title: "Export didn’t finish",
          description: "Your browser ran out of room to build an image this large. Your layout is untouched — try a smaller size or close other tabs, then export again.",
          timeout: 0,
          data: { onRetry: () => void actions.current.runExport() },
        });
      }
    } finally {
      abortExport.current = null;
      setExporting(null);
    }
  }

  // ---- Keyboard -------------------------------------------------------------------------------

  const actions = useRef({ runExport, rotate, openPicker });
  useEffect(() => {
    actions.current = { runExport, rotate, openPicker };
  });
  const cropIdRef = useRef(cropId);
  const drawerRef = useRef(drawerOpen);
  useEffect(() => {
    cropIdRef.current = cropId;
    drawerRef.current = drawerOpen;
  });

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (isTyping(event.target)) return;
      if ((event.target as Element | null)?.closest?.("[role=listbox], [role=combobox], [role=menu]")) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && key === "a") {
        event.preventDefault();
        dispatch({ type: "selectAll" });
      } else if (mod && key === "o") {
        event.preventDefault();
        actions.current.openPicker();
      } else if (mod && key === "e") {
        event.preventDefault();
        void actions.current.runExport();
      } else if (!mod && !event.altKey && key === "r") {
        actions.current.rotate();
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        dispatch({ type: "remove", ids: stateRef.current.selection });
      } else if (key === "enter" && cropIdRef.current !== null) {
        setCropId(null);
      } else if (key === "escape") {
        if (cropIdRef.current !== null) setCropId(null);
        else if (drawerRef.current) setDrawerOpen(false);
        else dispatch({ type: "clearSelection" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Photos live only in this tab, so warn before they are lost.
  const hasPhotos = state.photos.length > 0;
  useEffect(() => {
    if (!hasPhotos) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPhotos]);

  // ---- Render ---------------------------------------------------------------------------------

  const dragPhotos = drag ? state.photos.filter((p) => drag.ids.includes(p.id)) : [];
  const draggingNow = drag !== null && !drag.returning;
  const sourceIds = draggingNow ? new Set(drag.ids) : null;
  const fitSuggestion = overflow > 0 ? suggestGrid(state.photos.length, config) : null;
  const showFit = fitSuggestion !== null && !(fitSuggestion.rows === config.rows + 1 && fitSuggestion.columns === config.columns);
  const count = state.photos.length;
  const selectionLabel = draggingNow ? `Moving ${drag.ids.length}` : state.selection.length === 0 ? "No selection" : `${state.selection.length} selected`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {narrow && (
            <IconButton label="Settings" tip="Settings" aria-expanded={drawerOpen} className={drawerOpen ? "active" : ""} onClick={() => setDrawerOpen((open) => !open)}>
              <Settings />
            </IconButton>
          )}
          <span className="logo">
            <Logo size={14} />
          </span>
          <h1>Multi Photo Frame</h1>
        </div>
        <div className="actions">
          {narrow ? (
            <IconButton label="Add photos" keys={["mod", "O"]} onClick={openPicker}>
              <Plus />
            </IconButton>
          ) : (
            <Tip label="Add photos" keys={["mod", "O"]}>
              <Button onClick={openPicker}>
                <Plus size={14} />
                Add photos
              </Button>
            </Tip>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              void addFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
          <IconButton label="Remove selected" keys={["backspace"]} disabled={state.selection.length === 0} onClick={() => dispatch({ type: "remove", ids: state.selection })}>
            <Trash />
          </IconButton>
          <span className="divider" />
          <IconButton label="Undo" tip={state.past.length === 0 ? "Nothing to undo" : "Undo"} keys={["mod", "Z"]} disabled={state.past.length === 0} onClick={() => dispatch({ type: "undo" })}>
            <Undo />
          </IconButton>
          <IconButton label="Redo" tip={state.future.length === 0 ? "Nothing to redo" : "Redo"} keys={["shift", "mod", "Z"]} disabled={state.future.length === 0} onClick={() => dispatch({ type: "redo" })}>
            <Redo />
          </IconButton>
          <span className="divider" />
          <ExportMenu
            options={exportOptions}
            onChange={setExportOptions}
            onExport={() => void runExport()}
            noPhotos={count === 0}
            busy={exporting}
            oversize={oversize}
            compact={narrow}
          />
        </div>
      </header>

      <div className="body">
        {(!narrow || drawerOpen) && (
          <>
            <div className={narrow ? "sidebar-wrap drawer" : "sidebar-wrap"}>
              <Sidebar config={config} notice={notice} halo={halo} onCommit={commitField} onPickPreset={pickPreset} onRotate={rotate} onReset={resetSettings} />
            </div>
            {narrow && <div className="scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}
          </>
        )}

        <main ref={workspaceRef} className="workspace" aria-label="Layout preview" onClick={onWorkspaceClick} onPointerDown={marquee.onPointerDown}>
          {noticeVisible && (
            <div role="status" className="overflow-notice">
              <Warning size={14} />
              <span>
                <strong>
                  {overflow} {overflow === 1 ? "photo doesn’t" : "photos don’t"} fit
                </strong>{" "}
                <span className="muted">and won’t be exported. Add rows or columns.</span>
              </span>
              <Button compact onClick={() => dispatch({ type: "setGrid", grid: { rows: config.rows + 1, columns: config.columns } })}>
                Add a row
              </Button>
              {showFit && fitSuggestion && (
                <Button compact onClick={() => dispatch({ type: "setGrid", grid: fitSuggestion })}>
                  Use {fitSuggestion.rows} × {fitSuggestion.columns}
                </Button>
              )}
              <IconButton small label="Dismiss notice" onClick={() => setDismissedOverflow(overflow)}>
                <Close size={12} />
              </IconButton>
            </div>
          )}

          <div ref={canvasWrapRef} className="canvas-wrap" style={{ visibility: workspace ? "visible" : "hidden" }}>
            <Canvas
              config={config}
              scale={scale}
              photos={state.photos}
              selected={selected}
              drag={drag}
              fileDrop={fileDrop}
              lowRes={lowRes}
              tabIndexCell={tabCell}
              cropId={cropId}
              cropFocus={cropFocus}
              onPointerDown={onCellPointerDown}
              onCellClick={onCellClick}
              onDoubleClick={(photo) => setCropId((id) => (id === photo.id ? null : photo.id))}
              onKeyDown={onCellKeyDown}
              onFocusCell={setFocusCell}
              onAddPhotos={openPicker}
            />
          </div>

          {overflow > 0 && (
            <div className="tray" role="group" aria-label="Photos that won’t be exported">
              <div className="tray-thumbs">
                {overflowPhotos.map((photo, i) => (
                  <div
                    key={photo.id}
                    className={["thumb", selected.has(photo.id) ? "selected" : "", sourceIds?.has(photo.id) ? "source" : ""].filter(Boolean).join(" ")}
                    data-photo-id={photo.id}
                    role="button"
                    aria-pressed={selected.has(photo.id)}
                    aria-label={`Photo ${cells.length + i + 1}, ${photo.name}, not exported`}
                    tabIndex={0}
                    onPointerDown={(event) => press(event, photo.id)}
                    onClick={(event) => {
                      if (consumeClick()) return;
                      dispatch({ type: "select", id: photo.id, mode: event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "replace" });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        dispatch({ type: "select", id: photo.id, mode: event.key === " " ? "toggle" : "replace" });
                      }
                    }}
                  >
                    {/* oxlint-disable-next-line next/no-img-element */}
                    <img src={photo.thumb ?? photo.src} loading="lazy" decoding="async" alt="" draggable={false} style={{ objectPosition: `${(photo.focus?.x ?? 0.5) * 100}% ${(photo.focus?.y ?? 0.5) * 100}%` }} />
                    <span className="thumb-num num">{cells.length + i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="tray-text">
                <span className="tray-title">Not exported · {overflow}</span>
                <span className="tray-sub">Drag one into the grid to swap it in</span>
              </div>
            </div>
          )}

          {state.selection.length > 0 && !draggingNow && (
            <div role="toolbar" aria-label="Selection" className="selection-bar">
              <span className="sel-dot">
                <Check size={9} stroke={2.6} />
              </span>
              <span className="num sel-count">{state.selection.length} selected</span>
              {state.selection.length === 1 && <span className="sel-name">{state.photos.find((p) => p.id === state.selection[0])?.name}</span>}
              <span className="divider tall" />
              <Button variant="ghost" className="bar-btn" onClick={() => dispatch({ type: "remove", ids: state.selection })}>
                <Trash size={14} />
                Remove
                <Keys keys={["backspace"]} />
              </Button>
              <Button variant="ghost" className="bar-btn" onClick={() => dispatch({ type: "clearSelection" })}>
                Clear
                <Keys keys={["Esc"]} />
              </Button>
            </div>
          )}
        </main>
      </div>

      <footer className="statusline">
        <div className="status-group num">
          {importing > 0 && (
            <>
              <Spinner size={12} />
              <span>Importing…</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="status-main">{count === 0 ? "No photos" : count === 1 ? "1 photo" : `${count} photos`}</span>
          <span aria-hidden="true">·</span>
          <span>{selectionLabel}</span>
          {overflow > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="warn">{overflow} not exported</span>
            </>
          )}
          {lowRes.size > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="warn">{lowRes.size} low resolution</span>
            </>
          )}
        </div>
        <div className="status-group num">
          {!narrow && (
            <>
              <span>{sizeLabel(config)}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className={oversize ? "status-px warn strong" : "status-px"}>
            {oversize && <Warning size={12} stroke={1.5} />}
            {pixels.width} × {pixels.height} px at 300 DPI
          </span>
          {!narrow && (
            <>
              <span className="divider small" />
              <span className="local-hint">
                <Laptop size={12} />
                Photos stay in this tab and clear on reload
              </span>
            </>
          )}
        </div>
      </footer>

      {fileDrop && (
        <>
          <div className="drop-overlay" aria-hidden="true">
            <div className="drop-frame" />
          </div>
          <div className="drop-pill" role="status">
            <Upload size={16} stroke={1.5} />
            <div>
              <span className="drop-pill-title">Drop to add {fileDrop.count} {fileDrop.count === 1 ? "photo" : "photos"}</span>
              <span className="drop-pill-sub">Over a cell to insert there · anywhere else adds to the end</span>
            </div>
          </div>
        </>
      )}

      {drag && (
        <div
          className={drag.returning ? "ghost returning" : "ghost"}
          aria-hidden="true"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          {dragPhotos.slice(0, 3).map((photo, i) => (
            <div key={photo.id} className={`ghost-card depth-${i}`} style={{ backgroundImage: `url(${photo.thumb ?? photo.src})`, zIndex: 3 - i }} />
          ))}
          {drag.ids.length > 1 && <span className="ghost-count num">{drag.ids.length}</span>}
        </div>
      )}

      {marquee.rect && <div className="marquee" aria-hidden="true" style={marquee.rect} />}

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
