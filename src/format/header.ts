/**
 * XRON header formatting — @v, @S, @D, @N directives.
 *
 * Headers are the structural metadata that precedes the data payload.
 * They define the version, schemas, dictionaries, and cardinality guards.
 */

import { SchemaDefinition, XronLevel } from '../types.js';

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
    if (level >= 2 && schema.fieldTypes.get(i) === 'boolean') {
      return `${f}?b`;
    }
    return f;
  }).join(', ');
  return `@S ${name}: ${fields}`;
}

/**
 * Format a dictionary header line.
 * @D: Sales, Engineering, Marketing
 */
export function formatDictHeader(values: string[]): string {
  if (values.length === 0) return '';
  // Quote dictionary values that contain commas or double quotes,
  // escaping internal backslashes and quotes first
  const escaped = values.map(v => {
    if (v.includes(',') || v.includes('"')) {
      return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
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
  const rawFields = match[2].split(',').map(f => f.trim()).filter(f => f.length > 0);
  const fields: string[] = [];
  const fieldTypes = new Map<number, string>();

  for (let i = 0; i < rawFields.length; i++) {
    const typeMatch = rawFields[i].match(/^(\w+)\?([bns])$/);
    if (typeMatch) {
      fields.push(typeMatch[1]);
      const typeChar = typeMatch[2];
      if (typeChar === 'b') fieldTypes.set(i, 'boolean');
      else if (typeChar === 'n') fieldTypes.set(i, 'number');
      else if (typeChar === 's') fieldTypes.set(i, 'string');
    } else {
      fields.push(rawFields[i]);
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
 * Parse comma-separated dictionary values, respecting quoted strings.
 * Handles escaped quotes (\") and backslashes (\\) within quoted values.
 */
function parseDictValues(input: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let isEscaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (isEscaped) {
      // Previous char was backslash — consume the escaped char literally
      current += ch;
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
      // Don't include the quote character in the value
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    values.push(current.trim());
  }
  return values;
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
 * Determine the type of header directive.
 */
export function getHeaderType(
  line: string,
): 'version' | 'schema' | 'dict' | 'cardinality' | 'unknown' {
  if (line.startsWith('@v')) return 'version';
  if (line.startsWith('@S')) return 'schema';
  if (line.startsWith('@D')) return 'dict';
  if (line.startsWith('@N')) return 'cardinality';
  return 'unknown';
}
