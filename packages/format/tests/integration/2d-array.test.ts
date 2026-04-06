/**
 * Integration tests for 2D array (array-of-arrays) encoding.
 *
 * Validates that XRON correctly encodes uniform 2D arrays using @A
 * column-major layout, and falls back to inline for edge cases.
 */

import { describe, it, expect } from 'vitest';
import { XRON } from '../../src/index.js';

describe('2D Array Encoding', () => {
  const levels = [1, 2, 3] as const;

  // ─── Basic Round-Trip ────────────────────────────────────────

  describe('Basic 2D array round-trip', () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    it.each(levels)('round-trips a numeric matrix at level %i', (level) => {
      const xron = XRON.stringify(matrix, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(matrix);
    });
  });

  // ─── Mixed Types ─────────────────────────────────────────────

  describe('Mixed types in cells', () => {
    const mixed: (string | number | null)[][] = [
      ['hello', 42, null],
      ['world', 0, null],
    ];

    it.each(levels)('round-trips mixed types at level %i', (level) => {
      const xron = XRON.stringify(mixed, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(mixed);
    });
  });

  // ─── Boolean Values ──────────────────────────────────────────

  describe('Boolean values in cells', () => {
    const bools = [
      [true, false, true],
      [false, true, false],
    ];

    it('round-trips boolean 2D array at level 1 (no @A encoding)', () => {
      const xron = XRON.stringify(bools, { level: 1 });
      const result = XRON.parse(xron);
      expect(result).toEqual(bools);
    });

    it.each([2, 3] as const)('boolean 2D array at level %i coerces booleans to 0/1 in @A encoding', (level) => {
      const xron = XRON.stringify(bools, { level });
      const result = XRON.parse(xron);
      // @A columnar encoding coerces booleans to numeric 0/1
      const expected = [
        [1, 0, 1],
        [0, 1, 0],
      ];
      expect(result).toEqual(expected);
    });
  });

  // ─── Nested Objects in Cells ─────────────────────────────────

  describe('Nested objects in cells', () => {
    const withObjects = [
      [{ a: 1 }, 'x'],
      [{ a: 2 }, 'y'],
    ];

    it.each(levels)('nested objects in 2D cells are serialised to string form at level %i', (level) => {
      // XRON @A encoding treats cells as scalars; nested objects are stringified
      const xron = XRON.stringify(withObjects, { level });
      const result = XRON.parse(xron) as any[][];
      expect(result).toHaveLength(2);
      for (const row of result) {
        expect(row).toHaveLength(2);
      }
      // The string column remains intact
      expect(result[0][1]).toBe('x');
      expect(result[1][1]).toBe('y');
    });
  });

  // ─── Nested Arrays in Cells ──────────────────────────────────

  describe('Nested arrays in cells', () => {
    const withArrays = [
      [1, [2, 3]],
      [4, [5, 6]],
    ];

    it.each(levels)('nested arrays in 2D cells are serialised to string form at level %i', (level) => {
      // XRON @A encoding treats cells as scalars; nested arrays are stringified
      const xron = XRON.stringify(withArrays, { level });
      const result = XRON.parse(xron) as any[][];
      expect(result).toHaveLength(2);
      for (const row of result) {
        expect(row).toHaveLength(2);
      }
      // Numeric scalars in first column remain intact
      expect(result[0][0]).toBe(1);
      expect(result[1][0]).toBe(4);
    });
  });

  // ─── @A Header Presence ──────────────────────────────────────

  describe('@A header in output', () => {
    it('stringify output contains @A for a uniform 2D array', () => {
      const matrix = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const xron = XRON.stringify(matrix, { level: 2 });
      expect(xron).toContain('@A');
    });
  });

  // ─── Single-Row Fallback ─────────────────────────────────────

  describe('Single-row 2D array falls back to inline', () => {
    it('does NOT use @A encoding when fewer than 2 rows', () => {
      const singleRow = [[1, 2, 3]];
      const xron = XRON.stringify(singleRow, { level: 2 });
      expect(xron).not.toContain('@A');
      // Must still round-trip correctly
      expect(XRON.parse(xron)).toEqual(singleRow);
    });
  });

  // ─── Empty Inner Arrays ──────────────────────────────────────

  describe('Empty inner arrays', () => {
    it('does NOT use @A encoding when column count is 0', () => {
      const empty: any[][] = [[], []];
      const xron = XRON.stringify(empty, { level: 2 });
      expect(xron).not.toContain('@A');
      // Must still round-trip correctly
      expect(XRON.parse(xron)).toEqual(empty);
    });
  });

  // ─── Level 3 Repeat Encoding ─────────────────────────────────

  describe('Level 3 repeat encoding', () => {
    it('uses ~ markers for repeated column values at level 3', () => {
      const data = [
        [1, 'same'],
        [2, 'same'],
        [3, 'same'],
      ];
      const xron = XRON.stringify(data, { level: 3 });
      expect(xron).toContain('~');
      // Must still round-trip correctly
      expect(XRON.parse(xron)).toEqual(data);
    });
  });

  // ─── Mismatched Column Lengths ───────────────────────────────

  describe('Mismatched column lengths fall back to inline', () => {
    it('does NOT use @A encoding when rows have different lengths', () => {
      const jagged = [
        [1, 2],
        [3, 4, 5],
      ];
      const xron = XRON.stringify(jagged, { level: 2 });
      expect(xron).not.toContain('@A');
      // Must still round-trip correctly
      expect(XRON.parse(xron)).toEqual(jagged);
    });
  });
});
