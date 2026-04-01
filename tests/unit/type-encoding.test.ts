import { describe, it, expect } from 'vitest';
import { encodeTypedValue, decodeTypedValue, compactDate, expandDate, uuidToBase62, base62ToUuid } from '../../src/pipeline/type-encoding.js';

describe('Type-Aware Encoding', () => {
  describe('Primitives', () => {
    it('encodes null → - at level 2+', () => {
      expect(encodeTypedValue(null, 2)).toBe('-');
      expect(encodeTypedValue(null, 1)).toBe('null');
    });

    it('encodes booleans → 1/0 at level 2+', () => {
      expect(encodeTypedValue(true, 2)).toBe('1');
      expect(encodeTypedValue(false, 2)).toBe('0');
      expect(encodeTypedValue(true, 1)).toBe('true');
      expect(encodeTypedValue(false, 1)).toBe('false');
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

    it('encodes BigInt as string', () => {
      const result = encodeTypedValue(BigInt(42), 1);
      expect(result).toBe('42');
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
    it('compacts date-only ISO strings', () => {
      expect(compactDate('2026-04-01')).toBe('20260401');
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
