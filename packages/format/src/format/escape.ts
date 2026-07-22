/**
 * XRON string escaping — minimal quoting for maximum token efficiency.
 *
 * Rules:
 * - Strings are unquoted by default (saves 2 tokens per string)
 * - Quote with " only when the value contains: comma, newline, leading/trailing space,
 *   starts with special prefix ($, +, *, ~, @, -), or looks like a number/boolean/null
 */

const NEEDS_QUOTING_REGEX = /[,\n\r\t]|^\s|\s$|^[@$%+*~\-\[{]|^".*"$/;
const LOOKS_LIKE_NUMBER = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
const RESERVED_WORDS = new Set(['true', 'false', 'null', '-', '1', '0']);

/**
 * Determine if a string value needs quoting in XRON output.
 */
export function needsQuoting(value: string): boolean {
  if (value === '') return true;
  if (NEEDS_QUOTING_REGEX.test(value)) return true;
  if (LOOKS_LIKE_NUMBER.test(value)) return true;
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

  // Performance optimization: Imperative loop with charCodeAt and slice
  // is significantly faster than chained .replace() with RegEx.
  let escaped = '';
  let lastIndex = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    if (ch === 92) {
      escaped += value.slice(lastIndex, i) + '\\\\';
      lastIndex = i + 1;
    } else if (ch === 34) {
      escaped += value.slice(lastIndex, i) + '\\"';
      lastIndex = i + 1;
    } else if (ch === 10) {
      escaped += value.slice(lastIndex, i) + '\\n';
      lastIndex = i + 1;
    } else if (ch === 13) {
      escaped += value.slice(lastIndex, i) + '\\r';
      lastIndex = i + 1;
    } else if (ch === 9) {
      escaped += value.slice(lastIndex, i) + '\\t';
      lastIndex = i + 1;
    }
  }
  if (lastIndex === 0) return `"${value}"`;
  return `"${escaped + value.slice(lastIndex)}"`;
}

/**
 * Unescape a quoted string from XRON input.
 */
export function unescapeValue(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }
  const inner = value.slice(1, -1);

  // Fast path for strings without backslash
  // Performance optimization: Imperative parsing is faster than RegEx here.
  // Fast path for strings without backslash
  const firstSlash = inner.indexOf('\\');
  if (firstSlash === -1) return inner;

  let result = '';
  let lastIndex = 0;
  const len = inner.length;

  for (let i = firstSlash; i < len; i++) {
    if (inner.charCodeAt(i) === 92 && i + 1 < len) {
      result += inner.slice(lastIndex, i);
      const next = inner.charCodeAt(i + 1);
      switch (next) {
        case 92: result += '\\'; break;
        case 34: result += '"'; break;
        case 110: result += '\n'; break;
        case 114: result += '\r'; break;
        case 116: result += '\t'; break;
        default: result += '\\' + String.fromCharCode(next); break;
      }
      i++;
      lastIndex = i + 1;
    }
  }
  return result + inner.slice(lastIndex);
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
