"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Close, Keyboard } from "./icons";
import { useIsTouch } from "./platform";
import { Keys } from "./ui";

const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Select all", keys: ["mod", "A"] },
  { label: "Add to range", keys: ["shift", "Click"] },
  { label: "Select multiple", keys: ["mod", "Click"] },
  { label: "Clear selection", keys: ["Esc"] },
  { label: "Remove", keys: ["backspace"] },
  { label: "Undo", keys: ["mod", "Z"] },
  { label: "Redo", keys: ["shift", "mod", "Z"] },
];

/** Renders nothing on touch devices. Use `useIsTouch` to hide anything that goes with it. */
export function ShortcutsDialog() {
  const touch = useIsTouch();
  if (touch) return null;
  return (
    <Dialog.Root>
      <Dialog.Trigger className="shortcuts-trigger">
        <Keyboard size={14} />
        Keyboard shortcuts
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog-popup">
          <div className="shortcuts-head">
            <Dialog.Title className="dialog-title">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close className="dialog-close" aria-label="Close">
              <Close size={14} />
            </Dialog.Close>
          </div>
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className="shortcut-row">
              <span>{shortcut.label}</span>
              <Keys keys={shortcut.keys} />
            </div>
          ))}
          <span className="shortcuts-note">Ctrl on Windows</span>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
