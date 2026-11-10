"use client";

import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { useEffect, useMemo, useReducer, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { computeCells, sanitizeConfig, type GridConfig } from "./grid";
import { canvasToBlob, downloadBlob, EXPORT_DPI, exportFilename, exportSize, exportWarning, renderFrame } from "./export";
import { findPreset, isLandscape, PRESET_GROUPS, presetSize } from "./presets";
import { usePreferences } from "./preferences";
import { dropIndex, initialPhotosState, photosReducer, type Photo } from "./photos";

const INTERNAL_DRAG = "application/x-gallery-frame-photos";

const FIELDS: { key: keyof GridConfig; label: string; step: number }[] = [
  { key: "rows", label: "Rows", step: 1 },
  { key: "columns", label: "Columns", step: 1 },
  { key: "spacingX", label: "Horizontal spacing (mm)", step: 0.1 },
  { key: "spacingY", label: "Vertical spacing (mm)", step: 0.1 },
  { key: "padding", label: "Padding (mm)", step: 0.1 },
];

function NumberInput({ label, value, step, onCommit }: { label: string; value: number; step: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="field">
      <span>{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = event.target.valueAsNumber;
          if (Number.isFinite(parsed)) onCommit(parsed);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

function imageFiles(files: Iterable<File>): File[] {
  return [...files].filter((file) => file.type.startsWith("image/"));
}

function toPhotos(files: File[]): Photo[] {
  // Object URLs are not revoked on remove, because undo can bring the photo back.
  return files.map((file) => ({ id: crypto.randomUUID(), src: URL.createObjectURL(file), name: file.name }));
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function FrameMaker() {
  const [state, dispatch] = useReducer(photosReducer, initialPhotosState);
  const rawConfig = usePreferences((s) => s.config);
  const setRawConfig = usePreferences((s) => s.updateConfig);
  const resetConfig = usePreferences((s) => s.resetConfig);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [fileDragging, setFileDragging] = useState(false);
  const [exportState, setExportState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const fileInput = useRef<HTMLInputElement>(null);

  // Saved preferences load after mount, so the first render matches the static HTML.
  useEffect(() => {
    void usePreferences.persist.rehydrate();
  }, []);

  const config = useMemo(() => sanitizeConfig(rawConfig), [rawConfig]);
  const cells = useMemo(() => computeCells(config), [config]);
  const selected = useMemo(() => new Set(state.selection), [state.selection]);
  const warning = exportWarning(config);
  const pixels = exportSize(config);
  const overflow = Math.max(state.photos.length - cells.length, 0);

  // The key handler is registered once, so it reads the latest selection through a ref.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
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
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        dispatch({ type: "remove", ids: stateRef.current.selection });
      } else if (key === "escape") {
        dispatch({ type: "clearSelection" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function addFiles(files: Iterable<File>, index?: number) {
    const images = imageFiles(files);
    if (images.length > 0) dispatch({ type: "add", photos: toPhotos(images), index });
  }

  async function exportImage() {
    setExportState({ busy: true, error: null });
    try {
      const canvas = await renderFrame(config, state.photos);
      downloadBlob(await canvasToBlob(canvas), exportFilename(config));
      setExportState({ busy: false, error: null });
    } catch (error) {
      setExportState({ busy: false, error: error instanceof Error ? error.message : "Export failed." });
    }
  }

  function onCellClick(event: MouseEvent, photo: Photo) {
    const mode = event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "replace";
    dispatch({ type: "select", id: photo.id, mode });
  }

  function onDragStart(event: DragEvent, photo: Photo) {
    let ids = state.selection;
    if (!selected.has(photo.id)) {
      ids = [photo.id];
      dispatch({ type: "select", id: photo.id, mode: "replace" });
    }
    event.dataTransfer.setData(INTERNAL_DRAG, JSON.stringify(ids));
    event.dataTransfer.effectAllowed = "move";
  }

  function onCellDrop(event: DragEvent, cellIndex: number) {
    setDropTarget(null);
    setFileDragging(false);
    const transfer = event.dataTransfer;
    if (transfer.types.includes(INTERNAL_DRAG)) {
      event.preventDefault();
      event.stopPropagation();
      const ids: string[] = JSON.parse(transfer.getData(INTERNAL_DRAG));
      dispatch({ type: "move", ids, toIndex: dropIndex(state.photos, ids, cellIndex) });
    } else if (transfer.files.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      addFiles(transfer.files, Math.min(cellIndex, state.photos.length));
    }
  }

  function onPageDragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      setFileDragging(true);
    }
  }

  return (
    <main
      className={fileDragging ? "app dragging-files" : "app"}
      onDragOver={onPageDragOver}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setFileDragging(false);
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        setFileDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <header>
        <h1>Gallery Frame Maker</h1>
        <div className="toolbar">
          <Button onClick={() => fileInput.current?.click()}>Add photos</Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files ?? []);
              event.target.value = "";
            }}
          />
          <Button disabled={state.selection.length === 0} onClick={() => dispatch({ type: "remove", ids: state.selection })}>
            Remove selected
          </Button>
          <Button disabled={state.photos.length === 0 || exportState.busy} onClick={() => void exportImage()}>
            {exportState.busy ? "Exporting…" : "Export PNG"}
          </Button>
          <Button disabled={state.past.length === 0} onClick={() => dispatch({ type: "undo" })}>
            Undo
          </Button>
          <Button disabled={state.future.length === 0} onClick={() => dispatch({ type: "redo" })}>
            Redo
          </Button>
        </div>
      </header>

      <section className="controls" aria-label="Grid settings">
        <label className="field">
          <span>Size</span>
          <select
            value={findPreset(config)?.id ?? "custom"}
            onChange={(event) => {
              for (const group of PRESET_GROUPS) {
                const chosen = group.presets.find((p) => p.id === event.target.value);
                if (chosen) setRawConfig((current) => ({ ...current, ...presetSize(chosen, isLandscape(sanitizeConfig(current))) }));
              }
            }}
          >
            <option value="custom">Custom</option>
            {PRESET_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <NumberInput label="Width (mm)" value={config.width} step={1} onCommit={(width) => setRawConfig((current) => ({ ...current, width }))} />
        <NumberInput label="Height (mm)" value={config.height} step={1} onCommit={(height) => setRawConfig((current) => ({ ...current, height }))} />
        <Button onClick={() => setRawConfig((current) => ({ ...current, width: config.height, height: config.width }))}>
          Rotate ({isLandscape(config) ? "landscape" : "portrait"})
        </Button>
        <Button onClick={resetConfig}>Reset settings</Button>
        {FIELDS.map(({ key, label, step }) => (
          <NumberInput
            key={key}
            label={label}
            step={step}
            value={config[key]}
            onCommit={(value) => setRawConfig((current) => ({ ...current, [key]: value }))}
          />
        ))}
      </section>

      <p className="hint">
        Export: {pixels.width} × {pixels.height} px at {EXPORT_DPI} DPI (fixed).
      </p>
      {warning !== null && (
        <p role="alert" className="warning">
          {warning}
        </p>
      )}
      {exportState.error !== null && (
        <p role="alert" className="warning">
          {exportState.error}
        </p>
      )}

      {overflow > 0 && (
        <p role="status" className="warning">
          {overflow} {overflow === 1 ? "photo does" : "photos do"} not fit in the grid and will not be exported. Add rows or columns.
        </p>
      )}

      <div className="canvas" style={{ aspectRatio: `${config.width} / ${config.height}` }}>
        {cells.map((cell, index) => {
          const photo = state.photos[index];
          const classes = ["cell", photo ? "filled" : "empty", photo && selected.has(photo.id) ? "selected" : "", dropTarget === index ? "drop" : ""];
          return (
            <div
              key={index}
              className={classes.filter(Boolean).join(" ")}
              style={{
                left: `${(cell.x / config.width) * 100}%`,
                top: `${(cell.y / config.height) * 100}%`,
                width: `${(cell.width / config.width) * 100}%`,
                height: `${(cell.height / config.height) * 100}%`,
              }}
              draggable={photo !== undefined}
              aria-selected={photo ? selected.has(photo.id) : undefined}
              onClick={photo ? (event) => onCellClick(event, photo) : () => dispatch({ type: "clearSelection" })}
              onDragStart={photo ? (event) => onDragStart(event, photo) : undefined}
              onDragEnd={() => setDropTarget(null)}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(index);
              }}
              onDrop={(event) => onCellDrop(event, index)}
            >
              {/* Local blob URLs: next/image optimization does not apply. */}
              {/* oxlint-disable-next-line next/no-img-element */}
              {photo && <img src={photo.src} alt={photo.name} draggable={false} />}
            </div>
          );
        })}
      </div>

      <p className="hint">
        Drop images anywhere to add them. Click to select, Shift or Ctrl/Cmd-click for more, drag to rearrange, Delete to remove, Ctrl/Cmd+Z to undo.
      </p>
    </main>
  );
}
