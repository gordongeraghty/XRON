/**
 * Layer 4: Type-Aware Compact Encoding
 *
 * Encodes values using the most token-efficient representation:
 * - Booleans: true→1, false→0 (Level 2+)
 * - Null: null→- (Level 2+)
 * - Numbers: passed through unquoted (all levels)
 * - Dates: ISO strings→compact format (Level 2+)
 * - UUIDs: full→base62 shortened (Level 3)
 * - Strings: unquoted when safe, minimal escaping
 */

import { XronLevel } from '../types.js';
import { escapeValue, needsQuoting } from '../format/escape.js';

// ISO date pattern: 2026-04-01, 2026-04-01T14:30:00Z, etc.
//
// The offset must carry its colon. Compaction strips separators, so "+05:30"
// and "+0530" both compact to "+0530" and expandDate cannot tell which one it
// started from — it always re-inserts the colon. Rather than guess and corrupt
// the colon-less form, exclude it here: it falls through to plain string
// encoding and round-trips untouched.
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

// UUID v4 pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encode a primitive value to its most compact XRON string representation.
 */
export function encodeTypedValue(
  value: any,
  level: XronLevel,
  compactBoolean = false,
): string {
  // Null
  if (value === null || value === undefined) {
    return level >= 2 ? '-' : 'null';
  }

  // Boolean.
  // 1/0 is only recoverable when the decoder is told the field is a boolean,
  // which happens solely for a uniformly-boolean column carrying the ?b hint.
  // In a mixed column, or anywhere without a hint, 1/0 comes back as the
  // number 1 — so those positions keep the explicit true/false spelling.
  if (typeof value === 'boolean') {
    if (level >= 2 && compactBoolean) {
      return value ? '1' : '0';
    }
    return value ? 'true' : 'false';
  }

  // Number
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return 'null'; // NaN, Infinity → null (same as JSON)
    }
    return String(value);
  }

  // String
  if (typeof value === 'string') {
    // Level 2+: Compact date encoding
    if (level >= 2 && ISO_DATE_REGEX.test(value)) {
      return compactDate(value);
    }

    // Level 3: Base62 UUID compression
    if (level >= 3 && UUID_REGEX.test(value)) {
      return `^${uuidToBase62(value)}`;
    }

    return escapeValue(value);
  }

  // BigInt — marked with a trailing 'n', exactly as a JS BigInt literal.
  // Without the marker a BigInt and a Number produce identical text, and the
  // decoder was guessing by digit count: 5n came back as the number 5, while
  // the number 1e20 came back as a BigInt. A schema hint only covers a
  // uniformly-BigInt column, so mixed and inline positions need the value to
  // carry its own type.
  if (typeof value === 'bigint') {
    return `${value}n`;
  }

  // Fallback: stringify
  return escapeValue(String(value));
}

/**
 * Decode a typed value string back to its JavaScript primitive.
 */
export function decodeTypedValue(raw: string, level: XronLevel): any {
  // Null
  if (raw === '-' || raw === 'null') return null;

  // Boolean (Level 1: true/false only; Level 2+: also 1/0)
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Base62 UUID (Level 3): ^encodedValue
  if (level >= 3 && raw.startsWith('^')) {
    return base62ToUuid(raw.slice(1));
  }

  // Compact date (Level 2+): YYYYMMDDTHHMMSSZ etc.
  // The 'T' is required. A bare YYYYMMDD is ambiguous with an integer, so it is
  // no longer produced (see compactDate) and no longer consumed here — that
  // ambiguity is what turned {n: 20260101} into {n: "2026-01-01"}.
  if (level >= 2 && /^\d{8}T/.test(raw) && isCompactDate(raw)) {
    return expandDate(raw);
  }

  // Quoted string
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return unescapeQuoted(raw);
  }

  // BigInt literal: an explicit trailing 'n'.
  if (/^-?\d+n$/.test(raw)) {
    return BigInt(raw.slice(0, -1));
  }

  // Number. Length is deliberately NOT used to infer BigInt any more — a long
  // numeric literal is just a large Number, and anything that is genuinely a
  // BigInt now says so with the 'n' suffix above.
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(raw)) {
    return Number(raw);
  }

  // Plain string
  return raw;
}

// ─── Date Compaction ───────────────────────────────────────────────

/**
 * Compact an ISO date string by removing separators.
 * "2026-04-01" → "20260401"
 * "2026-04-01T14:30:00Z" → "20260401T143000Z"
 */
export function compactDate(iso: string): string {
  // Date-only values are left alone on purpose. "20260401" is indistinguishable
  // from the integer 20260401, and no heuristic can separate them — which is
  // exactly how plain 8-digit numbers ended up decoding as date strings. The
  // uncompacted "2026-04-01" already round-trips as a string (it fails the
  // number test on its dashes), so the two chars buy correctness cheaply.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return iso;
  }

  // DateTime: strip separators from the date and time parts only.
  // A blanket .replace(/-/g,'') also eats the sign of a negative UTC offset,
  // turning "...T06:30:00-05:00" into "...T0630000500" — a string that is no
  // longer a timestamp at all and cannot be expanded back.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(.+?)(Z|[+-]\d{2}:?\d{2})?$/.exec(iso);
  if (!m) {
    return iso.replace(/-/g, '').replace(/:/g, '');
  }
  const [, year, month, day, time, tz = ''] = m;
  return `${year}${month}${day}T${time.replace(/:/g, '')}${tz.replace(':', '')}`;
}

/**
 * Expand a compact date back to ISO format.
 * "20260401" → "2026-04-01"
 * "20260401T143000Z" → "2026-04-01T14:30:00Z"
 */
export function expandDate(compact: string): string {
  // Date only: 20260401 → 2026-04-01
  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }

  // DateTime with T
  const tIdx = compact.indexOf('T');
  if (tIdx === 8) {
    const datePart = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
    let timePart = compact.slice(9); // after T

    // Find timezone suffix (Z or +/- offset)
    let tzSuffix = '';
    const tzMatch = timePart.match(/([Z]|[+-]\d{4})$/);
    if (tzMatch) {
      tzSuffix = tzMatch[1];
      if (tzSuffix !== 'Z' && tzSuffix.length === 5) {
        tzSuffix = `${tzSuffix.slice(0, 3)}:${tzSuffix.slice(3)}`;
      }
      timePart = timePart.slice(0, -tzMatch[1].length);
    }

    // Insert colons into time: HHMMSS → HH:MM:SS
    let formattedTime = timePart;
    if (/^\d{6}/.test(timePart)) {
      formattedTime = `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4)}`;
    } else if (/^\d{4}$/.test(timePart)) {
      formattedTime = `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}`;
    }

    return `${datePart}T${formattedTime}${tzSuffix}`;
  }

  return compact;
}

/**
 * Check if a numeric string could be a compact date (basic sanity check).
 */
function isCompactDate(value: string): boolean {
  if (value.length < 8) return false;
  const year = parseInt(value.slice(0, 4), 10);
  const month = parseInt(value.slice(4, 6), 10);
  const day = parseInt(value.slice(6, 8), 10);
  // The year range no longer needs to be narrow: callers require a 'T'
  // separator, which already rules out confusion with an integer. The old
  // 1900-2100 clamp silently refused to expand valid dates outside it.
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// ─── UUID Base62 Compression ──────────────────────────────────────

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Convert a UUID to a shorter base62 string.
 * "550e8400-e29b-41d4-a716-446655440000" → shorter base62 string (~22 chars)
 */
export function uuidToBase62(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  let num = BigInt('0x' + hex);
  if (num === 0n) return '0';

  let result = '';
  const base = BigInt(62);
  while (num > 0n) {
    const remainder = Number(num % base);
    result = BASE62_CHARS[remainder] + result;
    num = num / base;
  }
  return result;
}

/**
 * Convert a base62 string back to a UUID.
 */
export function base62ToUuid(b62: string): string {
  let num = 0n;
  const base = BigInt(62);
  for (const ch of b62) {
    const idx = BASE62_CHARS.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base62 character: ${ch}`);
    num = num * base + BigInt(idx);
  }

  // Convert to 32-char hex, zero-padded
  let hex = num.toString(16).padStart(32, '0');

  // Format as UUID
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Unescape a quoted string.
 */
function unescapeQuoted(value: string): string {
  const inner = value.slice(1, -1);
  let result = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      switch (inner[i + 1]) {
        case '\\': result += '\\'; i++; break;
        case '"': result += '"'; i++; break;
        case 'n': result += '\n'; i++; break;
        case 'r': result += '\r'; i++; break;
        case 't': result += '\t'; i++; break;
        default: result += '\\' + inner[i + 1]; i++; break;
      }
    } else {
      result += inner[i];
    }
  }
  return result;
}
