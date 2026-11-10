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

Only the harness is done. There is no product code yet.

Done:
- Next.js 16 (App Router), React 19, strict TypeScript.
- Base UI (`@base-ui/react`, the renamed `@base-ui-components/react`). The placeholder page uses its `Button`.
- Static export (`output: "export"` in `next.config.ts`). The build produces plain files in `out/`.
- oxlint with the typescript, unicorn, oxc, react and nextjs plugins (`.oxlintrc.json`).
- Vitest with jsdom (`vitest.config.ts`).
- `src/grid.ts`: pure `computeCells(config)` that turns rows, columns, spacing, padding and canvas size into cell rectangles. Tested in `src/grid.test.ts`.
- `src/app/page.test.tsx`: smoke test for the placeholder page.

Not done:
- Photo list state, selection, undo/redo.
- Grid UI, drag and drop, file input.
- Image export.
- `git init` (the directory is not a git repo yet).

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
- **Not decided:** how to export. A canvas `toBlob` is the likely route. Print resolution and DPI need a decision, because large canvases hit browser size limits.

## Suggested next steps

1. Model photo state as a pure reducer: add, remove, move (single and multi), select, undo/redo. Test it before building any UI.
2. Build the grid UI on top: config controls with Base UI, cells from `computeCells`, drag and drop.
3. Add file input and batch drop.
4. Add export, deciding on DPI and size limits.
5. Run `git init` and make a first commit.
