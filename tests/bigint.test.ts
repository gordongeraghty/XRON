/**
 * BigInt support tests for XRON.
 *
 * Verifies lossless round-tripping of BigInt values across the full 9-layer pipeline,
 * including delta encoding, schema hints, and mixed number/bigint columns.
 */

import { describe, it, expect } from 'vitest';
import { stringify } from '../src/stringify.js';
import { parse } from '../src/parse.js';

describe('BigInt: basic round-trip', () => {
  it('round-trips a simple BigInt in an object array', () => {
    const data = [
      { id: 123n, name: 'Alice' },
      { id: 456n, name: 'Bob' },
      { id: 789n, name: 'Carol' },
    ];
    const encoded = stringify(data, { level: 2 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(123n);
    expect(decoded[1].id).toBe(456n);
    expect(decoded[2].id).toBe(789n);
  });

  it('preserves BigInt type (not number)', () => {
    const data = [
      { id: 1n, val: 'x' },
      { id: 2n, val: 'y' },
    ];
    const encoded = stringify(data, { level: 2 });
    const decoded = parse(encoded);
    expect(typeof decoded[0].id).toBe('bigint');
    expect(typeof decoded[1].id).toBe('bigint');
  });

  it('round-trips very large BigInts beyond Number.MAX_SAFE_INTEGER', () => {
    const big = 9007199254740993n; // MAX_SAFE_INTEGER + 2 — would lose precision as Number
    const data = [
      { id: big, label: 'a' },
      { id: big + 1n, label: 'b' },
      { id: big + 2n, label: 'c' },
    ];
    const encoded = stringify(data, { level: 3 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(big);
    expect(decoded[1].id).toBe(big + 1n);
    expect(decoded[2].id).toBe(big + 2n);
  });

  it('handles zero BigInt', () => {
    const data = [
      { id: 0n, name: 'zero' },
      { id: 1n, name: 'one' },
    ];
    const encoded = stringify(data, { level: 2 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(0n);
    expect(decoded[1].id).toBe(1n);
  });

  it('handles negative BigInts', () => {
    const data = [
      { balance: -100n, account: 'A' },
      { balance: -200n, account: 'B' },
      { balance: -300n, account: 'C' },
    ];
    const encoded = stringify(data, { level: 3 });
    const decoded = parse(encoded);
    expect(decoded[0].balance).toBe(-100n);
    expect(decoded[1].balance).toBe(-200n);
    expect(decoded[2].balance).toBe(-300n);
  });
});

describe('BigInt: delta encoding', () => {
  it('applies delta encoding to sequential BigInt IDs', () => {
    const data = Array.from({ length: 5 }, (_, i) => ({
      id: BigInt(1000 + i),
      name: `User ${i}`,
    }));
    const encoded = stringify(data, { level: 3 });
    // Verify delta encoding applied (look for + notation)
    expect(encoded).toContain('+1');
    // Verify round-trip
    const decoded = parse(encoded);
    for (let i = 0; i < 5; i++) {
      expect(decoded[i].id).toBe(BigInt(1000 + i));
    }
  });

  it('delta encodes very large sequential BigInts with full precision', () => {
    const base = 10000000000000000000n; // 10^19
    const data = Array.from({ length: 4 }, (_, i) => ({
      snowflake: base + BigInt(i * 1000),
      tag: `item${i}`,
    }));
    const encoded = stringify(data, { level: 3 });
    const decoded = parse(encoded);
    for (let i = 0; i < 4; i++) {
      expect(decoded[i].snowflake).toBe(base + BigInt(i * 1000));
    }
  });
});

describe('BigInt: schema hint ?i', () => {
  it('emits ?i hint in schema header for BigInt fields', () => {
    const data = [
      { id: 1n, name: 'a' },
      { id: 2n, name: 'b' },
    ];
    const encoded = stringify(data, { level: 2 });
    expect(encoded).toContain('?i');
  });

  it('parses schema header with ?i hint', () => {
    const data = [
      { id: 42n, label: 'test' },
      { id: 43n, label: 'test2' },
    ];
    const encoded = stringify(data, { level: 2 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(42n);
    expect(typeof decoded[0].id).toBe('bigint');
  });
});

describe('BigInt: level compatibility', () => {
  it('round-trips at level 1', () => {
    const data = [
      { id: 999n, val: 'a' },
      { id: 1000n, val: 'b' },
    ];
    const encoded = stringify(data, { level: 1 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(999n);
    expect(decoded[1].id).toBe(1000n);
  });

  it('round-trips at level 2', () => {
    const data = [
      { id: 999n, val: 'a' },
      { id: 1000n, val: 'b' },
    ];
    const encoded = stringify(data, { level: 2 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(999n);
    expect(decoded[1].id).toBe(1000n);
  });

  it('round-trips at level 3', () => {
    const data = [
      { id: 999n, val: 'a' },
      { id: 1000n, val: 'b' },
      { id: 1001n, val: 'c' },
    ];
    const encoded = stringify(data, { level: 3 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(999n);
    expect(decoded[1].id).toBe(1000n);
    expect(decoded[2].id).toBe(1001n);
  });
});

describe('BigInt: mixed with other field types', () => {
  it('handles objects with BigInt alongside other types', () => {
    const data = [
      { id: 1n, name: 'Alice', active: true, score: 9.5 },
      { id: 2n, name: 'Bob', active: false, score: 8.0 },
      { id: 3n, name: 'Carol', active: true, score: 7.5 },
    ];
    const encoded = stringify(data, { level: 2 });
    const decoded = parse(encoded);
    expect(decoded[0].id).toBe(1n);
    expect(decoded[0].name).toBe('Alice');
    expect(decoded[0].active).toBe(true);
    expect(decoded[0].score).toBe(9.5);
    expect(decoded[1].id).toBe(2n);
    expect(decoded[1].active).toBe(false);
  });
});
