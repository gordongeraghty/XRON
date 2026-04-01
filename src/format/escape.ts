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
  // Quote the string, escaping internal quotes and backslashes
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
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
