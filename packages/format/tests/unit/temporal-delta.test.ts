import { describe, it, expect } from 'vitest';
import {
  analyzeDeltaColumns,
  applyDeltaEncoding,
  decodeDeltaRows,
} from '../../src/pipeline/delta.js';
import { SchemaDefinition } from '../../src/types.js';
import { XRON } from '../../src/index.js';

const makeSchema = (fields: string[]): SchemaDefinition => ({
  name: 'A',
  fullName: 'Item',
  fields,
  signature: fields.sort().join(','),
  frequency: 10,
  nestedSchemas: new Map(),
  fieldTypes: new Map(),
});

describe('Temporal Delta Encoding', () => {
  describe('analyzeDeltaColumns', () => {
    it('detects sequential ISO date-only strings', () => {
      const schema = makeSchema(['date', 'val']);
      const rows = [
        ['2026-01-01', 1],
        ['2026-01-02', 2],
        ['2026-01-03', 3],
      ];
      const deltas = analyzeDeltaColumns(rows, schema, 3);
      const dateDelta = deltas.find(d => d.columnIndex === 0);
      expect(dateDelta).toBeDefined();
      expect(dateDelta!.type).toBe('temporal');
    });

    it('detects sequential ISO datetime strings with Z timezone', () => {
      const schema = makeSchema(['ts', 'val']);
      const rows = [
        ['2026-04-01T10:00:00Z', 1],
        ['2026-04-01T11:00:00Z', 2],
        ['2026-04-01T12:00:00Z', 3],
      ];
      const deltas = analyzeDeltaColumns(rows, schema, 3);
      const tsDelta = deltas.find(d => d.columnIndex === 0);
      expect(tsDelta).toBeDefined();
      expect(tsDelta!.type).toBe('temporal');
    });

    it('does NOT detect non-date strings', () => {
      const schema = makeSchema(['label', 'val']);
      const rows = [
        ['abc', 1],
        ['def', 2],
        ['ghi', 3],
      ];
      const deltas = analyzeDeltaColumns(rows, schema, 3);
      const labelDelta = deltas.find(d => d.type === 'temporal');
      expect(labelDelta).toBeUndefined();
    });

    it('does NOT detect mixed types (some dates, some not)', () => {
      const schema = makeSchema(['mixed', 'val']);
      const rows = [
        ['2026-01-01', 1],
        ['not-a-date', 2],
        ['2026-01-03', 3],
      ];
      const deltas = analyzeDeltaColumns(rows, schema, 3);
      const mixedDelta = deltas.find(d => d.columnIndex === 0 && d.type === 'temporal');
      expect(mixedDelta).toBeUndefined();
    });
  });

  describe('applyDeltaEncoding (temporal)', () => {
    it('encodes compact date rows with +86400s deltas', () => {
      const deltaColumns = [
        { columnIndex: 0, type: 'temporal' as const, isConstant: true, constantDelta: 86400 },
      ];
      const rows = [
        ['20260101', 'A'],
        ['20260102', 'B'],
        ['20260103', 'C'],
      ];
      const result = applyDeltaEncoding(rows, deltaColumns);
      expect(result[0][0]).toBe('20260101');
      expect(result[1][0]).toBe('+86400s');
      expect(result[2][0]).toBe('+86400s');
    });
  });

  describe('Integration: round-trip via XRON.stringify / XRON.parse', () => {
    it('date-only string fields round-trip at level 3', () => {
      const data = [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-02', value: 20 },
        { date: '2026-01-03', value: 30 },
      ];
      expect(XRON.parse(XRON.stringify(data, { level: 3 }))).toEqual(data);
    });

    it('ISO datetime with Z round-trips at level 3', () => {
      const data = [
        { ts: '2026-04-01T10:00:00Z', v: 1 },
        { ts: '2026-04-01T11:00:00Z', v: 2 },
        { ts: '2026-04-01T12:00:00Z', v: 3 },
      ];
      expect(XRON.parse(XRON.stringify(data, { level: 3 }))).toEqual(data);
    });

    it('negative deltas (reverse chronological) round-trip', () => {
      const data = [
        { date: '2026-01-03', value: 30 },
        { date: '2026-01-02', value: 20 },
        { date: '2026-01-01', value: 10 },
      ];
      expect(XRON.parse(XRON.stringify(data, { level: 3 }))).toEqual(data);
    });

    it('non-constant deltas round-trip', () => {
      const data = [
        { date: '2026-01-01', v: 1 },
        { date: '2026-01-03', v: 2 },  // +2 days
        { date: '2026-01-10', v: 3 },  // +7 days
      ];
      expect(XRON.parse(XRON.stringify(data, { level: 3 }))).toEqual(data);
    });

    it('temporal delta output contains "+...s" in the XRON string at level 3', () => {
      const data = [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-02', value: 20 },
        { date: '2026-01-03', value: 30 },
      ];
      const encoded = XRON.stringify(data, { level: 3 });
      expect(encoded).toContain('+');
      expect(encoded).toMatch(/\+\d+s/);
    });
  });
});
