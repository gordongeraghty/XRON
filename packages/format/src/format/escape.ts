/**
 * XRON string escaping — minimal quoting for maximum token efficiency.
 *
 * Rules:
 * - Strings are unquoted by default (saves 2 tokens per string)
 * - Quote with " only when the value contains: comma, newline, leading/trailing space,
 *   starts with special prefix ($, +, *, ~, @, -), or looks like a number/boolean/null
 */

// A literal double quote anywhere must force quoting (and hence escaping).
// The old `^".*"$` only matched a value that was ALREADY fully quote-wrapped,
// so an interior quote like `has"quote` went out raw and flipped the inQuotes
// state machine in splitRow/splitKeyValue — desynchronising every field after
// it in the row, which is where the "reading 'startsWith' of undefined" crash
// came from.
const NEEDS_QUOTING_REGEX = /[,\n\r\t"]|^\s|\s$|^[@$%+*~\-\[{]/;
const LOOKS_LIKE_NUMBER = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
// A string like "5n" would otherwise be read back as the BigInt 5n.
const LOOKS_LIKE_BIGINT = /^-?\d+n$/;
const RESERVED_WORDS = new Set(['true', 'false', 'null', '-', '1', '0']);

/**
 * Determine if a string value needs quoting in XRON output.
 */
export function needsQuoting(value: string): boolean {
  if (value === '') return true;
  if (NEEDS_QUOTING_REGEX.test(value)) return true;
  if (LOOKS_LIKE_NUMBER.test(value)) return true;
  if (LOOKS_LIKE_BIGINT.test(value)) return true;
  if (RESERVED_WORDS.has(value)) return true;
  // Check if it looks like a schema reference: Name(...)
  if (/^[A-Z][A-Za-z0-9]*\(/.test(value)) return true;
  return false;
}

/**
 * Escape a string value for XRON output.
 * Returns the value unquoted if safe, or quoted with minimal escaping.
 */
export function escapeValue(value: string): string {
  if (!needsQuoting(value)) {
    return value;
  }
  return quote(value);
}

/** Wrap in quotes, escaping internal quotes, backslashes and control chars. */
function quote(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

/**
 * Escape a string for the two positions where an unquoted ':' is structural
 * rather than content:
 *   - a bare top-level primitive, where the parser decides string-vs-object
 *     purely by whether a colon is present;
 *   - an object key in inline {k: v} form, where splitKeyValue splits on the
 *     first unquoted colon.
 *
 * Everywhere else a colon is inert, so widening NEEDS_QUOTING_REGEX instead
 * would quote every URL and timestamp in the document for no correctness gain
 * — measured at +5.5% on a colon-heavy payload. Byte-identical for any value
 * without a colon.
 */
export function escapeKey(value: string): string {
  if (!needsQuoting(value) && !value.includes(':')) {
    return value;
  }
  return quote(value);
}

/**
 * Unescape a quoted string from XRON input.
 */
export function unescapeValue(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }
  const inner = value.slice(1, -1);
  let result = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      const next = inner[i + 1];
      switch (next) {
        case '\\': result += '\\'; i++; break;
        case '"': result += '"'; i++; break;
        case 'n': result += '\n'; i++; break;
        case 'r': result += '\r'; i++; break;
        case 't': result += '\t'; i++; break;
        default: result += '\\' + next; i++; break;
      }
    } else {
      result += inner[i];
    }
  }
  return result;
}

/**
 * Determine the type of a raw unquoted value string during parsing.
 */
export function inferType(raw: string): any {
  if (raw === '-' || raw === 'null') return null;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  if (LOOKS_LIKE_NUMBER.test(raw)) return Number(raw);
  return raw;
}

/**
 * Infer type with level awareness — Level 2+ uses compact booleans (1/0).
 * Level 1 uses standard true/false strings that need separate boolean detection.
 */
export function inferTypeForLevel(raw: string, level: number): any {
  if (raw === '-' || raw === 'null') return null;

  if (level >= 2) {
    // In Level 2+, standalone 1/0 could be booleans OR numbers.
    // We rely on schema type hints for disambiguation.
    // For now, numbers are numbers, true/false are booleans.
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } else {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  }

  if (LOOKS_LIKE_NUMBER.test(raw)) return Number(raw);
  return raw;
}
