# Handover: Multi Photo Frame redesign

**For:** Claude Code, implementing the redesign in the existing codebase.
**Design source:** the "Multi Photo Frame" Design canvas. `screen-reference.dc.html` sits next to this file. It is the markup that renders every screen, so read it for exact structure, sizes, and copy. Its `renderVals()` holds the layout math. Treat it as a visual reference only, and do not port its templating syntax.

**Stack constraints:** React, plain CSS, and Base UI headless components (Button, Input, Menu/Select, Tooltip, Toast). Do not add a UI framework or a CSS-in-JS library.

---

## 0. Before you start

1. Read the current app and map what already exists: state shape, the photo list, settings persistence, export code, and undo history. Reuse the existing logic, because this is a UI redesign, not a rewrite.
2. Do **not** change export output. The preview must match the exported layout exactly, which means the same cell math and object-fit: cover cropping.
3. Section 8 lists proposed changes. Implement only the ones Arthur has ticked. The rest is in scope.
4. Work in small commits, one per section below. Run the app and check each state from section 5 in both themes before moving on.

---

## 1. Design tokens

Put these in `tokens.css` and use them everywhere. Do not hard-code hex values in components. The theme follows `prefers-color-scheme`, and `:root[data-theme]` allows an override if one is ever added.

```css
:root, :root[data-theme="dark"] {
  --bg-app:#0b0c0e; --bg-panel:#101114; --bg-elev:#17181c; --bg-elev-2:#1c1d22; --bg-hover:#22232a;
  --ws:#0b0c0e; --dot:#1c1e23;
  --border:#24262c; --border-strong:#30323a;
  --text:#e8e9ec; --text-2:#a4a7b0; --text-3:#7f828c;
  --accent:#5b5ae6; --accent-strong:#4f4ed6; --accent-text:#a9a8ff; --accent-soft:rgba(91,90,230,.18);
  --drop-tint:rgba(91,90,230,.07); --on-accent:#fff;
  --warn:#e5a54b; --warn-soft:rgba(229,165,75,.10); --warn-border:rgba(229,165,75,.30);
  --danger:#f07272; --success:#4cc38a;
  --tip-bg:#2b2d34; --tip-text:#f1f2f4; --scrim:rgba(0,0,0,.5);
  --paper-shadow:0 0 0 1px rgba(255,255,255,.06),0 24px 64px rgba(0,0,0,.55);
  --pop-shadow:0 0 0 1px rgba(255,255,255,.05),0 12px 32px rgba(0,0,0,.5);
  --focus:0 0 0 2px var(--bg-app),0 0 0 4px #7a79f5;
}
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) {
  --bg-app:#f6f6f8; --bg-panel:#fff; --bg-elev:#f7f7f9; --bg-elev-2:#fff; --bg-hover:#efeff2;
  --ws:#eeeef1; --dot:#d6d7dd;
  --border:#e4e4e9; --border-strong:#d3d4da;
  --text:#16171b; --text-2:#4e515a; --text-3:#696c76;
  --accent:#5250d8; --accent-strong:#4846c9; --accent-text:#4644c4; --accent-soft:rgba(82,80,216,.12);
  --drop-tint:rgba(82,80,216,.06);
  --warn:#9a5a08; --warn-soft:#fdf5e8; --warn-border:#f0d3a2;
  --danger:#c23636; --success:#1d8754;
  --tip-bg:#1d1e23; --tip-text:#f4f4f6; --scrim:rgba(20,20,30,.28);
  --paper-shadow:0 0 0 1px rgba(16,17,22,.06),0 14px 40px rgba(30,30,50,.14);
  --pop-shadow:0 0 0 1px rgba(16,17,22,.07),0 10px 28px rgba(30,30,50,.16);
  --focus:0 0 0 2px #fff,0 0 0 4px #5250d8;
}}
:root{
  --paper:#fff; --cell-empty:#f2f2f4; --cell-empty-line:#c6c7ce; --cell-empty-num:#6b6d75;
  --r-xs:4px; --r-sm:5px; --r-md:6px; --r-lg:8px; --r-xl:10px;
  --s-1:2px; --s-2:4px; --s-3:6px; --s-4:8px; --s-5:12px; --s-6:16px; --s-7:20px; --s-8:24px; --s-9:32px;
  --dur-fast:100ms; --dur-base:120ms; --dur-slow:150ms;
  --ease-out:cubic-bezier(.2,.8,.2,1); --ease-in:cubic-bezier(.4,0,1,1);
  --font:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-reduced-motion: reduce){ *{transition-duration:0ms!important;animation-duration:0ms!important} }
```

**Type** (Inter, with `font-variant-numeric: tabular-nums` on every number):

| Role | Size and weight |
| --- | --- |
| title | 15 / 600 |
| body | 13 / 400 |
| control | 12.5 / 500 |
| section header | 12 / 600 |
| label | 11.5 / 400 |
| status and meta | 11.5 |
| kbd | 11 / 500 |

**Fixed sizes:**

- Top bar: 48 px.
- Status line: 28 px.
- Sidebar: 264 px.
- Controls: 28 px high (24 compact, 22 for steppers).
- Icons: 16 px, 1.4 stroke, thin line style. Use one icon set consistently, for example Lucide at stroke 1.5.

**Radii:**

- Controls: 6 px.
- Popovers and toasts: 8 px.
- Empty-state card: 10 px.
- Canvas and cells: **0**, always.

---

## 2. Layout

```
┌ TopBar 48 ───────────────────────────────────────────────────────────────┐
│ [logo] Multi Photo Frame      [+ Add photos] [trash] | [undo][redo] | [Export PNG] │
├ Sidebar 264 ─┬ Workspace (dotted bg, flex center) ─────────────────────────┤
│ Canvas       │        [overflow notice]                                   │
│ Grid         │        ┌──── paper canvas, scaled to fit ────┐             │
│ Spacing      │        └─────────────────────────────────────┘             │
│ Reset        │        [overflow tray]                                     │
│ ── Shortcuts │                     [selection action bar]   [toast ▸]     │
├──────────────┴─────────────────────────────────────────────────────────────┤
│ StatusLine 28: 12 photos · 3 selected     A3 landscape · 420 × 297 mm · 4961 × 3508 px at 300 DPI | Photos stay in this tab… │
└────────────────────────────────────────────────────────────────────────────┘
```

**Canvas fit:**

```
scale = min((wsW - 128) / mmW, (wsH - 132 - overflowExtra) / mmH)
```

- Use a ResizeObserver on the workspace. `overflowExtra` is 128 px while the overflow notice and tray are visible.
- Render the grid with CSS grid. `padding`, `column-gap`, and `row-gap` are each the mm value × scale.
- The tracks are `repeat(cols, minmax(0,1fr))` and `repeat(rows, minmax(0,1fr))`.
- The canvas has a white background and `--paper-shadow`.

**Narrow window (< 900 px):**

- The sidebar becomes a 300 px left drawer over a scrim. A settings icon button on the left of the top bar opens it and sets `aria-expanded`.
- "Add photos" becomes icon-only, and "Export PNG" becomes "Export".
- The status line drops the size label and the local-photos hint.

---

## 3. Components to build or restyle

| Component | Notes |
| --- | --- |
| `TopBar` | Logo mark (22 px box, 1 px `--border-strong`, nested square). Name is 13/600. Right group gap is 4 px, with 1 × 16 dividers. |
| `IconButton` | 28 × 28, transparent; hover uses `--bg-hover`; disabled is opacity .38. **Every one has `aria-label` and a Base UI Tooltip** with the label and kbd chips. Tooltips open after 500 ms, and switch instantly between buttons. |
| `Button` | Variants: primary (accent), secondary (elev + strong border), ghost. Focus uses `box-shadow: var(--focus)` on `:focus-visible`. Disabled is opacity .42. |
| `Kbd` | 18 px high, 4 px radius, 1 px `--border-strong`, `--bg-elev`. Has an inverted style inside tooltips. Show ⌘ on Mac and Ctrl elsewhere. |
| `NumberField` | Base UI Input with an "mm" suffix in `--text-3`. Accepts comma or dot decimals. ↑/↓ steps by 1, or 10 with ⇧. Clamps on blur and Enter, not on each keystroke. Focus adds an accent border and a 3 px `--accent-soft` halo. |
| `StepperField` | Rows and columns. Integer, with − and + 22 px icon buttons inside the field. |
| `SizePicker` | Base UI Select or Menu. The trigger looks like a field showing "A3 Paper", or "Custom" when no preset matches. Groups are Paper, Photo prints, Frames, and Square frames, and every row shows its mm dimensions on the right in `--text-3`. The current preset gets a check in `--accent-text`. The footer reads "Type any width and height for Custom" with ↑ ↓ ↵ hints. Keep the existing preset list from the code. Picking a preset keeps the current orientation. |
| `RotateButton` | An icon button between the Width and Height fields that swaps them. The section header shows Landscape or Portrait as meta text. |
| `SidebarSection` | Collapsible. The header is a `<button aria-expanded>` with a chevron. Sections are separated by 1 px `--border`. Remember which are collapsed in localStorage, next to the settings. |
| `ShortcutList` | Pinned at the bottom of the sidebar, separated by a border-top. Header "Shortcuts" with "Ctrl on Windows" on the right. Seven rows at 20 px. |
| `Canvas` / `Cell` | Each cell is a div with `background-image` set to the photo URL, `background-size: cover`, and `background-position: center`, or an `<img>` with object-fit: cover, whichever the export uses. Empty cells use `--cell-empty` with a 1 px dashed inset outline and their number at the top left. |
| `SelectionBar` | Absolutely positioned at the bottom center of the workspace, 20 px from the bottom. It is 40 px high, uses `--bg-elev-2` and `--pop-shadow`, and has `role="toolbar"`. Contents: a check dot, "N selected", the file name when exactly one photo is selected, a divider, "Remove ⌫", and "Clear Esc". |
| `Toast` | 340 px wide, bottom right, 20 px inset. Base UI Toast. Use `role="status"` for progress and success, and `role="alert"` for errors. |
| `StatusLine` | 11.5 px, `--text-3`. The pixel size uses `--text-2`, or `--warn` with an icon when the size is over the limit. |

**Selected cell:**

- `outline: 2px solid var(--accent); outline-offset: 2px`.
- A 20 px check badge at the top left, 7 px inset, filled with the accent color, with a 2 px white border and a white check.
- Never rely on the ring alone.

---

## 4. Behavior

### Selection (not in undo history)

| Input | Result |
| --- | --- |
| Click | Selects only that photo and makes it the anchor. |
| Shift-click | Selects the range from the anchor to the clicked photo in reading order, replacing the selection. The anchor stays. |
| Cmd/Ctrl-click | Toggles that photo and makes it the anchor. |
| Cmd/Ctrl+A | Selects all photos, including overflow photos. Not active while a text input has focus. |
| Esc | Cancels a drag in progress. Otherwise clears the selection. |
| Click on an empty cell, the paper margin, or the workspace | Clears the selection. |

- After Remove, the selection is empty.
- After a move, the moved photos stay selected.

### Rearranging photos

Use pointer events, not HTML5 drag and drop.

1. A drag starts after the pointer moves 4 px. If the pressed photo isn't selected, the selection becomes that photo.
2. **Ghost:** a fixed-position element 12 px down and right of the pointer. It stacks up to 3 thumbnails of 112 × 84: the back two are rotated −7° and +4°, and every thumbnail has a 2 px white border. When more than one photo moves, a count badge sits at the top right (22 px pill, accent fill, white border).
3. **Source cells:** opacity .28.
4. **Target:** the cell under the pointer gets these, all in the accent color:
   - a 2 px dashed outline with 2 px offset,
   - a 3 px insertion bar centred in the gap before it, extending 6 px above and below,
   - a chip at the top center reading "Move N here".
5. **Drop:** take the selected photos out of the list in their original relative order, then insert them before the target index. The target index must be adjusted for the removed items. A drop on an empty cell appends to the end. Each move is one undo entry.
6. A drop outside the canvas, or one that wouldn't change the order, animates the ghost back in 150 ms and adds no history.
7. Overflow tray thumbnails start drags the same way.

### Dropping files in from the desktop

- Listen on `window` for dragenter, dragover, dragleave, and drop. Use a depth counter so the overlay doesn't flicker, and only react when `dataTransfer.types` includes "Files".
- **Overlay:** `position: fixed; inset: 0; pointer-events: none; background: var(--drop-tint)`, plus a 2 px dashed accent border inset 6 px with a 10 px radius. Add an accent pill at the top center reading "Drop to add N photos" and "Over a cell to insert there · anywhere else adds to the end". Use `dataTransfer.items.length` for N.
- **Hit testing:** use `elementFromPoint` to find the hovered cell. That cell shows the insertion bar and an "Insert N here" chip.
- Non-image files are skipped, with a toast: "N files skipped — not images".
- A whole drop is one undo entry.

### Undo and redo

| Shortcut | Action |
| --- | --- |
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z | Redo |
| Ctrl+Y | Redo |

- History covers add, remove, and move. It does not cover selection or settings.
- Buttons are disabled when there's nothing to undo or redo. Tooltips still show on hover, for example "Nothing to redo".
- Shortcuts are ignored while a text field has focus, so native field undo keeps working.

### Remove

- Delete or Backspace, the trash button in the top bar, or Remove in the selection bar.
- The trash button is disabled when nothing is selected.
- Always undoable.

### Settings

- Width and height are in mm with 0.1 precision.
- Clamping rules:
  - rows and columns are at least 1,
  - spacing and padding are at least 0,
  - spacing and padding are lowered so every cell stays at least 1 mm.
- When a value is clamped, keep the focus halo on the field for 1.5 s and show a one-line hint below it in `--text-2` with an info icon in `--accent-text`. Examples: "Set to 0 — spacing can't be negative." and "Lowered to 134.0 so every cell stays at least 1 mm." It is not an error style.
- The sidebar shows the computed cell size, for example "Cell size 90.0 × 82.3 mm".
- Settings persist to localStorage. Reset settings is a ghost button below the sections.

### Export

- Pixels: `round(mm / 25.4 * 300)`. A3 landscape gives 4961 × 3508.
- **Idle:** "Export PNG", primary. Disabled when there are no photos, with the tooltip "Add photos to export".
- **In progress:** the button shows a spinner and "Exporting… 48%" and sets `aria-busy`. A toast shows "Rendering PNG", the pixel size, "photo k of n", a 4 px progress bar, and Cancel. The rest of the UI stays usable. Report progress per photo drawn. If cancellation isn't feasible, drop the Cancel button.
- **Success:** a toast with a green check, "PNG exported", the file name, the pixel size, and "Check your downloads folder." It auto-dismisses after 6 s, and the timer pauses on hover.
- **Failure** (`toBlob` returns null, an exception, or a canvas size error): an alert toast, "Export didn't finish — Your browser ran out of room to build an image this large. Your layout is untouched — try a smaller size or close other tabs, then export again." Actions are Try again and Close. It never auto-dismisses.
- **Size warning:** when either side is over 16384 px:
  - an amber note under the Canvas section: "At 300 DPI this is 17717 px wide. Most browsers can't render more than 16384 px, so export will probably fail. You can still try.",
  - the status line pixel size turns amber and gets a warning icon,
  - an amber dot sits on the Export button.

  Export stays enabled.

### Overflow (more photos than cells)

- **Notice:** shown above the canvas. Pill styling, 36 px high, `--bg-elev-2`, `--warn-border`. It reads "**N photos don't fit** and won't be exported. Add rows or columns." with an "Add a row" button and a dismiss X. The notice comes back when the count changes.
- **Tray:** shown below the canvas. It has a dashed `--warn-border` and `--warn-soft` fill, shows 64 × 48 thumbnails at 55% opacity with their numbers, and reads "Not exported · N" in `--warn` with the subtext "Drag one into the grid to swap it in".
- **Status line:** adds "· N not exported" in `--warn`.

### Empty state

- The grid stays visible, with numbered dashed cells.
- **Card:** centered on the paper, 340 px wide, white at 94% opacity, 10 px radius. It contains:
  - a 44 px dashed upload icon,
  - "Drop photos to start",
  - "They fill the N cells row by row. Everything stays on this computer.",
  - a primary "Add photos" button,
  - the hint "JPG, PNG, WebP, HEIC — as many as you like". Only list the formats the app really decodes.
- The card keeps light-theme colors in both themes, because it sits on white paper.

### Local-only hint

The right end of the status line shows a laptop icon and "Photos stay in this tab and clear on reload". It is subtle and never a modal.

---

## 5. States checklist (verify every one in dark and light)

- [ ] 1 Empty: grid visible, card, undo, redo, and export disabled
- [ ] 2 Populated: 12 photos, tooltip on hover
- [ ] 3a Single selection: ring, badge, bar showing the file name
- [ ] 3b Multi-selection: bar showing "3 selected"
- [ ] 4 Dragging photos: ghost with count, dimmed sources, insertion bar, "Move 3 here"
- [ ] 5 Dragging files in: window overlay, pill, "Insert N here" on the hovered cell, layout still visible
- [ ] 6 Overflow: notice, tray, status count
- [ ] 7a Export in progress, 7b success, 7c failure
- [ ] 8 Size warning: sidebar note, amber status, dot on Export, export still possible
- [ ] 9 Disabled: undo and redo with no history, trash with no selection, export with no photos (tooltip explains why)
- [ ] 10 Clamped input: halo plus hint, no error styling
- [ ] Size picker open: groups, check mark, footer
- [ ] Narrow window: drawer closed and open

## 6. Accessibility checklist

- [ ] Every control is a real `<button>`, `<input>`, or `<label>`. Icon-only buttons have `aria-label` and a tooltip.
- [ ] `:focus-visible` uses `--focus` on all interactive elements. Never `outline: none` without a replacement.
- [ ] Text contrast is at least 4.5:1. The token values above already pass, so don't lighten `--text-3`.
- [ ] Selection uses a ring and a check badge. Overflow uses an icon and text, not only amber.
- [ ] Toasts use the right live region roles. The selection bar has `role="toolbar"`.
- [ ] Reduced motion: durations go to 0, and the spinner stops in favor of the static percentage.
- [ ] The canvas grid has an accessible name. Each cell has a label such as "Photo 3, IMG_2041.jpg" or "Empty cell 8".

## 7. Out of scope

- Do not change export logic, DPI, or pixel math. Only add progress reporting and error handling around them.
- No photo persistence, unless proposal 10 is approved.
- Do not add new runtime dependencies beyond Base UI and an icon set. Ask first if one is needed.

## 8. Proposed changes: implement only what Arthur ticks

Items 01–04 and 11 are drawn in the screens. If one is not ticked, leave it out of the UI.

- [ ] 01 Overflow tray. Without it, only the notice and the status count are shown.
- [ ] 02 Remove (trash) button in the top bar, disabled with no selection.
- [ ] 03 Numbers on empty cells, and the cell-size readout in the sidebar.
- [ ] 04 Shortcuts ⌘O (add photos), ⌘E (export), R (rotate).
- [ ] 05 Keyboard reordering: roving tabindex across cells, arrows move focus, Space toggles, ⌥←/→ moves the selection one cell.
- [ ] 06 Rows and columns changes included in undo.
- [ ] 07 "Fit all photos" suggestion in the overflow notice, for example "Use 4 × 4".
- [ ] 08 Per-photo crop focus by double-click and drag. Stored as object-position and used in the export.
- [ ] 09 Hold ⌥ while dropping to swap instead of insert.
- [ ] 10 `beforeunload` warning when photos are loaded (optional IndexedDB persistence later).
- [ ] 11 Descriptive export file name, for example `gallery-a3-landscape-3x4.png`.
- [ ] 12 Low-resolution warning for photos under about 150 DPI in their cell.

## 9. Definition of done

- Every item in sections 5 and 6 is checked in Chrome, Safari, and Firefox at 1440 × 900 and at 768 px wide.
- An export of a populated A3 layout is pixel-identical in layout to the preview: same crops, same gaps.
- No hard-coded colors outside `tokens.css`.
- Short PR description listing which proposals were implemented.
