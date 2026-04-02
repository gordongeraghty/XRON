import { describe, it, expect } from 'vitest';
import {
  analyzeDeltaColumns,
  applyDeltaEncoding,
  applyRepeatEncoding,
  decodeDeltaRows,
  decodeRepeatRows,
} from '../../src/pipeline/delta.js';
import { SchemaDefinition } from '../../src/types.js';

const makeSchema = (fields: string[]): SchemaDefinition => ({
  name: 'A',
  fullName: 'Item',
  fields,
  signature: fields.sort().join(','),
  frequency: 10,
  nestedSchemas: new Map(),
  fieldTypes: new Map(),
});

describe('Delta Compression', () => {
  describe('analyzeDeltaColumns', () => {
    it('detects sequential numeric columns', () => {
      const schema = makeSchema(['id', 'name', 'score']);
      const rows = [
        [1, 'Alice', 10],
        [2, 'Bob', 20],
        [3, 'Carol', 30],
      ];
      const deltas = analyzeDeltaColumns(rows, schema, 3);
      expect(deltas.length).toBeGreaterThan(0);
      // id column should be detected (constant +1)
      const idDelta = deltas.find(d => d.columnIndex === 0);
      expect(idDelta).toBeDefined();
      expect(idDelta!.isConstant).toBe(true);
      expect(idDelta!.constantDelta).toBe(1);
    });

    it('does not apply to non-numeric columns', () => {
      const schema = makeSchema(['name', 'city']);
      const rows = [
        ['Alice', 'NYC'],
        ['Bob', 'LA'],
        ['Carol', 'SF'],
      ];
      const deltas = analyzeDeltaColumns(rows, schema, 3);
      expect(deltas.length).toBe(0);
    });

    it('skips datasets below threshold', () => {
      const schema = makeSchema(['id', 'name']);
      const rows = [[1, 'A'], [2, 'B']];
      const deltas = analyzeDeltaColumns(rows, schema, 3);
      expect(deltas.length).toBe(0);
    });
  });

  describe('applyDeltaEncoding', () => {
    it('replaces sequential values with +delta notation', () => {
      const deltaColumns = [{ columnIndex: 0, type: 'numeric' as const, isConstant: true, constantDelta: 1 }];
      const rows = [['1', 'Alice'], ['2', 'Bob'], ['3', 'Carol']];
      const result = applyDeltaEncoding(rows, deltaColumns);
      expect(result[0][0]).toBe('1');     // first row unchanged
      expect(result[1][0]).toBe('+1');    // delta
      expect(result[2][0]).toBe('+1');    // delta
    });
  });

  describe('applyRepeatEncoding', () => {
    it('replaces repeated values with ~', () => {
      const rows = [['1', 'Sales'], ['2', 'Sales'], ['3', 'Engineering']];
      const result = applyRepeatEncoding(rows, []);
      expect(result[1][1]).toBe('~');        // Sales repeated
      expect(result[2][1]).toBe('Engineering'); // different value
    });
  });

  describe('decodeDeltaRows', () => {
    it('reconstructs absolute values from deltas', () => {
      const rows = [['1', 'Alice'], ['+1', 'Bob'], ['+1', 'Carol']];
      const result = decodeDeltaRows(rows, new Set([0]));
      expect(result[0][0]).toBe('1');
      expect(result[1][0]).toBe('2');
      expect(result[2][0]).toBe('3');
    });
  });

  describe('decodeRepeatRows', () => {
    it('expands ~ markers to previous values', () => {
      const rows = [['1', 'Sales'], ['2', '~'], ['3', 'Engineering']];
      const result = decodeRepeatRows(rows);
      expect(result[1][1]).toBe('Sales');
    });
  });
});
