import { describe, it, expect } from 'vitest';
import { encodeTypedValue, decodeTypedValue, compactDate, expandDate, uuidToBase62, base62ToUuid } from '../../src/pipeline/type-encoding.js';

describe('Type-Aware Encoding', () => {
  describe('Primitives', () => {
    it('encodes null → - at level 2+', () => {
      expect(encodeTypedValue(null, 2)).toBe('-');
      expect(encodeTypedValue(null, 1)).toBe('null');
    });

    // Extended, not weakened: 1/0 is still asserted at level 2+, but only for
    // the case that can actually be decoded back. Compact booleans are
    // recoverable solely via the ?b schema hint, so the caller now opts in;
    // without that hint 1/0 would return as the number 1.
    it('encodes booleans → 1/0 at level 2+ when the field is hint-backed', () => {
      expect(encodeTypedValue(true, 2, true)).toBe('1');
      expect(encodeTypedValue(false, 2, true)).toBe('0');
      expect(encodeTypedValue(true, 1, true)).toBe('true');
      expect(encodeTypedValue(false, 1, true)).toBe('false');
    });

    it('keeps booleans as true/false where no type hint will be available', () => {
      expect(encodeTypedValue(true, 2)).toBe('true');
      expect(encodeTypedValue(false, 2)).toBe('false');
      expect(encodeTypedValue(true, 3)).toBe('true');
    });

    it('encodes numbers without quotes', () => {
      expect(encodeTypedValue(42, 1)).toBe('42');
      expect(encodeTypedValue(-3.14, 2)).toBe('-3.14');
      expect(encodeTypedValue(1e10, 3)).toBe('10000000000');
    });

    it('encodes NaN/Infinity as null', () => {
      expect(encodeTypedValue(NaN, 1)).toBe('null');
      expect(encodeTypedValue(Infinity, 1)).toBe('null');
    });

    // Changed deliberately. '42' is indistinguishable from the number 42, so
    // the old encoding could not survive a round-trip outside a uniformly-
    // BigInt column carrying the ?i hint — BigInt(42) came back as the number
    // 42, and conversely the number 1e20 came back as a BigInt because the
    // decoder guessed by digit count. The trailing 'n' is the JS BigInt
    // literal spelling and makes the type explicit.
    it('encodes BigInt with an explicit n marker', () => {
      expect(encodeTypedValue(BigInt(42), 1)).toBe('42n');
      expect(encodeTypedValue(BigInt(-5), 3)).toBe('-5n');
    });
  });

  describe('Decoding', () => {
    it('decodes null markers', () => {
      expect(decodeTypedValue('-', 2)).toBe(null);
      expect(decodeTypedValue('null', 1)).toBe(null);
    });

    it('decodes booleans', () => {
      expect(decodeTypedValue('true', 1)).toBe(true);
      expect(decodeTypedValue('false', 1)).toBe(false);
    });

    it('decodes numbers', () => {
      expect(decodeTypedValue('42', 1)).toBe(42);
      expect(decodeTypedValue('-3.14', 1)).toBe(-3.14);
    });

    it('decodes quoted strings', () => {
      expect(decodeTypedValue('"hello world"', 1)).toBe('hello world');
    });

    it('decodes plain strings', () => {
      expect(decodeTypedValue('hello', 1)).toBe('hello');
    });
  });

  describe('Date Compaction', () => {
    // Changed deliberately, not to make a failure go away. The old assertion
    // was `compactDate('2026-04-01') === '20260401'`, and that compaction is
    // exactly what made a plain integer 20260101 decode back as the string
    // "2026-01-01" — a bare YYYYMMDD carries nothing to distinguish it from a
    // number. Losslessness is the format's stated guarantee, so the guarantee
    // wins over the old expectation. Datetimes still compact: they keep a 'T'
    // and stay unambiguous.
    it('leaves date-only ISO strings uncompacted, to stay distinct from integers', () => {
      expect(compactDate('2026-04-01')).toBe('2026-04-01');
    });

    it('compacts datetime ISO strings', () => {
      expect(compactDate('2026-04-01T14:30:00Z')).toBe('20260401T143000Z');
    });

    it('expands compact dates', () => {
      expect(expandDate('20260401')).toBe('2026-04-01');
    });

    it('expands compact datetimes', () => {
      expect(expandDate('20260401T143000Z')).toBe('2026-04-01T14:30:00Z');
    });

    it('round-trips dates', () => {
      const dates = ['2026-04-01', '2023-12-31', '2000-01-01'];
      for (const d of dates) {
        expect(expandDate(compactDate(d))).toBe(d);
      }
    });
  });

  describe('UUID Base62 Compression', () => {
    it('converts UUID to shorter base62', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const b62 = uuidToBase62(uuid);
      expect(b62.length).toBeLessThan(uuid.length);
    });

    it('round-trips UUIDs', () => {
      const uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];
      for (const uuid of uuids) {
        expect(base62ToUuid(uuidToBase62(uuid))).toBe(uuid);
      }
    });
  });
});
