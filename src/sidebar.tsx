"use client";

import { computeCells, type GridConfig } from "./grid";
import { EXPORT_DPI, exportSize, isOversize, MAX_CANVAS_SIDE } from "./export";
import { Info, Reset, Rotate, Warning } from "./icons";
import { isLandscape } from "./presets";
import { SizePicker } from "./size-picker";
import { Button, IconButton, Keys, Labeled, NumberField, SidebarSection } from "./ui";

export type ConfigKey = keyof GridConfig;

export interface ClampNotice {
  key: ConfigKey;
  text: string;
}

interface SidebarProps {
  config: GridConfig;
  notice: ClampNotice | null;
  /** The field to show the focus halo on, for a moment after a value was clamped. */
  halo: ConfigKey | null;
  onCommit: (key: ConfigKey, value: number) => void;
  onPickPreset: (id: string) => void;
  onRotate: () => void;
  onReset: () => void;
}


const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Select all", keys: ["mod", "A"] },
  { label: "Add to range", keys: ["shift", "Click"] },
  { label: "Toggle one", keys: ["mod", "Click"] },
  { label: "Clear selection", keys: ["Esc"] },
  { label: "Remove", keys: ["backspace"] },
  { label: "Undo", keys: ["mod", "Z"] },
  { label: "Redo", keys: ["shift", "mod", "Z"] },
];

function Notice({ notice, keys }: { notice: ClampNotice | null; keys: ConfigKey[] }) {
  if (!notice || !keys.includes(notice.key)) return null;
  return (
    <div role="status" className="clamp-hint">
      <Info size={13} />
      <span>{notice.text}</span>
    </div>
  );
}

export function Sidebar({ config, notice, halo, onCommit, onPickPreset, onRotate, onReset }: SidebarProps) {
  const cell = computeCells(config)[0];
  const pixels = exportSize(config);
  const wide = pixels.width >= pixels.height;
  const field = (key: ConfigKey, label: string, step = 0.1) => (
    <NumberField label={label} value={config[key]} decimals={1} step={step} unit="mm" halo={halo === key} onCommit={(v) => onCommit(key, v)} />
  );

  return (
    <aside className="sidebar" aria-label="Layout settings">
      <div className="sidebar-scroll">
        <SidebarSection id="canvas" title="Canvas" meta={<span>{isLandscape(config) ? "Landscape" : "Portrait"}</span>}>
          <Labeled label="Size">
            <SizePicker size={config} onPick={onPickPreset} />
          </Labeled>
          <div className="wh-row">
            <Labeled label="Width" className="grow">
              {field("width", "Width in millimetres", 1)}
            </Labeled>
            <IconButton label="Rotate: swap width and height" tip="Rotate" keys={["R"]} onClick={onRotate}>
              <Rotate />
            </IconButton>
            <Labeled label="Height" className="grow">
              {field("height", "Height in millimetres", 1)}
            </Labeled>
          </div>
          <Notice notice={notice} keys={["width", "height"]} />
          {isOversize(config) && (
            <div role="note" className="size-note">
              <Warning size={14} />
              <span>
                At {EXPORT_DPI} DPI this is <span className="num strong">{wide ? pixels.width : pixels.height} px</span> {wide ? "wide" : "tall"}. Most browsers can’t render more than {MAX_CANVAS_SIDE} px, so
                export will probably fail. You can still try.
              </span>
            </div>
          )}
        </SidebarSection>

        <SidebarSection id="grid" title="Grid" meta={`${config.rows * config.columns} cells`}>
          <div className="two-col">
            <Labeled label="Rows">
              <NumberField
                label="Rows"
                value={config.rows}
                decimals={0}
                step={1}
                halo={halo === "rows"}
                stepper={{ less: "Fewer rows", more: "More rows" }}
                onCommit={(v) => onCommit("rows", v)}
              />
            </Labeled>
            <Labeled label="Columns">
              <NumberField
                label="Columns"
                value={config.columns}
                decimals={0}
                step={1}
                halo={halo === "columns"}
                stepper={{ less: "Fewer columns", more: "More columns" }}
                onCommit={(v) => onCommit("columns", v)}
              />
            </Labeled>
          </div>
          <Notice notice={notice} keys={["rows", "columns"]} />
        </SidebarSection>

        <SidebarSection id="spacing" title="Spacing">
          <div className="two-col spacing">
            <Labeled label="Horizontal">{field("spacingX", "Horizontal spacing in millimetres")}</Labeled>
            <Labeled label="Vertical">{field("spacingY", "Vertical spacing in millimetres")}</Labeled>
            <Labeled label="Padding">{field("padding", "Outer padding in millimetres")}</Labeled>
            <div className="stack end">
              <span className="lbl">Cell size</span>
              <span className="num cell-size">{cell ? `${cell.width.toFixed(1)} × ${cell.height.toFixed(1)} mm` : "—"}</span>
            </div>
            <div className="span-2">
              <Notice notice={notice} keys={["spacingX", "spacingY", "padding"]} />
            </div>
          </div>
        </SidebarSection>

        <div className="reset-row">
          <Button variant="ghost" className="reset-btn" onClick={onReset}>
            <Reset size={14} />
            Reset settings
          </Button>
        </div>
      </div>

      <div className="shortcuts">
        <div className="shortcuts-head">
          <span>Shortcuts</span>
          <span className="shortcuts-note">Ctrl on Windows</span>
        </div>
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.label} className="shortcut-row">
            <span>{shortcut.label}</span>
            <Keys keys={shortcut.keys} />
          </div>
        ))}
      </div>
    </aside>
  );
}
