import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index.js';

/**
 * Round-trip identity property.
 *
 * XRON's central claim is that parse(stringify(x)) === x. That is one property,
 * so it is tested as one: every payload in the corpus below is round-tripped at
 * every level. A point test per bug would let the next variation through; this
 * will not.
 *
 * The corpus sits deliberately on the boundaries where encoders break, because
 * a test written from a known bug only ever catches the bug you already knew
 * about.
 */

const LEVELS = [1, 2, 3, 'auto'] as const

/**
 * Comparison that survives BigInt. Plain JSON.stringify throws on a BigInt,
 * which would fail a payload on the harness rather than on the format.
 */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v.toString()}n` : v))

const rows = <T>(n: number, fn: (i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => fn(i))

const dayOf = (i: number) => String((i % 28) + 1).padStart(2, '0')

const corpus: Record<string, unknown> = {
  // ── Dictionary references either side of the base-62 boundary ─────────
  'dict/120 distinct repeated strings': (() => {
    const words = rows(120, i => `longtoken_${String(i).padStart(3, '0')}`)
    return rows(360, i => ({ n: i + 1, tag: words[i % 120] }))
  })(),
  'dict/61 entries (below boundary)': (() => {
    const words = rows(61, i => `longtoken_${String(i).padStart(3, '0')}`)
    return rows(244, i => ({ n: i + 1, tag: words[i % 61] }))
  })(),
  'dict/62 entries (at boundary)': (() => {
    const words = rows(62, i => `longtoken_${String(i).padStart(3, '0')}`)
    return rows(248, i => ({ n: i + 1, tag: words[i % 62] }))
  })(),
  'dict/63 entries (first two-char ref)': (() => {
    const words = rows(63, i => `longtoken_${String(i).padStart(3, '0')}`)
    return rows(252, i => ({ n: i + 1, tag: words[i % 63] }))
  })(),
  'dict/200 entries (deep two-char refs)': (() => {
    const words = rows(200, i => `repeated_value_${String(i).padStart(3, '0')}`)
    return rows(600, i => ({ n: i + 1, tag: words[i % 200] }))
  })(),

  // ── Fractional seconds of every width ─────────────────────────────────
  'frac/0 digits': rows(6, i => ({ n: i + 1, ts: `2026-06-0${i + 1}T09:30:00Z` })),
  'frac/2 digits': rows(5, i => ({ n: i + 1, ts: `2026-06-0${i + 1}T09:30:00.00Z` })),
  'frac/3 digits (toISOString)': rows(6, i => ({
    n: i + 1,
    ts: new Date(Date.UTC(2026, 5, 1) + i * 3600000).toISOString(),
  })),
  'frac/6 digits': rows(5, i => ({ n: i + 1, ts: `2026-06-0${i + 1}T09:30:00.123456Z` })),
  'frac/3 digits over delta threshold': rows(40, i => ({
    n: i + 1,
    ts: new Date(Date.UTC(2026, 5, 1) + i * 3600000).toISOString(),
  })),
  'edge/fraction of 1 digit': rows(40, i => ({ n: i + 1, ts: `2026-06-${dayOf(i)}T00:00:00.5Z` })),
  'edge/fraction with trailing zeros': rows(40, i => ({ n: i + 1, ts: `2026-06-${dayOf(i)}T00:00:00.100Z` })),

  // ── Timezone offsets, both signs, DST, and colon-less form ────────────
  'tz/negative offset': rows(5, i => ({ n: i + 1, ts: `2026-03-0${i + 4}T06:30:00-05:00` })),
  'tz/positive offset': rows(5, i => ({ n: i + 1, ts: `2026-03-0${i + 4}T06:30:00+05:00` })),
  'tz/DST crossing': [
    { n: 1, ts: '2026-03-07T06:30:00-05:00' },
    { n: 2, ts: '2026-03-08T06:30:00-05:00' },
    { n: 3, ts: '2026-03-09T06:30:00-04:00' },
    { n: 4, ts: '2026-03-10T06:30:00-04:00' },
  ],
  'tz/negative offset over delta threshold': rows(40, i => ({
    n: i + 1,
    ts: `2026-03-${dayOf(i)}T06:30:00-05:00`,
  })),
  // "+0530" and "+05:30" compact to the same bytes, so the colon-less form
  // must not be compacted at all.
  'tz/offset written without a colon': rows(40, i => ({
    n: i + 1,
    ts: `2026-06-${dayOf(i)}T14:30:00+0530`,
  })),
  'tz/extreme offsets': [
    { n: 1, ts: '2026-06-01T14:30:00+14:00' },
    { n: 2, ts: '2026-06-02T14:30:00-12:00' },
    { n: 3, ts: '2026-06-03T14:30:00+00:00' },
  ],
  'tz/mixed offsets and Z': [
    { n: 1, ts: '2026-03-07T06:30:00Z' },
    { n: 2, ts: '2026-03-08T06:30:00-05:00' },
    { n: 3, ts: '2026-03-09T06:30:00+02:00' },
    { n: 4, ts: '2026-03-10T06:30:00Z' },
  ],

  // ── Date-only columns either side of the delta threshold ──────────────
  'dateonly/30 rows': rows(30, i => ({ n: i + 1, ts: `2026-06-${dayOf(i)}` })),
  'dateonly/31 rows': rows(31, i => ({ n: i + 1, ts: `2026-06-${dayOf(i)}` })),
  'dateonly/60 rows': rows(60, i => ({ n: i + 1, ts: `2026-06-${dayOf(i)}` })),
  // Date-only anchor forced behind a letter-based dictionary ref: the shape
  // that made decodeDeltaRows build a Date from NaN.
  'dateonly/anchor behind a letter dict ref': rows(40, i => ({
    n: i + 1,
    ts: `2026-06-${dayOf(i)}`,
    a: `padding_alpha_${i % 12}`,
    b: `padding_beta_${i % 12}`,
    c: `padding_gamma_${i % 12}`,
  })),

  // ── Columns mixing date-only with datetime ────────────────────────────
  'mixed/date-only and datetime': [
    { n: 1, ts: '2026-06-01' },
    { n: 2, ts: '2026-06-02T14:45:00Z' },
    { n: 3, ts: '2026-06-03' },
    { n: 4, ts: '2026-06-04T08:15:00Z' },
  ],
  'mixed/date-only and datetime over threshold': rows(40, i => ({
    n: i + 1,
    ts: i % 2 === 0 ? `2026-06-${dayOf(i)}` : `2026-06-${dayOf(i)}T14:45:00Z`,
  })),
  'mixed/varying fractional widths': [
    { n: 1, ts: '2026-06-01T00:00:00Z' },
    { n: 2, ts: '2026-06-02T00:00:00.5Z' },
    { n: 3, ts: '2026-06-03T00:00:00.25Z' },
    { n: 4, ts: '2026-06-04T00:00:00.125Z' },
  ],

  // ── Temporal edge cases ───────────────────────────────────────────────
  'edge/nulls in a date column': rows(40, i => ({
    n: i + 1,
    ts: i % 7 === 0 ? null : `2026-06-${dayOf(i)}`,
  })),
  'edge/non-monotonic dates': rows(40, i => ({ n: i + 1, ts: `2026-06-${dayOf((i * 17) % 28)}` })),
  'edge/pre-1970 dates': rows(40, i => ({ n: i + 1, ts: `1962-06-${dayOf(i)}` })),
  'edge/pre-1970 datetimes': rows(40, i => ({ n: i + 1, ts: `1962-06-${dayOf(i)}T06:30:00Z` })),
  'edge/crossing the epoch': rows(40, i => ({
    n: i + 1,
    ts: new Date(Date.UTC(1969, 11, 20) + i * 86400000).toISOString(),
  })),
  'edge/identical repeated dates': rows(40, i => ({ n: i + 1, ts: '2026-06-01T00:00:00.000Z' })),
  'edge/single row': [{ n: 1, ts: '2026-06-01T00:00:00.000Z' }],
  'edge/leap day': rows(40, i => ({ n: i + 1, ts: i === 0 ? '2028-02-29' : `2028-03-${dayOf(i)}` })),
  'edge/date before the old 1900 clamp': { when: '0001-01-01T00:00:00Z' },
  'edge/date after the old 2100 clamp': { when: '9999-12-31T23:59:59Z' },

  // ── Values that collide with the parser's own delimiters ──────────────
  'delimiter/string containing a colon': 'a:b',
  'delimiter/timestamp as a bare top-level string': '2016-12-31T23:59:60Z',
  'delimiter/object key containing a colon': { '2026-01-01T00:00:00Z': 'value-here', other: 'x' },
  'delimiter/keys and values both containing colons': rows(20, i => ({
    [`key:${i}`]: `value:${i}`,
    plain: `http://example.com/${i}`,
  })),
  'delimiter/string containing a double quote': rows(20, i => ({ n: i, v: `has"quote${i % 5}` })),
  'delimiter/string containing a comma': rows(20, i => ({ n: i, v: `a,b,c ${i % 5}` })),
  'edge/value that looks like a delta': rows(40, i => ({ n: i + 1, ts: `2026-06-${dayOf(i)}`, x: '+5s' })),
  'edge/value that looks like a dict ref': rows(70, i => ({
    n: i + 1,
    tag: i === 0 ? '$0' : `repeated_string_${i % 65}`,
  })),
  'edge/value that looks like a repeat marker': rows(40, i => ({ n: i + 1, x: '~' })),

  // ── Literal signed numbers that look like delta notation ──────────────
  'numeric/literal negative in a non-delta column': [
    { id: 1, val: 1000000 },
    { id: 2, val: -5 },
    { id: 3, val: 2000000 },
  ],
  'numeric/negatives scattered through a wide-range column': rows(40, i => ({
    n: i + 1,
    val: i % 5 === 0 ? -(i + 1) : (i + 1) * 100000,
  })),
  'numeric/all-negative column': rows(40, i => ({ n: i + 1, val: -(i * 37 + 1) })),
  'numeric/bigint with a literal negative': [
    { id: 1, val: 1000000n },
    { id: 2, val: -5n },
    { id: 3, val: 2000000n },
  ],
  'numeric/bigint mixed with other types': [{ v: 123n }, { v: 'plain' }, { v: 7 }],
  'numeric/floats of wildly different magnitudes': [{ v: 1e20 }, { v: 5 }, { v: 1e20 }],
  'numeric/mixed magnitude floats': [{ v: 1e16 }, { v: 1.5 }, { v: 2e16 }, { v: 2.5 }],

  // ── Integers that look like dates ─────────────────────────────────────
  'numeric/8-digit integer in a date-like range': { n: 20260101 },
  'numeric/8-digit integer column': [
    { a: 20260101, b: 1 },
    { a: 20260102, b: 2 },
    { a: 20260103, b: 3 },
  ],
  'numeric/8-digit integers over the delta threshold': rows(40, i => ({ n: i + 1, code: 20260101 + i })),

  // ── Nested structures, whose delimiters the row splitter depends on ───
  'nested/objects with shared shapes': rows(40, i => ({
    date: `2026-01-${dayOf(i)}`,
    location: { city: ['New York', 'London', 'Tokyo'][i % 3], country: 'US', lat: 40.71, lon: -74 },
    temperature: { min: 10, max: 20, avg: 15, unit: 'celsius' },
    humidity: 50,
    conditions: ['sunny', 'cloudy', 'rainy'][i % 3],
  })),
  'nested/objects plus arrays': rows(40, i => ({
    id: `PROD-${String(i + 1).padStart(4, '0')}`,
    tags: ['new', 'featured'],
    specs: { weight: '0.5kg', dimensions: '10x5x3cm' },
    rating: { average: 3.5, count: 10 },
  })),
  'nested/values containing the separator': rows(40, i => ({
    n: i + 1,
    note: `first, second, third #${i % 7}`,
  })),
  // The column-template layer used to strip the B(...) wrapper off these,
  // exposing the inner comma at depth 0 and re-splitting the row.
  'nested/varying nested object': rows(6, i => ({ loc: { city: `city${i}`, code: `c${i}` }, n: i })),
  'nested/varying nested object over threshold': rows(40, i => ({
    loc: { city: `city${i}`, code: `c${i}`, region: `r${i % 5}` },
    n: i,
  })),
  'nested/booleans without a type hint': rows(20, i => ({
    mixed: i % 3 === 0 ? true : i % 3 === 1 ? 'text' : 7,
    flag: i % 2 === 0,
  })),
  'nested/2D boolean array': [
    [true, false, true],
    [false, true, false],
  ],

  // ── Combined: dates and a large dictionary in one payload ─────────────
  'combined/dates plus 120-entry dictionary': (() => {
    const words = rows(120, i => `longtoken_${String(i).padStart(3, '0')}`)
    return rows(360, i => ({
      n: i + 1,
      tag: words[i % 120],
      ts: new Date(Date.UTC(2026, 5, 1) + i * 3600000).toISOString(),
      day: `2026-06-${dayOf(i)}`,
    }))
  })(),
}

describe('XRON round-trip identity property', () => {
  for (const [name, payload] of Object.entries(corpus)) {
    for (const level of LEVELS) {
      it(`${name} @ level ${level}`, () => {
        const encoded = XRON.stringify(payload, { level })
        const decoded = XRON.parse(encoded)
        expect(stable(decoded)).toBe(stable(payload))
      })
    }
  }
})

describe('XRON dictionary reference encoding', () => {
  // Guards the base-62 boundary at the unit level, so a regression names its
  // cause rather than surfacing as a mystery corruption three layers up.
  it('round-trips every dictionary index across the single/two-char boundary', () => {
    const words = rows(300, i => `dictionary_entry_${String(i).padStart(4, '0')}`)
    const payload = rows(900, i => ({ n: i + 1, tag: words[i % 300] }))
    const decoded = XRON.parse(XRON.stringify(payload, { level: 3 })) as typeof payload
    for (let i = 0; i < payload.length; i++) {
      expect(decoded[i].tag).toBe(payload[i].tag)
    }
  })
})

describe('XRON temporal decoding is total', () => {
  // A single unparseable column must degrade, never take the document down.
  it('does not throw on a temporal column whose anchor cannot be parsed', () => {
    const payload = rows(40, i => ({
      n: i + 1,
      ts: `2026-06-${dayOf(i)}`,
      a: `padding_alpha_${i % 12}`,
      b: `padding_beta_${i % 12}`,
      c: `padding_gamma_${i % 12}`,
    }))
    expect(() => XRON.parse(XRON.stringify(payload, { level: 3 }))).not.toThrow()
  })
})
