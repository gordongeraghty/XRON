/**
 * Dictionary overflow and base-62 encoding tests.
 *
 * Validates that dictionary references scale correctly beyond the
 * legacy numeric range, using base-62 encoding for compact refs.
 */

import { describe, it, expect } from 'vitest';
import { buildDictionary, createDictLookup, isDictRef, resolveDictRef } from '../../src/pipeline/dictionary.js';
import { XRON } from '../../src/index.js';

describe('Dictionary Overflow & Base-62 Encoding', () => {

  // ─── Base-62 Index Encoding via createDictLookup ─────────────

  describe('base-62 index encoding via createDictLookup', () => {
    it('produces $0 through $9 for first 10 entries', () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        value: `val_${i}`,
        index: i,
        frequency: 5,
        savings: 2,
      }));
      const lookup = createDictLookup(entries);
      for (let i = 0; i < 10; i++) {
        expect(lookup.get(`val_${i}`)).toBe(`$${i}`);
      }
    });

    it('produces two-char base-62 ref "$00" at index 62', () => {
      const entries = Array.from({ length: 63 }, (_, i) => ({
        value: `val_${i}`,
        index: i,
        frequency: 5,
        savings: 2,
      }));
      const lookup = createDictLookup(entries);
      // Index 0 → $0, Index 61 → $Z, Index 62 → $00
      expect(lookup.get('val_0')).toBe('$0');
      expect(lookup.get('val_62')).toBe('$00');
    });
  });

  // ─── isDictRef Recognition ───────────────────────────────────

  describe('isDictRef recognition', () => {
    it.each([
      ['$0', true],
      ['$9', true],
      ['$a', true],
      ['$Z', true],
      ['$aB', true],
      ['$123', true],
    ])('recognises %s as a dict ref → %s', (input, expected) => {
      expect(isDictRef(input)).toBe(expected);
    });

    it.each([
      ['hello', false],
      ['$', false],
      ['$abc', false],
    ])('rejects %s as a dict ref → %s', (input, expected) => {
      expect(isDictRef(input)).toBe(expected);
    });
  });

  // ─── resolveDictRef ──────────────────────────────────────────

  describe('resolveDictRef', () => {
    const dict = ['foo', 'bar'];

    it('resolves $0 to first entry', () => {
      expect(resolveDictRef('$0', dict)).toBe('foo');
    });

    it('resolves $1 to second entry', () => {
      expect(resolveDictRef('$1', dict)).toBe('bar');
    });

    it('returns null for out-of-range index', () => {
      expect(resolveDictRef('$99', dict)).toBeNull();
    });
  });

  // ─── Full Round-Trip with Large Dictionary ───────────────────

  describe('large dictionary round-trip (100+ unique values)', () => {
    it('round-trips 200 items with 100 unique repeated strings', () => {
      const items: { val: string; id: number }[] = [];
      for (let i = 0; i < 200; i++) {
        items.push({ val: `value_${i % 100}`, id: i });
      }
      const xron = XRON.stringify(items, { level: 2 });
      const result = XRON.parse(xron);
      expect(result).toEqual(items);
    });
  });

  // ─── MAX_BASE62_ENTRIES Clamping ─────────────────────────────

  describe('MAX_BASE62_ENTRIES clamping', () => {
    it('buildDictionary with maxSize=5000 does not exceed 3906 entries', () => {
      // Generate data with many unique repeated strings
      const obj: Record<string, string> = {};
      for (let i = 0; i < 5000; i++) {
        obj[`k${i}`] = `unique_value_${i}_padded`;
      }
      // Repeat the data so every value has frequency >= 2
      const data = [obj, { ...obj }];
      const entries = buildDictionary(data, {
        maxSize: 5000,
        minLength: 2,
        minFrequency: 2,
      });
      expect(entries.length).toBeLessThanOrEqual(3906);
    });
  });
});
