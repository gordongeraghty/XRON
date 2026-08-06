import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index.js';

/**
 * Seeded structure fuzzing for the round-trip identity.
 *
 * lossless-property.test.ts round-trips a hand-picked corpus of known boundary
 * shapes. This file is the complement: it generates structures nobody thought
 * of. Every value is produced by a deterministic PRNG, so a failure prints the
 * seed that reproduces it — there is no flakiness, only coverage.
 *
 * The generator is deliberately hostile: strings that collide with XRON's own
 * syntax ($ refs, + deltas, ~ repeats, the - null marker, @ headers), keys and
 * values with delimiters and whitespace, numeric-looking strings, ISO-like
 * timestamps feeding the temporal-delta layer, and mixed-shape rows.
 */

const LEVELS = [1, 2, 3, 'auto'] as const;

/** mulberry32 — small, seedable, good enough for structure generation. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/** Strings chosen to collide with XRON syntax and delimiters. */
const HOSTILE_STRINGS = [
  '', ' ', '  padded  ', '-', '--', '$0', '$2', '$zz', '+3', '+1h', '~4', '~',
  '@v3', '@D: x', '@C 00000000', '^', '[', '{', ']', '}', 'a,b', ',', ',,',
  'line\nbreak', 'tab\there', 'quote"inside', "'single'", '\\', '\\n',
  '007', '1', '0', '-1', '3.14', '1e10', 'true', 'false', 'null', 'NaN',
  '2026-06-01', '2026-06-01T09:30:00Z', '2026-06-01T09:30:00.123Z',
  '2026-06-01T09:30:00-05:00', 'not-a-date-2026', 'über', '日本語', '🙂',
] as const;

const KEY_ALPHABET = [
  'id', 'name', 'value', 'ts', 'a', 'b', 'x_y', 'key with space', 'key,comma',
  'UPPER', '0numeric', 'nested', 'ünïcode', 'tag',
] as const;

function scalar(r: () => number): unknown {
  switch (int(r, 0, 6)) {
    case 0: return null;
    case 1: return r() < 0.5;
    case 2: return int(r, -1_000_000, 1_000_000);
    case 3: { const f = (r() - 0.5) * 1e6; return f === 0 ? 0 : f; } // never -0: JSON cannot express it
    case 4: return pick(r, HOSTILE_STRINGS);
    case 5: return `s_${int(r, 0, 99)}`;
    default: return int(r, 0, 1) ? int(r, 0, 9) : pick(r, HOSTILE_STRINGS);
  }
}

function structure(r: () => number, depth: number): unknown {
  if (depth <= 0 || r() < 0.4) return scalar(r);
  if (r() < 0.5) {
    return Array.from({ length: int(r, 0, 8) }, () => structure(r, depth - 1));
  }
  const obj: Record<string, unknown> = {};
  for (let i = int(r, 0, 8); i > 0; i--) obj[pick(r, KEY_ALPHABET)] = structure(r, depth - 1);
  return obj;
}

/** Uniform rows — the tabular path where every compression layer engages. */
function table(r: () => number): unknown[] {
  const cols = Array.from({ length: int(r, 1, 6) }, (_, c) => {
    const kind = int(r, 0, 5);
    const base = Date.UTC(2026, int(r, 0, 11), int(r, 1, 28));
    const stepMs = pick(r, [1000, 60_000, 3_600_000, 86_400_000, 12345]);
    const vocab = Array.from({ length: int(r, 2, 70) }, (_, i) => `w${i}_${pick(r, HOSTILE_STRINGS)}`);
    return (row: number): unknown => {
      switch (kind) {
        case 0: return row * pick(r, [1, 25, 37]) + int(r, -5, 5);
        case 1: return pick(r, vocab);
        case 2: return new Date(base + row * stepMs).toISOString();
        case 3: return new Date(base + row * stepMs).toISOString().replace('.000', '');
        case 4: return r() < 0.1 ? null : r() < 0.5;
        default: return pick(r, HOSTILE_STRINGS);
      }
    };
  });
  return Array.from({ length: int(r, 1, 120) }, (_, row) =>
    Object.fromEntries(cols.map((gen, c) => [`c${c}`, gen(row)])),
  );
}

describe('lossless fuzz: parse(stringify(x)) deep-equals x', () => {
  it('random nested structures', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const data = structure(prng(seed), 4);
      for (const level of LEVELS) {
        const decoded = XRON.parse(XRON.stringify(data, { level }));
        expect(JSON.stringify(decoded), `seed=${seed} level=${level}`).toBe(JSON.stringify(data));
      }
    }
  });

  it('random uniform tables', () => {
    for (let seed = 1000; seed <= 1060; seed++) {
      const data = table(prng(seed));
      for (const level of LEVELS) {
        const decoded = XRON.parse(XRON.stringify(data, { level }));
        expect(JSON.stringify(decoded), `seed=${seed} level=${level}`).toBe(JSON.stringify(data));
      }
    }
  });
});
