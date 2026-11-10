"use client";

import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import { FORMAT_LABELS, type ExportFormat, type ExportOptions } from "./export";
import { Chevron, Download, Spinner } from "./icons";
import { Button, Keys, NumberField, Tip } from "./ui";

const FORMATS: { id: ExportFormat; note: string }[] = [
  { id: "jpeg", note: "Small file, great for print" },
  { id: "pdf", note: "Exact paper size, for print shops" },
  { id: "png", note: "Lossless, very large" },
];

interface ExportMenuProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
  onExport: () => void;
  noPhotos: boolean;
  /** Progress while an export runs. */
  busy: { percent: number } | null;
  /** The size is over what browsers can render. */
  oversize: boolean;
  compact: boolean;
}

const clampQuality = (value: number) => Math.min(Math.max(Math.round(value), 50), 100);

/** One button: opens the format choices, with the JPEG quality percentage editable in place. */
export function ExportMenu({ options, onChange, onExport, noPhotos, busy, oversize, compact }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const label = FORMAT_LABELS[options.format];
  const lossy = options.format !== "png";

  return (
    <Popover.Root open={open && !busy && !noPhotos} onOpenChange={setOpen}>
      <Tip label={noPhotos ? "Add photos to export" : "Export options"} keys={noPhotos ? undefined : ["mod", "E"]}>
        <Popover.Trigger
          render={
            <Button variant="primary" className="export-btn" disabled={noPhotos} aria-busy={busy !== null || undefined}>
              {busy ? (
                <>
                  <Spinner />
                  <span className="num">Exporting… {busy.percent}%</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  {compact ? "Export" : `Export ${label}`}
                  <Chevron size={12} />
                  {oversize && <span className="warn-dot" role="img" aria-label="Large export warning" />}
                </>
              )}
            </Button>
          }
        />
      </Tip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="select-positioner">
          <Popover.Popup className="pop export-pop" aria-label="Export options">
            <div role="radiogroup" aria-label="Format" className="export-options">
              {FORMATS.map((format) => {
                const selected = options.format === format.id;
                return (
                  <div key={format.id} className="export-row" data-selected={selected || undefined}>
                    <button type="button" role="radio" aria-checked={selected} className="export-choice" onClick={() => onChange({ ...options, format: format.id })}>
                      <span className="radio" aria-hidden="true" />
                      <span className="export-text">
                        <span className="export-name">{FORMAT_LABELS[format.id]}</span>
                        <span className="export-note">{format.note}</span>
                      </span>
                    </button>
                    {format.id !== "png" && (
                      <span className="export-quality">
                        <NumberField
                          label={`${FORMAT_LABELS[format.id]} quality in percent`}
                          value={options.quality}
                          decimals={0}
                          step={1}
                          unit="%"
                          onCommit={(quality) => onChange({ format: format.id, quality: clampQuality(quality) })}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="export-foot">
              <Button
                variant="primary"
                className="export-go"
                onClick={() => {
                  setOpen(false);
                  onExport();
                }}
              >
                <Download size={14} />
                Export {label}
                {lossy ? ` · ${options.quality}%` : ""}
                <Keys keys={["mod", "E"]} />
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
