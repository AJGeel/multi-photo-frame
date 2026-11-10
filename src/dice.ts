import { FRAME_STYLES, type FrameStyle } from "./frames";
import { computeCells, sanitizeConfig, type GridConfig } from "./grid";
import { PRESETS, presetSize } from "./presets";

export interface Roll {
  config: GridConfig;
  frame: FrameStyle;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** A photo-friendly cell: not a sliver, not too far from the usual 3:2 or 4:3. */
const MIN_ASPECT = 0.7;
const MAX_ASPECT = 1.6;
/** Counts up to this get a grid that holds every photo. Beyond it, any pleasant grid will do. */
const FIT_LIMIT = 64;

/**
 * Random but sensible settings: a real paper or frame size in either orientation, margins in proportion
 * to it, and a grid whose cells suit photos. With photos loaded, the grid holds all of them when it can.
 * `random` returns a number from 0 up to 1, so tests can pass a fixed sequence.
 */
export function rollDice(photoCount: number, random: () => number = Math.random): Roll {
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;
  const between = (min: number, max: number) => min + random() * (max - min);

  const preset = pick(PRESETS);
  const { width, height } = presetSize(preset, random() < 0.5);
  const short = Math.min(width, height);
  const padding = round1(short * between(0.03, 0.09));
  const spacingX = round1(short * between(0.01, 0.035));
  const spacingY = random() < 0.8 ? spacingX : round1(short * between(0.01, 0.035));

  const base = { width, height, padding, spacingX, spacingY };
  const candidates: { rows: number; columns: number }[] = [];
  const fit = photoCount > 0 && photoCount <= FIT_LIMIT;
  for (let rows = 1; rows <= 10; rows++) {
    for (let columns = 1; columns <= 10; columns++) {
      const cells = rows * columns;
      if (fit ? cells < photoCount || cells > photoCount + Math.max(3, Math.ceil(photoCount * 0.4)) : cells < 4 || cells > 30) continue;
      const trial = sanitizeConfig({ ...base, rows, columns });
      if (trial.rows !== rows || trial.columns !== columns) continue;
      const cell = computeCells(trial)[0];
      if (!cell || cell.height <= 0) continue;
      const aspect = cell.width / cell.height;
      if (aspect >= MIN_ASPECT && aspect <= MAX_ASPECT) candidates.push({ rows, columns });
    }
  }
  // Nothing suits this size: fall back to a plain grid that holds the photos.
  const grid = candidates.length > 0 ? pick(candidates) : { rows: 3, columns: Math.max(Math.ceil(Math.max(photoCount, 1) / 3), 1) };

  const frame = random() < 0.15 ? "none" : pick(FRAME_STYLES.filter((style) => style.id !== "none")).id;
  return { config: sanitizeConfig({ ...base, ...grid }), frame };
}
