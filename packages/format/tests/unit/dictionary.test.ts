import { describe, it, expect } from 'vitest';
import { buildDictionary, createDictLookup, resolveDictRef, isDictRef } from '../../src/pipeline/dictionary.js';

describe('Dictionary Encoding', () => {
  it('builds dictionary from repeated string values', () => {
    const data = [
      { dept: 'Sales' },
      { dept: 'Sales' },
      { dept: 'Engineering' },
      { dept: 'Engineering' },
      { dept: 'Sales' },
    ];
    const entries = buildDictionary(data, { maxSize: 256, minLength: 2, minFrequency: 2 });
    expect(entries.length).toBeGreaterThan(0);
    // Dictionary sorts by savings (frequency × length), so Engineering (11 chars × 2) may rank above Sales (5 chars × 3)
    const salesEntry = entries.find(e => e.value === 'Sales');
    expect(salesEntry).toBeDefined();
    expect(salesEntry!.frequency).toBe(3);
  });

  it('does NOT include values below minimum frequency', () => {
    const data = [{ x: 'rare_string' }];
    const entries = buildDictionary(data, { maxSize: 256, minLength: 2, minFrequency: 2 });
    expect(entries.length).toBe(0);
  });

  it('does NOT include very short values below minimum length', () => {
    const data = [{ x: 'a' }, { x: 'a' }, { x: 'a' }];
    const entries = buildDictionary(data, { maxSize: 256, minLength: 2, minFrequency: 2 });
    expect(entries.length).toBe(0);
  });

  it('creates lookup map from entries', () => {
    const data = [
      { dept: 'Sales' }, { dept: 'Sales' },
      { dept: 'Engineering' }, { dept: 'Engineering' },
    ];
    const entries = buildDictionary(data, { maxSize: 256, minLength: 2, minFrequency: 2 });
    const lookup = createDictLookup(entries);
    // At least one of the repeated values should be in the dictionary
    const hasEntry = lookup.has('Sales') || lookup.has('Engineering');
    expect(hasEntry).toBe(true);
  });

  it('resolves dictionary references', () => {
    const dict = ['Sales', 'Engineering', 'Marketing'];
    expect(resolveDictRef('$0', dict)).toBe('Sales');
    expect(resolveDictRef('$1', dict)).toBe('Engineering');
    expect(resolveDictRef('$2', dict)).toBe('Marketing');
    expect(resolveDictRef('$99', dict)).toBeNull();
  });

  it('identifies dictionary references', () => {
    expect(isDictRef('$0')).toBe(true);
    expect(isDictRef('$123')).toBe(true);
    expect(isDictRef('hello')).toBe(false);
    expect(isDictRef('$')).toBe(false);
    expect(isDictRef('$abc')).toBe(false);
  });

  it('respects maxSize limit', () => {
    const data: any = {};
    for (let i = 0; i < 500; i++) {
      data[`key${i}`] = `value_${i % 10}_repeated`;
    }
    const arr = Array.from({ length: 50 }, () => data);
    const entries = buildDictionary(arr, { maxSize: 5, minLength: 2, minFrequency: 2 });
    expect(entries.length).toBeLessThanOrEqual(5);
  });
});
