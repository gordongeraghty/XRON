/**
 * CRITICAL: Lossless Round-Trip Tests
 *
 * These tests prove that XRON.parse(XRON.stringify(data)) === data
 * for all supported data types and compression levels.
 */

import { describe, it, expect } from 'vitest';
import { XRON } from '../../src/index.js';

describe('XRON Round-Trip: Lossless Guarantee', () => {
  const levels = [1, 2, 3] as const;

  // ─── Primitives ──────────────────────────────────────────────

  describe('Primitives', () => {
    it.each(levels)('null round-trips at level %i', (level) => {
      const result = XRON.parse(XRON.stringify(null, { level }));
      expect(result).toBe(null);
    });

    it.each(levels)('booleans round-trip at level %i', (level) => {
      expect(XRON.parse(XRON.stringify(true, { level }))).toBe(true);
      expect(XRON.parse(XRON.stringify(false, { level }))).toBe(false);
    });

    it.each(levels)('numbers round-trip at level %i', (level) => {
      expect(XRON.parse(XRON.stringify(42, { level }))).toBe(42);
      expect(XRON.parse(XRON.stringify(-3.14, { level }))).toBe(-3.14);
      expect(XRON.parse(XRON.stringify(0, { level }))).toBe(0);
      expect(XRON.parse(XRON.stringify(1e10, { level }))).toBe(1e10);
    });

    it.each(levels)('strings round-trip at level %i', (level) => {
      expect(XRON.parse(XRON.stringify('hello', { level }))).toBe('hello');
      expect(XRON.parse(XRON.stringify('', { level }))).toBe('');
      expect(XRON.parse(XRON.stringify('with spaces', { level }))).toBe('with spaces');
    });
  });

  // ─── Simple Arrays ───────────────────────────────────────────

  describe('Simple Arrays of Objects', () => {
    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
      { id: 2, name: 'Bob', email: 'bob@example.com', active: false },
      { id: 3, name: 'Carol', email: 'carol@example.com', active: true },
    ];

    it.each(levels)('users array round-trips at level %i', (level) => {
      const xron = XRON.stringify(users, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(users);
    });
  });

  // ─── Repeated Values (Dictionary) ────────────────────────────

  describe('Repeated Values (Dictionary Encoding)', () => {
    const employees = [
      { id: 1, name: 'Alice', dept: 'Sales', active: true },
      { id: 2, name: 'Bob', dept: 'Engineering', active: false },
      { id: 3, name: 'Carol', dept: 'Sales', active: true },
      { id: 4, name: 'Dave', dept: 'Engineering', active: true },
      { id: 5, name: 'Eve', dept: 'Sales', active: false },
    ];

    it.each(levels)('employees with repeated departments round-trip at level %i', (level) => {
      const xron = XRON.stringify(employees, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(employees);
    });
  });

  // ─── Sequential IDs (Delta) ──────────────────────────────────

  describe('Sequential Data (Delta Encoding)', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `User${i + 1}`,
      score: (i + 1) * 10,
    }));

    it.each(levels)('sequential records round-trip at level %i', (level) => {
      const xron = XRON.stringify(records, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(records);
    });
  });

  // ─── Nested Objects ──────────────────────────────────────────

  describe('Nested Objects', () => {
    const data = [
      { id: 1, name: 'Alice', address: { street: '123 Main', city: 'NYC', zip: '10001' } },
      { id: 2, name: 'Bob', address: { street: '456 Oak', city: 'LA', zip: '90001' } },
    ];

    it.each(levels)('nested objects round-trip at level %i', (level) => {
      const xron = XRON.stringify(data, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(data);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────

  describe('Edge Cases', () => {
    it.each(levels)('empty array round-trips at level %i', (level) => {
      expect(XRON.parse(XRON.stringify([], { level }))).toEqual([]);
    });

    it.each(levels)('single-item array round-trips at level %i', (level) => {
      const data = [{ id: 1, name: 'Alice' }];
      // Single-item arrays won't get schema (need freq >= 2), but should still round-trip
      const xron = XRON.stringify(data, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(data);
    });

    it.each(levels)('null values in objects round-trip at level %i', (level) => {
      const data = [
        { id: 1, name: 'Alice', email: null },
        { id: 2, name: 'Bob', email: null },
      ];
      const xron = XRON.stringify(data, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(data);
    });

    it('throws on circular references', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      expect(() => XRON.stringify(obj)).toThrow('Circular reference');
    });

    it('throws on BigInt', () => {
      expect(() => XRON.stringify(BigInt(42))).toThrow('BigInt');
    });
  });

  // ─── Large Dataset ───────────────────────────────────────────

  describe('Large Dataset', () => {
    const departments = ['Sales', 'Engineering', 'Marketing', 'Support', 'HR'];
    const largeData = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Employee${i + 1}`,
      email: `emp${i + 1}@company.com`,
      department: departments[i % departments.length],
      active: i % 3 !== 0,
      salary: 50000 + (i * 1000),
    }));

    it.each(levels)('100-row dataset round-trips at level %i', (level) => {
      const xron = XRON.stringify(largeData, { level });
      const result = XRON.parse(xron);
      expect(result).toEqual(largeData);
    });
  });

  describe('Standalone Objects (no repeating schema)', () => {
    const config = {
      app: 'MyApplication',
      version: '2.1.0',
      environment: 'production',
      debug: false,
      database: { host: 'db.example.com', port: 5432, name: 'myapp_prod', ssl: true },
      cache: { provider: 'redis', host: 'cache.example.com', port: 6379, ttl: 3600 },
    };

    it.each(levels)('single config object round-trips at level %i', (level) => {
      const xron = XRON.stringify(config, { level });
      const parsed = XRON.parse(xron);
      expect(parsed).toEqual(config);
    });

    it.each(levels)('object with array field round-trips at level %i', (level) => {
      const data = {
        name: 'MyService',
        tags: ['production', 'v2', 'stable'],
        limits: { requests: 1000, memory: 512 },
      };
      const xron = XRON.stringify(data, { level });
      const parsed = XRON.parse(xron);
      expect(parsed).toEqual(data);
    });

    it.each(levels)('deeply nested object round-trips at level %i', (level) => {
      const data = {
        level1: { level2: { level3: { value: 'deep', count: 42 } } },
      };
      const xron = XRON.stringify(data, { level });
      const parsed = XRON.parse(xron);
      expect(parsed).toEqual(data);
    });
  });

  describe("Auto-level round-trips", () => {
    const largeData = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      dept: ['Sales', 'Engineering', 'Marketing'][i % 3],
      active: i % 2 === 0,
    }));

    it("level 'auto' round-trips large uniform array", () => {
      const xron = XRON.stringify(largeData, { level: 'auto' });
      expect(XRON.parse(xron)).toEqual(largeData);
    });

    it("level 'auto' produces smaller output than JSON for large data", () => {
      const xron = XRON.stringify(largeData, { level: 'auto' });
      expect(xron.length).toBeLessThan(JSON.stringify(largeData).length);
    });

    it("level 'auto' with minCompressSize returns JSON for small data", () => {
      const tiny = { id: 1, name: 'Alice' };
      const result = XRON.stringify(tiny, { level: 'auto', minCompressSize: 1000 });
      expect(result).not.toContain('@v');
      expect(JSON.parse(result)).toEqual(tiny);
    });
  });
});

describe('XRON Output Format Verification', () => {
  it('Level 1 produces readable output with full schema names', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const output = XRON.stringify(data, { level: 1 });
    expect(output).toContain('@v1');
    expect(output).toContain('@S');
    expect(output).toContain('id, name');
    expect(output).toContain('@N2');
    expect(output).toContain('Alice');
    expect(output).toContain('Bob');
  });

  it('Level 2 uses short schema names and dictionary refs', () => {
    const data = [
      { id: 1, name: 'Alice', dept: 'Sales' },
      { id: 2, name: 'Bob', dept: 'Sales' },
      { id: 3, name: 'Carol', dept: 'Sales' },
    ];
    const output = XRON.stringify(data, { level: 2 });
    expect(output).toContain('@v2');
    expect(output).toContain('@S A:');
    // Dictionary should capture "Sales" (appears 3 times)
    expect(output).toContain('@D:');
    expect(output).toContain('$0');
  });

  it('Level 3 uses delta encoding for sequential IDs', () => {
    const data = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `User${i + 1}`,
    }));
    const output = XRON.stringify(data, { level: 3 });
    expect(output).toContain('@v3');
    // After first row, IDs should be delta-encoded as +1
    expect(output).toContain('+1');
  });
});
