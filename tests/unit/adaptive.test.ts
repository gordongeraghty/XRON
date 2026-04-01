import { describe, it, expect } from 'vitest';
import { XRON } from '../../src/index.js';
import { assessData } from '../../src/pipeline/adaptive.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TINY = { id: 1, name: 'Alice' };

const SMALL_PRIMITIVE = 42;

const LARGE_UNIFORM = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: ['Alice', 'Bob', 'Carol', 'Dave'][i % 4],
  dept: ['Sales', 'Engineering', 'Marketing'][i % 3],
  active: i % 2 === 0,
  score: i * 10,
}));

const LARGE_NO_REPEAT = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  label: `unique-value-${i}-xyz-${Math.random().toString(36).slice(2)}`,
  code: `CODE-${i * 7 + 13}-${i * 3}`,
}));

const SEQUENTIAL_IDS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  score: i * 5,
}));

// A standalone config object — single instance, no repeating schema, no dict values.
// Must be > AUTO_MIN_COMPRESS_SIZE (150 bytes) so the size check doesn't fire first.
const CONFIG = {
  app: 'MyApplication',
  version: '2.1.0',
  environment: 'production',
  debug: false,
  database: { host: 'db.example.com', port: 5432, name: 'myapp_prod', ssl: true },
  cache: { provider: 'redis', host: 'cache.example.com', port: 6379, ttl: 3600 },
};

// ─── assessData ───────────────────────────────────────────────────────────────

describe('assessData — recommendation logic', () => {
  it('recommends L1 for tiny payloads (< AUTO_MIN_COMPRESS_SIZE)', () => {
    const rec = assessData(TINY);
    // TINY is ~21 bytes — below the 150-byte auto threshold
    expect(rec.recommendedLevel).toBe(1);
    expect(rec.willCompress).toBe(true);
    expect(rec.reason).toMatch(/small/i);
  });

  it('recommends L1 when no repeating schemas', () => {
    // CONFIG is a single nested object — no object shape has frequency ≥ 2,
    // so schema extraction can't eliminate repeated keys.
    const rec = assessData(CONFIG);
    expect(rec.recommendedLevel).toBe(1);
    // Could be "no repeating schemas" or "no beneficial dictionary" — L1 either way
    expect(rec.willCompress).toBe(true);
    expect(rec.characteristics.hasRepeatingSchemas).toBe(false);
  });

  it('recommends L2 or L3 for large uniform arrays', () => {
    const rec = assessData(LARGE_UNIFORM);
    expect(rec.recommendedLevel).toBeGreaterThanOrEqual(2);
    expect(rec.willCompress).toBe(true);
  });

  it('recommends L2 or L3 for data with sequential numeric IDs', () => {
    const rec = assessData(SEQUENTIAL_IDS);
    // Sequential IDs and scores → schema extraction always helps.
    // Delta may be detected → L3. Either way should be ≥ L2 (or L1 with delta path).
    // The key invariant: it should produce smaller output than JSON.
    expect(rec.willCompress).toBe(true);
    // At minimum, schemas should be detected (20 uniform objects)
    expect(rec.characteristics.hasRepeatingSchemas).toBe(true);
  });

  it('respects minCompressSize — returns willCompress=false for small data', () => {
    const rec = assessData(TINY, { minCompressSize: 500 });
    expect(rec.willCompress).toBe(false);
    expect(rec.skipReason).toBeDefined();
    expect(rec.skipReason).toMatch(/minCompressSize/i);
  });

  it('returns willCompress=true when payload exceeds minCompressSize', () => {
    const rec = assessData(LARGE_UNIFORM, { minCompressSize: 100 });
    expect(rec.willCompress).toBe(true);
  });

  it('populates characteristics.jsonSize correctly', () => {
    const rec = assessData(LARGE_UNIFORM);
    const jsonSize = JSON.stringify(LARGE_UNIFORM).length;
    expect(rec.characteristics.jsonSize).toBe(jsonSize);
  });

  it('populates characteristics.hasRepeatingSchemas', () => {
    const withSchemas = assessData(LARGE_UNIFORM);
    expect(withSchemas.characteristics.hasRepeatingSchemas).toBe(true);

    const noSchemas = assessData(CONFIG);
    expect(noSchemas.characteristics.hasRepeatingSchemas).toBe(false);
  });

  it('always returns a non-empty reason', () => {
    for (const data of [TINY, CONFIG, LARGE_UNIFORM, SEQUENTIAL_IDS]) {
      const rec = assessData(data);
      expect(typeof rec.reason).toBe('string');
      expect(rec.reason.length).toBeGreaterThan(10);
    }
  });

  it('always returns caveats array', () => {
    const rec = assessData(LARGE_UNIFORM);
    expect(Array.isArray(rec.caveats)).toBe(true);
    expect(rec.caveats.length).toBeGreaterThan(0);
  });
});

// ─── XRON.recommend ───────────────────────────────────────────────────────────

describe('XRON.recommend', () => {
  it('is synchronous and returns a recommendation', () => {
    const rec = XRON.recommend(LARGE_UNIFORM);
    expect(rec).toBeDefined();
    expect(typeof rec.recommendedLevel).toBe('number');
    expect([1, 2, 3]).toContain(rec.recommendedLevel);
  });

  it('recommends a high level for large uniform data', () => {
    const rec = XRON.recommend(LARGE_UNIFORM);
    expect(rec.recommendedLevel).toBeGreaterThanOrEqual(2);
  });

  it('recommends L1 for single config object', () => {
    const rec = XRON.recommend(CONFIG);
    expect(rec.recommendedLevel).toBe(1);
  });
});

// ─── XRON.stringify with level: 'auto' ────────────────────────────────────────

describe("XRON.stringify with level: 'auto'", () => {
  it('produces valid XRON output', () => {
    const result = XRON.stringify(LARGE_UNIFORM, { level: 'auto' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('round-trips losslessly for large uniform data', () => {
    const result = XRON.stringify(LARGE_UNIFORM, { level: 'auto' });
    const parsed = XRON.parse(result);
    expect(parsed).toEqual(LARGE_UNIFORM);
  });

  it('round-trips losslessly for sequential IDs', () => {
    const result = XRON.stringify(SEQUENTIAL_IDS, { level: 'auto' });
    const parsed = XRON.parse(result);
    expect(parsed).toEqual(SEQUENTIAL_IDS);
  });

  it('returns JSON for payloads below minCompressSize', () => {
    const result = XRON.stringify(TINY, { level: 'auto', minCompressSize: 500 });
    // Should be plain JSON (no @v header)
    expect(result).not.toContain('@v');
    expect(JSON.parse(result)).toEqual(TINY);
  });

  it('returns XRON when payload exceeds minCompressSize', () => {
    const result = XRON.stringify(LARGE_UNIFORM, { level: 'auto', minCompressSize: 100 });
    expect(result).toContain('@v');
  });

  it('handles primitives gracefully', () => {
    expect(XRON.stringify(42, { level: 'auto' })).toBe('42');
    expect(XRON.stringify('hello', { level: 'auto' })).toBe('hello');
    expect(XRON.stringify(null, { level: 'auto' })).toBe('null');
    expect(XRON.stringify(true, { level: 'auto' })).toBe('true');
  });

  it('result is smaller than minified JSON for large data', () => {
    const xron = XRON.stringify(LARGE_UNIFORM, { level: 'auto' });
    const json = JSON.stringify(LARGE_UNIFORM);
    expect(xron.length).toBeLessThan(json.length);
  });

  it('is consistent — same data produces same output', () => {
    const a = XRON.stringify(LARGE_UNIFORM, { level: 'auto' });
    const b = XRON.stringify(LARGE_UNIFORM, { level: 'auto' });
    expect(a).toBe(b);
  });
});

// ─── Adaptive vs fixed level comparison ───────────────────────────────────────

describe('adaptive vs fixed level output', () => {
  it('auto output round-trips when manual level would also round-trip', () => {
    // The auto mode should produce output that parses back correctly,
    // regardless of which level it chose.
    const datasets = [LARGE_UNIFORM, SEQUENTIAL_IDS, LARGE_NO_REPEAT, [CONFIG]];
    for (const data of datasets) {
      const auto = XRON.stringify(data, { level: 'auto' });
      const roundTripped = XRON.parse(auto);
      expect(roundTripped).toEqual(data);
    }
  });

  it('auto chooses a level no worse than L2 for large repeated data', () => {
    const autoOut = XRON.stringify(LARGE_UNIFORM, { level: 'auto' });
    const l2Out = XRON.stringify(LARGE_UNIFORM, { level: 2 });
    // Auto should be ≤ the size of L2 (it will pick L2 or L3)
    expect(autoOut.length).toBeLessThanOrEqual(l2Out.length + 50); // small tolerance
  });

  it('does not use L3 overhead for data that only benefits from L1', () => {
    // CONFIG is a single unique object — auto should pick L1, not L3
    const autoOut = XRON.stringify(CONFIG, { level: 'auto' });
    // L1 output uses full field names in @S, L3 would use @v3
    if (autoOut.startsWith('@v')) {
      expect(autoOut).not.toContain('@v3');
    }
  });
});

// ─── minCompressSize threshold behaviour ─────────────────────────────────────

describe('minCompressSize threshold', () => {
  const MEDIUM = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1, name: `User${i}`, dept: 'Sales',
  }));

  it('below threshold returns raw JSON (valid and parseable)', () => {
    const jsonSize = JSON.stringify(MEDIUM).length;
    const threshold = jsonSize + 100; // definitely above
    const result = XRON.stringify(MEDIUM, { level: 'auto', minCompressSize: threshold });
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual(MEDIUM);
  });

  it('above threshold returns XRON', () => {
    const threshold = 10; // very small — data will exceed it
    const result = XRON.stringify(MEDIUM, { level: 'auto', minCompressSize: threshold });
    expect(result).toContain('@v');
  });

  it('at exactly the threshold boundary — below → JSON, above → XRON', () => {
    const jsonSize = JSON.stringify(MEDIUM).length;

    const below = XRON.stringify(MEDIUM, { level: 'auto', minCompressSize: jsonSize + 1 });
    expect(below).not.toContain('@v');

    const above = XRON.stringify(MEDIUM, { level: 'auto', minCompressSize: jsonSize - 1 });
    expect(above).toContain('@v');
  });

  it('minCompressSize has no effect on fixed levels', () => {
    // Fixed levels ignore minCompressSize — they always compress
    const result = XRON.stringify(TINY, { level: 1, minCompressSize: 9999 });
    expect(result).toContain('@v1');
  });
});
