/**
 * XRON header formatting — @v, @S, @D, @N directives.
 *
 * Headers are the structural metadata that precedes the data payload.
 * They define the version, schemas, dictionaries, and cardinality guards.
 */

import { SchemaDefinition, XronLevel } from '../types.js';
import { ColumnTemplate } from '../pipeline/column-template.js';

/**
 * Format the version header line.
 */
export function formatVersionHeader(level: XronLevel): string {
  return `@v${level}`;
}

/**
 * Format a schema definition header line.
 * Level 1: @S User: id, name, email
 * Level 2+: @S A: id, name, email
 * Level 2+ with type hints: @S A: id, name, email, active?b
 * Type suffixes: ?b=boolean, ?n=number, ?s=string (only ?b is needed for lossless)
 */
export function formatSchemaHeader(
  schema: SchemaDefinition,
  level: XronLevel,
): string {
  const name = level >= 2 ? schema.name : schema.fullName;
  const fields = schema.fields.map((f, i) => {
    const type = schema.fieldTypes.get(i);
    const suffix =
      type === 'boolean' ? '?b' :
      type === 'date' ? '?d' :
      type === 'bigint' ? '?i' : '';
    // Field names were written raw into a comma-separated line, so a key
    // containing a comma split into two columns, a key ending in "?b" was
    // read as a type hint and renamed, and a hint appended to a name the bare
    // pattern (\w+) cannot express — anything with a space — was left glued on
    // as part of the key. Quote the name in all of those cases; the hint then
    // sits outside the quotes where it is unambiguous.
    const needsQuote =
      /[",]/.test(f) ||
      /\?[bnsdi]$/.test(f) ||
      (suffix !== '' && !/^\w+$/.test(f)) ||
      f !== f.trim() ||
      f === '';
    const encoded = needsQuote
      ? `"${f.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : f;
    return `${encoded}${suffix}`;
  }).join(', ');
  return `@S ${name}: ${fields}`;
}

/**
 * Format a dictionary header line.
 * @D: Sales, Engineering, Marketing
 */
export function formatDictHeader(values: string[]): string {
  if (values.length === 0) return '';
  // Quote any value the single-line, comma-separated @D format cannot carry
  // verbatim. A raw newline ended the header line early and destroyed the rest
  // of the document; leading/trailing whitespace was silently trimmed off on
  // the way back in.
  const escaped = values.map(v => {
    if (/[,"\n\r\t\\]/.test(v) || v !== v.trim() || v === '') {
      return `"${v
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')}"`;
    }
    return v;
  });
  return `@D: ${escaped.join(', ')}`;
}

/**
 * Format a cardinality guard line.
 * @N5 User   or   @N5 A
 */
export function formatCardinalityHeader(
  count: number,
  schemaName: string,
): string {
  return `@N${count} ${schemaName}`;
}

/**
 * Parse a version header: "@v1" → 1, "@v2" → 2, "@v3" → 3
 */
export function parseVersionHeader(line: string): XronLevel | null {
  const match = line.match(/^@v([123])$/);
  if (!match) return null;
  return parseInt(match[1], 10) as XronLevel;
}

/**
 * Parse a schema header: "@S Name: field1, field2, field3"
 * Supports type hints: "field?b" for boolean, "field?n" for number.
 * Returns { name, fields, fieldTypes } or null.
 */
export function parseSchemaHeader(
  line: string,
): { name: string; fields: string[]; fieldTypes: Map<number, string> } | null {
  const match = line.match(/^@S\s+(\w+)\s*:\s*(.+)$/);
  if (!match) return null;
  const name = match[1];
  // Split on commas that are outside quotes — a quoted field name may contain
  // one. A plain split(',') turned the key "a,b" into two columns.
  const rawFields: string[] = [];
  {
    let current = '';
    let inQuotes = false;
    let escaped = false;
    for (let i = 0; i < match[2].length; i++) {
      const ch = match[2][i];
      if (escaped) { current += ch; escaped = false; continue; }
      if (ch === '\\' && inQuotes) { current += ch; escaped = true; continue; }
      if (ch === '"') { inQuotes = !inQuotes; current += ch; continue; }
      if (ch === ',' && !inQuotes) { rawFields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    if (current.trim().length > 0) rawFields.push(current.trim());
  }

  const fields: string[] = [];
  const fieldTypes = new Map<number, string>();

  const setType = (i: number, typeChar: string) => {
    if (typeChar === 'b') fieldTypes.set(i, 'boolean');
    else if (typeChar === 'n') fieldTypes.set(i, 'number');
    else if (typeChar === 's') fieldTypes.set(i, 'string');
    else if (typeChar === 'd') fieldTypes.set(i, 'date');
    else if (typeChar === 'i') fieldTypes.set(i, 'bigint');
  };

  for (let i = 0; i < rawFields.length; i++) {
    const raw = rawFields[i];

    if (raw.startsWith('"')) {
      // Quoted name: read to the closing quote, then any hint sits after it.
      let buf = '';
      let j = 1;
      for (; j < raw.length; j++) {
        const ch = raw[j];
        if (ch === '\\' && j + 1 < raw.length) { buf += raw[++j]; continue; }
        if (ch === '"') break;
        buf += ch;
      }
      fields.push(buf);
      const hint = raw.slice(j + 1).match(/^\?([bnsdi])$/);
      if (hint) setType(i, hint[1]);
      continue;
    }

    const typeMatch = raw.match(/^(\w+)\?([bnsdi])$/);
    if (typeMatch) {
      fields.push(typeMatch[1]);
      setType(i, typeMatch[2]);
    } else {
      fields.push(raw);
    }
  }

  return { name, fields, fieldTypes };
}

/**
 * Parse a dictionary header: "@D: val0, val1, val2"
 * Returns array of values or null.
 */
export function parseDictHeader(line: string): string[] | null {
  const match = line.match(/^@D\s*:\s*(.+)$/);
  if (!match) return null;
  return parseDictValues(match[1]);
}

/**
 * Format a substring dictionary header line.
 * @P: substring1, substring2
 */
export function formatSubstringDictHeader(values: string[]): string {
  if (values.length === 0) return '';
  // Quote values that contain commas or quotes (same logic as @D dict)
  const escaped = values.map(v => {
    if (v.includes(',') || v.includes('"')) {
      return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return v;
  });
  return `@P: ${escaped.join(', ')}`;
}

/**
 * Parse a substring dictionary header: "@P: val0, val1"
 * Reuses the same parsing logic as @D (comma-separated, quote-aware).
 */
export function parseSubstringDictHeader(line: string): string[] | null {
  const match = line.match(/^@P\s*:\s*(.+)$/);
  if (!match) return null;
  return parseDictValues(match[1]);
}

/**
 * Parse comma-separated dictionary values, respecting quoted strings.
 * Handles escaped quotes (\") and backslashes (\\) within quoted values.
 */
export function parseDictValues(input: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let isEscaped = false;
  // A quoted value is returned verbatim. Trimming is only safe for bare
  // values, where surrounding space is formatting; inside quotes it is data,
  // and formatDictHeader quotes precisely so it survives.
  let wasQuoted = false;

  const push = () => {
    values.push(wasQuoted ? current : current.trim());
    current = '';
    wasQuoted = false;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (isEscaped) {
      // Decode the escape rather than taking the character literally —
      // otherwise "\n" came back as the letter n.
      switch (ch) {
        case 'n': current += '\n'; break;
        case 'r': current += '\r'; break;
        case 't': current += '\t'; break;
        default: current += ch; break;
      }
      isEscaped = false;
      continue;
    }

    if (ch === '\\' && inQuotes) {
      // Start escape sequence inside quotes
      isEscaped = true;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      if (inQuotes) {
        wasQuoted = true;
        // Entries are joined with ", ", so an opening quote is preceded by the
        // separator's space. That space is formatting, not data — drop it, or
        // skipping the trim below would prepend it to every quoted value.
        if (current.trim() === '') current = '';
      }
      // Don't include the quote character in the value
    } else if (ch === ',' && !inQuotes) {
      push();
    } else {
      current += ch;
    }
  }
  if (wasQuoted || current.trim().length > 0) {
    push();
  }
  return values;
}

/**
 * Format an anonymous 2D array header line.
 * @A 5 3   (5 rows, 3 columns)
 */
export function formatAnonymousArrayHeader(rowCount: number, colCount: number): string {
  return `@A ${rowCount} ${colCount}`;
}

/**
 * Parse an anonymous array header: "@A 5 3" → { rowCount: 5, colCount: 3 }
 */
export function parseAnonymousArrayHeader(
  line: string,
): { rowCount: number; colCount: number } | null {
  const match = line.match(/^@A\s+(\d+)\s+(\d+)$/);
  if (!match) return null;
  return {
    rowCount: parseInt(match[1], 10),
    colCount: parseInt(match[2], 10),
  };
}

/**
 * Parse a cardinality header: "@N5 User" → { count: 5, schemaName: "User" }
 */
export function parseCardinalityHeader(
  line: string,
): { count: number; schemaName: string } | null {
  const match = line.match(/^@N(\d+)\s+(\w+)$/);
  if (!match) return null;
  return {
    count: parseInt(match[1], 10),
    schemaName: match[2],
  };
}

/**
 * Determine if a line is a header directive.
 */
export function isHeaderLine(line: string): boolean {
  return line.startsWith('@');
}

/**
 * Format a checksum header line.
 * @C a1b2c3d4
 */
export function formatChecksumHeader(hex: string): string {
  return `@C ${hex}`;
}

/**
 * Parse a checksum header: "@C a1b2c3d4" → "a1b2c3d4"
 */
export function parseChecksumHeader(line: string): string | null {
  const match = line.match(/^@C\s+([0-9a-f]{8})$/);
  return match ? match[1] : null;
}

/**
 * Determine the type of header directive.
 */
export function getHeaderType(
  line: string,
): 'version' | 'schema' | 'dict' | 'cardinality' | 'template' | 'substring-dict' | 'checksum' | 'anonymous-array' | 'delta-columns' | 'unknown' {
  if (line.startsWith('@v')) return 'version';
  if (line.startsWith('@C')) return 'checksum';
  if (line.startsWith('@S')) return 'schema';
  if (line.startsWith('@D')) return 'dict';
  if (line.startsWith('@P')) return 'substring-dict';
  if (line.startsWith('@T')) return 'template';
  if (line.startsWith('@A')) return 'anonymous-array';
  if (line.startsWith('@X')) return 'delta-columns';
  if (line.startsWith('@N')) return 'cardinality';
  return 'unknown';
}

/**
 * Format a delta-columns header line.
 *   @X: 0, 2   columns 0 and 2 are delta-encoded in the block that follows
 *   @X:        explicitly no delta columns
 *
 * The encoder already knows which columns it delta-encoded; recording that
 * removes the decoder's need to infer it from cell text. Inference cannot
 * distinguish a delta from a literal negative number, so a plain -5 sitting in
 * a column the encoder left alone was being accumulated onto the previous row.
 * Emitting the empty form matters: it separates "this encoder decided none"
 * from "this document predates the header".
 */
export function formatDeltaColumnsHeader(columnIndices: number[]): string {
  return columnIndices.length > 0 ? `@X: ${columnIndices.join(', ')}` : '@X:';
}

/** Parse a delta-columns header: "@X: 0, 2" → [0, 2], "@X:" → [] */
export function parseDeltaColumnsHeader(line: string): number[] | null {
  const match = line.match(/^@X\s*:\s*(.*)$/);
  if (!match) return null;
  const inner = match[1].trim();
  if (inner === '') return [];
  return inner
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n));
}

/**
 * Format a column template header line.
 * @T colIndex: prefix{}suffix
 */
export function formatTemplateHeader(template: ColumnTemplate): string {
  const escapedPrefix = template.prefix.replace(/\{\}/g, '\\{\\}');
  const escapedSuffix = template.suffix.replace(/\{\}/g, '\\{\\}');
  return `@T ${template.columnIndex}: ${escapedPrefix}{}${escapedSuffix}`;
}

/**
 * Parse a column template header: "@T 2: user{}@example.com"
 */
export function parseTemplateHeader(line: string): ColumnTemplate | null {
  const match = line.match(/^@T\s+(\d+)\s*:\s*(.+)$/);
  if (!match) return null;
  const columnIndex = parseInt(match[1], 10);
  const pattern = match[2];

  // Find the {} placeholder (not escaped \{\})
  const placeholderIdx = findUnescapedPlaceholder(pattern);
  if (placeholderIdx === -1) return null;

  const prefix = pattern.slice(0, placeholderIdx).replace(/\\\{\\\}/g, '{}');
  const suffix = pattern.slice(placeholderIdx + 2).replace(/\\\{\\\}/g, '{}');

  return { columnIndex, prefix, suffix };
}

function findUnescapedPlaceholder(pattern: string): number {
  for (let i = 0; i < pattern.length - 1; i++) {
    if (pattern[i] === '{' && pattern[i + 1] === '}') {
      // Check it's not escaped
      if (i > 0 && pattern[i - 1] === '\\') continue;
      return i;
    }
  }
  return -1;
}
