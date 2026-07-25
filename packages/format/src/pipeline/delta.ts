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

// Compact date pattern (20260401, 20260401T103000Z, 20260401T103000.000Z etc.)
// The fractional-seconds group is required: Date.prototype.toISOString() always
// emits milliseconds, so without it the most common timestamp format in
// JavaScript fails the gate below and parses to NaN.
const COMPACT_DATE_RE = /^\d{8}(T\d{4,6}(\.\d+)?(Z|[+-]\d{4})?)?$/;

// A value is only safe to delta-encode if its exact text can be rebuilt from
// (epoch seconds + one shape shared by the whole column).
const ISO_SHAPE_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/;

// Anchor shapes the decoder can reproduce exactly. Date-only values are no
// longer compacted (a bare YYYYMMDD is ambiguous with an integer), so the
// anchor for a date-only column arrives in full ISO form.
const ANCHOR_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ANCHOR_DATETIME_RE = /^\d{8}T\d{6}(\.\d+)?Z$/;

/**
 * Classify an ISO value into a shape key, or null when temporal delta cannot
 * reproduce it exactly.
 *
 * Deliberately refused, because epoch seconds do not carry them:
 * - UTC offsets ("-05:00") — reconstruction always emits Z, changing the text
 * - a missing timezone — parsed as local time, re-emitted as UTC
 * - a missing seconds field — reconstruction always emits seconds
 * - non-zero fractional seconds — sub-second precision is not in the delta
 *
 * Refused columns fall back to plain compact-date encoding, which round-trips.
 */
function temporalShape(value: string): string | null {
  const m = ISO_SHAPE_RE.exec(value);
  if (!m) return null;
  if (!value.includes('T')) return 'date';
  const frac = m[1];
  if (frac && /[^0.]/.test(frac)) return null;
  return `datetime:${frac ? frac.length - 1 : 0}`;
}

/**
 * Rebuild a date string from epoch seconds, in the column's shape.
 * Returns null for an epoch that does not yield a valid Date, so callers can
 * degrade instead of letting toISOString() throw.
 */
function formatCompactFromEpoch(
  epochSec: number,
  dateOnly: boolean,
  fracDigits: number,
): string | null {
  const d = new Date(epochSec * 1000);
  if (isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  // Date-only stays in full ISO form, matching what the encoder now emits.
  if (dateOnly) return iso.slice(0, 10);
  const stamp = iso.slice(0, 19).replace(/-/g, '').replace(/:/g, '');
  return fracDigits > 0 ? `${stamp}.${'0'.repeat(fracDigits)}Z` : `${stamp}Z`;
}

/** Read a cell as a BigInt, tolerating the trailing 'n' type marker. */
function toBigInt(raw: string): bigint {
  return BigInt(raw.endsWith('n') ? raw.slice(0, -1) : raw);
}

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

  // ...and must all share one reproducible shape. A column mixing date-only
  // with datetime, or carrying UTC offsets or real sub-second precision,
  // cannot survive the epoch round-trip, so it is left un-delta'd.
  const shape = temporalShape(values[0] as string);
  if (shape === null) return null;
  if (!values.every(v => temporalShape(v as string) === shape)) return null;

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
    // Mixed safety: promote all numeric values to BigInt. Only whole numbers
    // can be promoted — BigInt(967.585) throws, and rounding would lose data.
    if (!values.every(v =>
      typeof v === 'bigint' || (typeof v === 'number' && Number.isInteger(v))
    )) return null;

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
        const currentVal = toBigInt(rows[row][col]);
        const prevVal = toBigInt(rows[row - 1][col]);
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
      const dateOnly = ANCHOR_DATE_ONLY_RE.test(firstVal);
      const datetime = ANCHOR_DATETIME_RE.exec(firstVal);
      let currentEpoch = parseDateToEpoch(firstVal);

      // An anchor we cannot read (an unresolved $ref, a corrupt cell) means the
      // whole column is undecodable. Leave the raw deltas in place and move on:
      // building a Date from NaN and calling toISOString() throws RangeError,
      // which would take the entire document down over one bad column.
      if ((!dateOnly && datetime === null) || !Number.isFinite(currentEpoch)) continue;

      // Carry the anchor's fractional width through, rather than stripping it
      // with a fixed .replace(/\.\d{3}/, '') that only ever matched 3 digits.
      const fracDigits = datetime?.[1] ? datetime[1].length - 1 : 0;

      for (let row = 1; row < result.length; row++) {
        const raw = result[row][col];
        // Temporal delta ends with 's' (seconds)
        if (!raw.endsWith('s') || !(raw.startsWith('+') || raw.startsWith('-'))) continue;

        const deltaSec = parseInt(raw.slice(0, -1), 10);
        if (!Number.isFinite(deltaSec)) continue;

        currentEpoch = currentEpoch + deltaSec;
        const rebuilt = formatCompactFromEpoch(currentEpoch, dateOnly, fracDigits);
        if (rebuilt === null) continue;
        result[row][col] = rebuilt;
      }
    } else if (isBigInt) {
      let currentValue = toBigInt(result[0][col]);

      for (let row = 1; row < result.length; row++) {
        const raw = result[row][col];
        if (raw.startsWith('+') || (raw.startsWith('-') && raw.length > 1)) {
          currentValue = currentValue + toBigInt(raw);
          // Re-emit with the 'n' marker so the value still identifies itself
          // as a BigInt once it reaches the type decoder.
          result[row][col] = `${currentValue}n`;
        } else {
          currentValue = toBigInt(raw);
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
