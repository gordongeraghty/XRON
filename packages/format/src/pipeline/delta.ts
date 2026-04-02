/**
 * Layer 5: Delta + Run-Length Compression
 *
 * For arrays encoded via positional streaming, detects:
 * - Sequential numeric columns → delta encoding (+N notation)
 * - Repeated values → same-as-previous (~) or run-length (*N)
 *
 * Input rows:  1, Alice, Sales
 *              2, Bob, Sales
 *              3, Carol, Engineering
 *
 * Output rows: 1, Alice, Sales
 *              +1, Bob, ~
 *              +1, Carol, Engineering
 */

import { DeltaColumnInfo, SchemaDefinition } from '../types.js';

/**
 * Analyze columns in a dataset to determine which support delta encoding.
 * Returns info about each column that qualifies.
 */
export function analyzeDeltaColumns(
  rows: any[][],
  schema: SchemaDefinition,
  threshold: number,
): DeltaColumnInfo[] {
  if (rows.length < threshold) return [];

  const deltaColumns: DeltaColumnInfo[] = [];

  for (let col = 0; col < schema.fields.length; col++) {
    const values = rows.map(row => row[col]);

    // Check for numeric sequential pattern
    const numericInfo = analyzeNumericColumn(values, col);
    if (numericInfo) {
      deltaColumns.push(numericInfo);
    }
  }

  return deltaColumns;
}

/**
 * Check if a column's values are numeric and sequential (suitable for delta).
 */
function analyzeNumericColumn(
  values: any[],
  columnIndex: number,
): DeltaColumnInfo | null {
  if (values.length < 2) return null;

  const hasBigInt = values.some(v => typeof v === 'bigint');

  if (hasBigInt) {
    // Mixed safety: promote all numeric values to BigInt
    if (!values.every(v => typeof v === 'bigint' || (typeof v === 'number' && isFinite(v)))) return null;

    const bigValues: bigint[] = values.map(v => BigInt(v as number | bigint));
    const deltas: bigint[] = [];
    for (let i = 1; i < bigValues.length; i++) {
      deltas.push(bigValues[i] - bigValues[i - 1]);
    }

    const isConstant = deltas.every(d => d === deltas[0]);

    const avgAbsValue = bigValues.reduce((sum, v) => sum + (v < 0n ? -v : v), 0n) / BigInt(bigValues.length);
    const avgAbsDelta = deltas.reduce((sum, d) => sum + (d < 0n ? -d : d), 0n) / BigInt(deltas.length);

    if (!isConstant && avgAbsDelta >= avgAbsValue / 2n) {
      return null;
    }

    return {
      columnIndex,
      type: 'numeric',
      isConstant,
      constantDelta: isConstant ? deltas[0] : null,
      isBigInt: true,
    };
  }

  // All values must be numbers
  if (!values.every(v => typeof v === 'number' && isFinite(v))) return null;

  // Calculate deltas
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i++) {
    deltas.push(values[i] - values[i - 1]);
  }

  // Check if all deltas are the same (constant increment)
  const isConstant = deltas.every(d => d === deltas[0]);

  // Delta encoding is beneficial if:
  // - All deltas are the same constant (e.g., incrementing IDs)
  // - OR delta values are smaller than absolute values (saves digits)
  const avgAbsValue = values.reduce((sum, v) => sum + Math.abs(v), 0) / values.length;
  const avgAbsDelta = deltas.reduce((sum, d) => sum + Math.abs(d), 0) / deltas.length;

  if (!isConstant && avgAbsDelta >= avgAbsValue * 0.5) {
    return null; // Delta encoding would not save enough
  }

  return {
    columnIndex,
    type: 'numeric',
    isConstant,
    constantDelta: isConstant ? deltas[0] : null,
  };
}

/**
 * Apply delta encoding to a set of string rows (already formatted).
 * Modifies values in-place for columns that qualify for delta encoding.
 *
 * Returns new rows with delta notations applied.
 */
export function applyDeltaEncoding(
  rows: string[][],
  deltaColumns: DeltaColumnInfo[],
): string[][] {
  if (rows.length === 0 || deltaColumns.length === 0) return rows;

  const result: string[][] = rows.map(row => [...row]);

  for (const deltaInfo of deltaColumns) {
    const col = deltaInfo.columnIndex;

    for (let row = 1; row < result.length; row++) {
      if (deltaInfo.isBigInt) {
        const currentVal = BigInt(rows[row][col]);
        const prevVal = BigInt(rows[row - 1][col]);
        const delta = currentVal - prevVal;
        result[row][col] = delta >= 0n ? `+${delta}` : `${delta}`;
      } else {
        const currentVal = parseFloat(rows[row][col]);
        const prevVal = parseFloat(rows[row - 1][col]);

        if (!isNaN(currentVal) && !isNaN(prevVal)) {
          const delta = currentVal - prevVal;
          result[row][col] = delta >= 0 ? `+${delta}` : `${delta}`;
        }
      }
    }
  }

  return result;
}

/**
 * Apply run-length and same-as-previous encoding to rows.
 * Replaces repeated values with ~ (same as previous row's value in this column).
 *
 * Note: This is applied AFTER delta encoding, so delta columns are skipped.
 */
export function applyRepeatEncoding(
  rows: string[][],
  deltaColumns: DeltaColumnInfo[],
): string[][] {
  if (rows.length < 2) return rows;

  const result: string[][] = rows.map(row => [...row]);
  const deltaColSet = new Set(deltaColumns.map(d => d.columnIndex));

  for (let col = 0; col < (rows[0]?.length ?? 0); col++) {
    // Skip delta-encoded columns
    if (deltaColSet.has(col)) continue;

    for (let row = 1; row < result.length; row++) {
      if (result[row][col] === rows[row - 1][col]) {
        result[row][col] = '~';
      }
    }
  }

  return result;
}

/**
 * Decode delta-encoded values in rows back to absolute values.
 */
export function decodeDeltaRows(
  rows: string[][],
  deltaColumns: Set<number>,
  bigintColumns?: Set<number>,
): string[][] {
  if (rows.length === 0) return rows;

  const result: string[][] = rows.map(row => [...row]);

  for (const col of deltaColumns) {
    const isBigInt = bigintColumns?.has(col) ?? false;

    if (isBigInt) {
      let currentValue = BigInt(result[0][col]);

      for (let row = 1; row < result.length; row++) {
        const raw = result[row][col];
        if (raw.startsWith('+') || (raw.startsWith('-') && raw.length > 1)) {
          currentValue = currentValue + BigInt(raw);
          result[row][col] = String(currentValue);
        } else {
          currentValue = BigInt(raw);
        }
      }
    } else {
      let currentValue = parseFloat(result[0][col]);

      for (let row = 1; row < result.length; row++) {
        const raw = result[row][col];
        if (raw.startsWith('+') || (raw.startsWith('-') && raw.length > 1)) {
          const delta = parseFloat(raw);
          currentValue = currentValue + delta;
          result[row][col] = String(currentValue);
        } else {
          currentValue = parseFloat(raw);
        }
      }
    }
  }

  return result;
}

/**
 * Decode same-as-previous (~) markers back to actual values.
 */
export function decodeRepeatRows(rows: string[][]): string[][] {
  if (rows.length < 2) return rows;

  const result: string[][] = rows.map(row => [...row]);

  for (let col = 0; col < (rows[0]?.length ?? 0); col++) {
    for (let row = 1; row < result.length; row++) {
      if (result[row][col] === '~') {
        result[row][col] = result[row - 1][col];
      }
    }
  }

  return result;
}
