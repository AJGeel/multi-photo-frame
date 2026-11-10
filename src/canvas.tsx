"use client";

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { GridConfig } from "./grid";
import { Check, Upload, Warning } from "./icons";
import type { Focus, Photo } from "./photos";
import type { FileDropState } from "./use-file-drop";
import type { DragState } from "./use-rearrange";
import { usePreferences } from "./preferences";
import { Button } from "./ui";

interface CanvasProps {
  config: GridConfig;
  /** Pixels per millimetre. */
  scale: number;
  photos: Photo[];
  selected: ReadonlySet<string>;
  drag: DragState | null;
  fileDrop: FileDropState | null;
  /** Photos shown with a low-resolution warning. */
  lowRes: ReadonlySet<string>;
  /** Cell that is in the tab order. */
  tabIndexCell: number;
  /** Photo being cropped, and its live focus while dragging. */
  cropId: string | null;
  cropFocus: Focus | null;
  onPointerDown: (event: PointerEvent<HTMLElement>, photo: Photo) => void;
  onCellClick: (event: MouseEvent, index: number) => void;
  onDoubleClick: (photo: Photo) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, index: number) => void;
  onFocusCell: (index: number) => void;
  onAddPhotos: () => void;
}

export function Canvas(props: CanvasProps) {
  const { config, scale, photos, selected, drag, fileDrop, lowRes, cropId, cropFocus } = props;
  const count = config.rows * config.columns;
  const px = (mm: number) => +(mm * scale).toFixed(1);
  const paperColor = usePreferences((s) => s.paperColor);
  const dragging = drag !== null && !drag.returning ? drag : null;
  const dragIds = dragging ? new Set(dragging.ids) : null;
  const target = dragging ? dragging.targetIndex : fileDrop ? fileDrop.cellIndex : null;
  const chip = dragging ? (dragging.alt && dragging.ids.length === 1 ? "Swap here" : `Move ${dragging.ids.length} here`) : fileDrop ? `Insert ${fileDrop.count} here` : "";

  return (
    <div className="canvas" role="group" aria-label="Photo grid" style={{ width: Math.round(config.width * scale), height: Math.round(config.height * scale), background: paperColor }}>
      <div
        className="canvas-grid"
        style={{
          gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
          columnGap: px(config.spacingX),
          rowGap: px(config.spacingY),
          padding: px(config.padding),
        }}
      >
        {Array.from({ length: count }, (_, index) => {
          const photo = photos[index];
          const isSelected = photo !== undefined && selected.has(photo.id);
          const isSource = photo !== undefined && dragIds?.has(photo.id) === true;
          const isTarget = target === index;
          const cropping = photo !== undefined && photo.id === cropId;
          const focus = cropping && cropFocus ? cropFocus : (photo?.focus ?? { x: 0.5, y: 0.5 });
          const classes = ["cell", photo ? "filled" : "empty", isSelected && !dragging ? "selected" : "", isSource ? "source" : "", isTarget ? "target" : "", cropping ? "cropping" : ""];
          return (
            <div
              key={index}
              className={classes.filter(Boolean).join(" ")}
              data-cell-index={index}
              data-photo-id={photo?.id}
              role={photo ? "button" : "img"}
              aria-label={photo ? `Photo ${index + 1}, ${photo.name}` : `Empty cell ${index + 1}`}
              aria-pressed={photo ? isSelected : undefined}
              tabIndex={photo && index === props.tabIndexCell ? 0 : -1}
              onPointerDown={photo ? (event) => props.onPointerDown(event, photo) : undefined}
              onClick={(event) => props.onCellClick(event, index)}
              onDoubleClick={photo ? () => props.onDoubleClick(photo) : undefined}
              onKeyDown={(event) => props.onKeyDown(event, index)}
              onFocus={() => photo && props.onFocusCell(index)}
            >
              {photo ? (
                // Local blob URLs: next/image optimization does not apply.
                // oxlint-disable-next-line next/no-img-element
                <img src={photo.thumb ?? photo.src} decoding="async" alt="" draggable={false} style={{ objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }} />
              ) : (
                <span className="cell-num num">{index + 1}</span>
              )}
              {isSelected && !dragging && (
                <span className="cell-badge" aria-hidden="true">
                  <Check size={11} stroke={2.4} />
                </span>
              )}
              {photo && lowRes.has(photo.id) && !dragging && (
                <span className="cell-lowres" title="Low resolution: this photo may look soft when printed at this size">
                  <Warning size={12} stroke={1.6} />
                  <span className="sr-only">Low resolution</span>
                </span>
              )}
              {cropping && <span className="chip crop-chip">Drag to reposition · Esc to finish</span>}
              {isTarget && (
                <>
                  <span className="insert-bar" aria-hidden="true" style={{ left: -px(config.spacingX) / 2 - 1.5 }} />
                  <span className="chip">{chip}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {photos.length === 0 && (
        <div className="empty-wrap">
          <div className="empty-card">
            <div className="empty-icon">
              <Upload size={20} stroke={1.3} />
            </div>
            <div className="empty-text">
              <span className="empty-title">Drop photos to start</span>
              <span className="empty-sub">They fill the {count} cells row by row. Everything stays on this computer.</span>
            </div>
            <Button variant="primary" onClick={props.onAddPhotos}>
              Add photos
            </Button>
            <span className="empty-hint">JPG, PNG, WebP — as many as you like</span>
          </div>
        </div>
      )}
    </div>
  );
}
