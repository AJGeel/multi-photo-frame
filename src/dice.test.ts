import { describe, expect, it } from "vitest";
import { rollDice } from "./dice";
import { computeCells } from "./grid";

/** A repeatable pseudo-random sequence. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("rollDice", () => {
  it("always returns valid settings with photo-friendly cells", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { config } = rollDice(0, seeded(seed));
      const cell = computeCells(config)[0]!;
      expect(config.rows).toBeGreaterThanOrEqual(1);
      expect(config.columns).toBeGreaterThanOrEqual(1);
      expect(config.padding).toBeGreaterThanOrEqual(0);
      expect(cell.width).toBeGreaterThan(10);
      expect(cell.height).toBeGreaterThan(10);
      expect(cell.width / cell.height).toBeGreaterThan(0.5);
      expect(cell.width / cell.height).toBeLessThan(2);
    }
  });

  it("holds every photo when it can, without lots of empty cells", () => {
    for (const count of [1, 5, 12, 40]) {
      for (let seed = 1; seed <= 50; seed++) {
        const { config } = rollDice(count, seeded(seed));
        const cells = config.rows * config.columns;
        expect(cells).toBeGreaterThanOrEqual(count);
        expect(cells).toBeLessThanOrEqual(count + Math.max(3, Math.ceil(count * 0.4)));
      }
    }
  });

  it("does not force a fit for huge piles", () => {
    const { config } = rollDice(333, seeded(7));
    expect(config.rows * config.columns).toBeLessThanOrEqual(100);
  });

  it("gives different results for different dice", () => {
    const results = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(rollDice(0, seeded(i + 1)))));
    expect(results.size).toBeGreaterThan(10);
  });
});
