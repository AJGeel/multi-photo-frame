# Handoff: Gallery Frame Maker

## Goal

A front-end app that lays out many photos in a grid and exports one image to send to a printer for framing.

Requirements:
- Photos shown in a grid. Configurable: rows, columns, horizontal spacing, vertical spacing, padding.
- Rearrange photos by drag and drop. Multi-select, and drag the whole selection.
- Remove photos, with undo (Ctrl+Z).
- Add photos one at a time, or in a batch (drag and drop onto the page).
- Export the result as an image.
- 100% local. Nothing is sent to a backend.

## Status

Working app. Product code:
- `src/photos.ts`: pure reducer for add, remove, move (multi), select, undo/redo, plus `dropIndex`. Tested.
- `src/grid.ts`: `computeCells` and `sanitizeConfig` (lengths in mm, 0.1 precision, cells stay at least 1mm). Tested.
- `src/presets.ts`: European paper (ISO A), photo print and frame sizes in mm. Tested.
- `src/preferences.ts`: Zustand store with `persist` (localStorage) for the grid settings. Hydrates after mount (`skipHydration`) to avoid a hydration mismatch. Tested.
- `src/export.ts`: PNG export at a fixed 300 DPI, with a warning when the size is likely too big for the browser. Pure parts tested; the canvas drawing is not (jsdom has no canvas).
- `src/frame-maker.tsx`: the UI (settings, preview grid, drag and drop, file input, batch drop, keyboard shortcuts, export button).

Not persisted: the photos themselves (in-memory object URLs, lost on reload).

## Future improvements

Export is the weakest part. Known gaps, roughly in priority order:

1. **Canvas size limits.** DPI is fixed at 300. Browsers cap canvas size (Chrome 16384 px per side and about 268M px area, Safari and mobile much less), so very large sizes (a few metres at 300 DPI) fail. Today we only warn. Options: lower the DPI automatically to fit, let the user pick a DPI, or render in tiles and stitch them into a PNG/TIFF without one big canvas (for example with `OffscreenCanvas` in a worker and a streaming encoder).
2. **DPI metadata.** `canvas.toBlob` PNGs carry no DPI. Print shops usually go by pixel size, but a `pHYs` chunk (or a JPEG/TIFF with density) would make the image open at its real size in editors.
3. **Other formats.** JPEG (smaller files), PDF at the exact physical size, TIFF.
4. **Print extras.** Bleed and crop marks, a background colour, and an optional border around each photo.
5. **Photo persistence.** Keep photos across reloads in IndexedDB.
6. **Per-photo crop.** Photos always fill their cell (cover). Allow choosing the focal point or fit-inside.
7. **Test the canvas path.** Add a browser-based test (Playwright or Vitest browser mode).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Static build into `out/` |
| `npm start` | Serve `out/` (`npx serve out`, downloads `serve` on first use) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | oxlint |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run check` | Typecheck, lint and test. Run this before calling anything done. |

## Decisions and gotchas

- **Static export is intentional.** It enforces the "nothing leaves the browser" rule. Avoid anything that needs a server: API routes, server actions, `next/image` optimization (already set to `unoptimized`), middleware.
- **Everything interactive will be client code.** Add `"use client"` where needed. Photos stay in memory as `File`/object URLs, so reloading the page loses them unless persistence is added.
- **Vitest 5 has no `esbuild.jsx` option.** JSX works through `tsconfig.json` (`jsx: react-jsx`, set by Next). Don't add the option back.
- **Next rewrites `tsconfig.json` on build.** It added `esModuleInterop`, `resolveJsonModule` and the `.next/dev/types` include. That's expected.
- **`react/react-in-jsx-scope` is off** in `.oxlintrc.json` because React 19 uses the automatic JSX runtime.
- **Rows and columns in `computeCells`** assume at least 1 each. There is no validation yet. Add it where the config enters from the UI.
- **Export is a single canvas at a fixed 300 DPI.** Decided for now; see Future improvements for the size-limit problem.
