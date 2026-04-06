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
import { expandDate } from './type-encoding.js';

// ISO date string pattern (date-only or full datetime)
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

// Compact date pattern (20260401 or 20260401T103000Z etc.)
const COMPACT_DATE_RE = /^\d{8}(T\d{4,6}(Z|[+-]\d{4})?)?$/;

/**
 * Parse a date string (ISO or compact) to epoch seconds.
 * Handles both "2026-04-01T10:30:00Z" and "20260401T103000Z".
 */
function parseDateToEpoch(dateStr: string): number {
  // Try direct ISO parse first
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return Math.floor(d.getTime() / 1000);
  }
  // Try expanding compact date format
  if (COMPACT_DATE_RE.test(dateStr)) {
    const expanded = expandDate(dateStr);
    d = new Date(expanded);
    if (!isNaN(d.getTime())) {
      return Math.floor(d.getTime() / 1000);
    }
  }
  return NaN;
}

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

    // Check for temporal (ISO date string) sequential pattern first
    const temporalInfo = analyzeTemporalColumn(values, col);
    if (temporalInfo) {
      deltaColumns.push(temporalInfo);
      continue;
    }

    // Check for numeric sequential pattern
    const numericInfo = analyzeNumericColumn(values, col);
    if (numericInfo) {
      deltaColumns.push(numericInfo);
    }
  }

  return deltaColumns;
}

/**
 * Check if a column's values are ISO date strings in sequential order (suitable for temporal delta).
 * Converts dates to epoch seconds and checks if deltas are small relative to values.
 */
function analyzeTemporalColumn(
  values: any[],
  columnIndex: number,
): DeltaColumnInfo | null {
  if (values.length < 2) return null;

  // All values must be ISO date strings
  if (!values.every(v => typeof v === 'string' && ISO_DATE_RE.test(v))) return null;

  // Convert to epoch seconds
  const epochs: number[] = values.map(v => Math.floor(new Date(v as string).getTime() / 1000));

  // Verify all parsed correctly
  if (epochs.some(e => isNaN(e))) return null;

  // Calculate deltas
  const deltas: number[] = [];
  for (let i = 1; i < epochs.length; i++) {
    deltas.push(epochs[i] - epochs[i - 1]);
  }

  // Check if all deltas are constant
  const isConstant = deltas.every(d => d === deltas[0]);

  // Delta encoding is beneficial if deltas are small relative to absolute values
  // For dates, deltas are almost always much smaller (e.g. 86400s vs 1777000000s)
  const avgAbsValue = epochs.reduce((sum, v) => sum + Math.abs(v), 0) / epochs.length;
  const avgAbsDelta = deltas.reduce((sum, d) => sum + Math.abs(d), 0) / deltas.length;

  // Dates virtually always benefit — deltas are tiny vs epoch values
  if (!isConstant && avgAbsDelta >= avgAbsValue * 0.5) {
    return null;
  }

  return {
    columnIndex,
    type: 'temporal',
    isConstant,
    constantDelta: isConstant ? deltas[0] : null,
  };
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

    if (deltaInfo.type === 'temporal') {
      // Temporal delta: convert date strings to epoch seconds, emit deltas in seconds
      // First row keeps the original date string; subsequent rows get +Ns or -Ns
      // Rows may contain compact dates (20260401T103000Z) or ISO dates — handle both
      for (let row = 1; row < result.length; row++) {
        const currentEpoch = parseDateToEpoch(rows[row][col]);
        const prevEpoch = parseDateToEpoch(rows[row - 1][col]);
        const delta = currentEpoch - prevEpoch;
        result[row][col] = delta >= 0 ? `+${delta}s` : `${delta}s`;
      }
    } else if (deltaInfo.isBigInt) {
      for (let row = 1; row < result.length; row++) {
        const currentVal = BigInt(rows[row][col]);
        const prevVal = BigInt(rows[row - 1][col]);
        const delta = currentVal - prevVal;
        result[row][col] = delta >= 0n ? `+${delta}` : `${delta}`;
      }
    } else {
      for (let row = 1; row < result.length; row++) {
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
 * Handles numeric deltas (+N), bigint deltas, and temporal deltas (+Ns).
 */
export function decodeDeltaRows(
  rows: string[][],
  deltaColumns: Set<number>,
  bigintColumns?: Set<number>,
  temporalColumns?: Set<number>,
): string[][] {
  if (rows.length === 0) return rows;

  const result: string[][] = rows.map(row => [...row]);

  for (const col of deltaColumns) {
    const isTemporal = temporalColumns?.has(col) ?? false;
    const isBigInt = bigintColumns?.has(col) ?? false;

    if (isTemporal) {
      // Temporal delta: first row is an ISO date or compact date string,
      // subsequent rows are +Ns or -Ns (seconds delta).
      // Reconstruct by converting first row to epoch, then accumulating.
      const firstVal = result[0][col];
      let currentEpoch = parseDateToEpoch(firstVal);

      // Detect format: is the first value date-only (no T) or datetime?
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(firstVal) || /^\d{8}$/.test(firstVal);
      // Detect if compact format (no dashes)
      const isCompact = COMPACT_DATE_RE.test(firstVal);

      for (let row = 1; row < result.length; row++) {
        const raw = result[row][col];
        // Temporal delta ends with 's' (seconds)
        if (raw.endsWith('s') && (raw.startsWith('+') || raw.startsWith('-'))) {
          const deltaSec = parseInt(raw.slice(0, -1), 10);
          currentEpoch = currentEpoch + deltaSec;
          // Reconstruct date string from epoch in same format as first row
          const d = new Date(currentEpoch * 1000);
          if (isDateOnly) {
            if (isCompact) {
              // Compact date-only: 20260401
              result[row][col] = d.toISOString().slice(0, 10).replace(/-/g, '');
            } else {
              result[row][col] = d.toISOString().slice(0, 10);
            }
          } else if (isCompact) {
            // Compact datetime: 20260401T103000Z
            result[row][col] = d.toISOString().replace(/-/g, '').replace(/:/g, '').replace(/\.\d{3}/, '');
          } else {
            result[row][col] = d.toISOString();
          }
        }
        // else: non-delta value (shouldn't happen but pass through)
      }
    } else if (isBigInt) {
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
