/**
 * XRON Deserialization Engine
 *
 * Parses XRON format back to JavaScript objects. Reverses the compression pipeline:
 * Headers → Schema registry → Dictionary → Data rows → Delta decode → Type decode
 */

import {
  XronLevel,
  SchemaDefinition,
  XronDocument,
} from './types.js';
import {
  parseVersionHeader,
  parseSchemaHeader,
  parseDictHeader,
  parseCardinalityHeader,
  isHeaderLine,
  getHeaderType,
} from './format/header.js';
import { decodeTypedValue } from './pipeline/type-encoding.js';
import { resolveDictRef, isDictRef } from './pipeline/dictionary.js';
import { decodeDeltaRows, decodeRepeatRows } from './pipeline/delta.js';
import { splitRow, findSchemaByName } from './pipeline/positional.js';

/**
 * Parse an XRON string back to a JavaScript value.
 */
export function parse(input: string): any {
  if (typeof input !== 'string') {
    throw new TypeError('XRON.parse expects a string input');
  }

  const trimmed = input.trim();
  if (trimmed === '') return undefined;

  // Quick check: is this a simple primitive?
  if (trimmed === 'null' || trimmed === '-') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(trimmed)) return Number(trimmed);

  // Check if this is XRON format (starts with @v header)
  if (!trimmed.startsWith('@v')) {
    // Try parsing as a quoted string
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return decodeTypedValue(trimmed, 1);
    }

    // JSON fallback: if the input looks like JSON (starts with { or [), try JSON.parse.
    // This handles the case where XRON.stringify({ level: 'auto' }) returned raw JSON
    // because the XRON output would have been larger than the JSON original.
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Not valid JSON — fall through to XRON key-value parser
      }
    }

    // Single-line value without colons — return as plain string
    if (!trimmed.includes('\n') && !trimmed.includes(':')) {
      return trimmed;
    }
    // Might be a key-value object without headers
    return parseKeyValueBlock(trimmed, 1, [], new Map());
  }

  // Parse the XRON document
  const doc = parseDocument(trimmed);
  return doc.data;
}

/**
 * Parse a full XRON document (headers + data).
 */
function parseDocument(input: string): XronDocument {
  const lines = input.split('\n');
  let lineIdx = 0;

  // Phase 1: Parse headers
  let version: XronLevel = 1;
  const schemas = new Map<string, SchemaDefinition>();
  const schemasByName = new Map<string, SchemaDefinition>();
  let dictionary: string[] = [];

  while (lineIdx < lines.length) {
    const line = lines[lineIdx].trim();

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) {
      lineIdx++;
      continue;
    }

    if (!isHeaderLine(line)) break;

    const headerType = getHeaderType(line);

    switch (headerType) {
      case 'version': {
        const v = parseVersionHeader(line);
        if (v !== null) version = v;
        lineIdx++;
        break;
      }
      case 'schema': {
        const s = parseSchemaHeader(line);
        if (s) {
          const schema: SchemaDefinition = {
            name: s.name,
            fullName: s.name,
            fields: s.fields,
            signature: s.fields.slice().sort().join(','),
            frequency: 0,
            nestedSchemas: new Map(),
            fieldTypes: s.fieldTypes as Map<number, 'boolean' | 'number' | 'string' | 'null' | 'mixed'>,
          };
          schemas.set(schema.signature, schema);
          schemasByName.set(s.name, schema);
        }
        lineIdx++;
        break;
      }
      case 'dict': {
        const d = parseDictHeader(line);
        if (d) dictionary = d;
        lineIdx++;
        break;
      }
      case 'cardinality': {
        // Don't consume — cardinality headers are part of data
        break;
      }
      default:
        lineIdx++;
        break;
    }

    if (headerType === 'cardinality') break;
  }

  // Phase 2: Parse data section
  const remainingLines = lines.slice(lineIdx);
  const data = parseDataSection(remainingLines, version, schemas, schemasByName, dictionary);

  return { version, schemas, dictionary, data };
}

/**
 * Parse the data section of an XRON document.
 */
function parseDataSection(
  lines: string[],
  version: XronLevel,
  schemas: Map<string, SchemaDefinition>,
  schemasByName: Map<string, SchemaDefinition>,
  dictionary: string[],
): any {
  if (lines.length === 0) return null;

  let lineIdx = 0;

  // Skip empty lines
  while (lineIdx < lines.length && lines[lineIdx].trim() === '') lineIdx++;
  if (lineIdx >= lines.length) return null;

  const firstLine = lines[lineIdx].trim();

  // Check for cardinality header: @N5 SchemaName
  const cardinality = parseCardinalityHeader(firstLine);
  if (cardinality) {
    lineIdx++;
    const schema = schemasByName.get(cardinality.schemaName);
    if (!schema) {
      throw new Error(`Unknown schema: ${cardinality.schemaName}`);
    }

    // Collect data rows
    const dataRows: string[] = [];
    while (lineIdx < lines.length) {
      const line = lines[lineIdx];
      if (line.trim() === '' || isHeaderLine(line.trim())) break;
      dataRows.push(line.trim());
      lineIdx++;
    }

    // Validate cardinality
    if (dataRows.length !== cardinality.count) {
      // Soft warning — still parse what we have
      console.warn(
        `XRON: Expected ${cardinality.count} rows for schema ${cardinality.schemaName}, ` +
        `got ${dataRows.length}`
      );
    }

    // Decode rows
    return decodeSchemaRows(dataRows, schema, version, schemas, schemasByName, dictionary);
  }

  // Check for empty array/object
  if (firstLine === '[]') return [];
  if (firstLine === '{}') return {};

  // Check for inline array: [val1, val2, ...] or [{...}, {...}]
  if (firstLine.startsWith('[')) {
    if (firstLine.endsWith(']')) {
      return parseInlineBracketArray(firstLine, version, dictionary, schemasByName);
    }
    return parseInlineArray(lines.slice(lineIdx), version, schemas, schemasByName, dictionary);
  }

  // Check for inline object: {key: val, key: val}
  if (firstLine.startsWith('{') && firstLine.endsWith('}')) {
    return parseInlineBracketObject(firstLine, version, dictionary);
  }

  // Check for schema reference: SchemaName(val1, val2)
  const schemaRefMatch = firstLine.match(/^([A-Z][A-Za-z0-9]*)\((.+)\)$/);
  if (schemaRefMatch) {
    const schemaName = schemaRefMatch[1];
    const schema = schemasByName.get(schemaName);
    if (schema) {
      return decodeSchemaInstance(schemaRefMatch[2], schema, version, schemas, schemasByName, dictionary);
    }
  }

  // Key-value object
  return parseKeyValueBlock(
    lines.slice(lineIdx).join('\n'),
    version,
    dictionary,
    schemasByName,
  );
}

/**
 * Decode rows of positional data back into objects.
 */
function decodeSchemaRows(
  rows: string[],
  schema: SchemaDefinition,
  version: XronLevel,
  schemas: Map<string, SchemaDefinition>,
  schemasByName: Map<string, SchemaDefinition>,
  dictionary: string[],
): any[] {
  // Split each row into cells
  let cells = rows.map(row => splitRow(row));

  // Level 3: Decode repeat markers (~) first, then deltas
  if (version >= 3) {
    cells = decodeRepeatRows(cells);

    // Detect delta columns (columns where values start with +/-)
    const deltaColumns = new Set<number>();
    for (let col = 0; col < (cells[0]?.length ?? 0); col++) {
      for (let row = 1; row < cells.length; row++) {
        const val = cells[row][col];
        if (val.startsWith('+') || (val.startsWith('-') && val.length > 1 && /^\-\d/.test(val))) {
          deltaColumns.add(col);
          break;
        }
      }
    }

    if (deltaColumns.size > 0) {
      cells = decodeDeltaRows(cells, deltaColumns);
    }
  }

  // Convert cells back to objects
  const items: any[] = [];
  for (const row of cells) {
    const obj: Record<string, any> = {};
    for (let i = 0; i < schema.fields.length; i++) {
      const field = schema.fields[i];
      const raw = i < row.length ? row[i].trim() : '';

      // Check for nested schema reference
      const nestedMatch = raw.match(/^([A-Z][A-Za-z0-9]*)\((.+)\)$/);
      if (nestedMatch) {
        const nestedSchema = schemasByName.get(nestedMatch[1]);
        if (nestedSchema) {
          obj[field] = decodeSchemaInstance(
            nestedMatch[2], nestedSchema, version, schemas, schemasByName, dictionary
          );
          continue;
        }
      }

      // Check for inline array [val, val, ...] or object {key: val, ...}
      let decoded: any;
      if (raw.startsWith('[') && raw.endsWith(']')) {
        decoded = parseInlineBracketArray(raw, version, dictionary, schemasByName);
      } else if (raw.startsWith('{') && raw.endsWith('}')) {
        decoded = parseInlineBracketObject(raw, version, dictionary);
      } else {
        decoded = decodeRawValue(raw, version, dictionary);
      }

      // Apply field type hints for lossless boolean round-tripping
      const fieldType = schema.fieldTypes.get(i);
      if (fieldType === 'boolean' && typeof decoded === 'number') {
        decoded = decoded !== 0;
      }

      obj[field] = decoded;
    }
    items.push(obj);
  }

  return items;
}

/**
 * Decode a single schema instance: SchemaName(val1, val2, val3)
 */
function decodeSchemaInstance(
  argsStr: string,
  schema: SchemaDefinition,
  version: XronLevel,
  schemas: Map<string, SchemaDefinition>,
  schemasByName: Map<string, SchemaDefinition>,
  dictionary: string[],
): Record<string, any> {
  const values = splitRow(argsStr);
  const obj: Record<string, any> = {};

  for (let i = 0; i < schema.fields.length; i++) {
    const field = schema.fields[i];
    const raw = i < values.length ? values[i].trim() : '';

    // Check for nested schema reference
    const nestedMatch = raw.match(/^([A-Z][A-Za-z0-9]*)\((.+)\)$/);
    if (nestedMatch) {
      const nestedSchema = schemasByName.get(nestedMatch[1]);
      if (nestedSchema) {
        obj[field] = decodeSchemaInstance(
          nestedMatch[2], nestedSchema, version, schemas, schemasByName, dictionary
        );
        continue;
      }
    }

    obj[field] = decodeRawValue(raw, version, dictionary);
  }

  return obj;
}

/**
 * Decode a raw value string back to a JavaScript value.
 * Handles dictionary references, type decoding, etc.
 */
function decodeRawValue(
  raw: string,
  version: XronLevel,
  dictionary: string[],
): any {
  if (raw === '') return '';

  // Dictionary reference ($N)
  if (isDictRef(raw)) {
    const resolved = resolveDictRef(raw, dictionary);
    if (resolved !== null) return resolved;
  }

  // Type-aware decoding
  return decodeTypedValue(raw, version);
}

/**
 * Parse an inline array (lines starting with [, ending with ]).
 */
function parseInlineArray(
  lines: string[],
  version: XronLevel,
  schemas: Map<string, SchemaDefinition>,
  schemasByName: Map<string, SchemaDefinition>,
  dictionary: string[],
): any[] {
  const items: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === ']') break;
    if (line === '') continue;

    // Check for schema reference
    const schemaRefMatch = line.match(/^([A-Z][A-Za-z0-9]*)\((.+)\)$/);
    if (schemaRefMatch) {
      const schema = schemasByName.get(schemaRefMatch[1]);
      if (schema) {
        items.push(decodeSchemaInstance(
          schemaRefMatch[2], schema, version, schemas, schemasByName, dictionary
        ));
        continue;
      }
    }

    items.push(decodeRawValue(line, version, dictionary));
  }

  return items;
}

/**
 * Parse a key-value block (indentation-based object notation).
 */
function parseKeyValueBlock(
  input: string,
  version: XronLevel,
  dictionary: string[],
  schemasByName: Map<string, SchemaDefinition>,
): any {
  const lines = input.split('\n');
  const result: Record<string, any> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const [keyPart, valuePartRaw] = splitKeyValue(line);
    if (!keyPart) continue;

    const key = unescapeValue(keyPart.trim());
    const valuePart = valuePartRaw.trim();

    if (valuePart === '') {
      // Value is on next indented lines — collect nested block
      const nestedLines: string[] = [];
      const baseIndent = getIndent(line);
      let j = i + 1;
      while (j < lines.length) {
        const nextIndent = getIndent(lines[j]);
        if (lines[j].trim() === '' || nextIndent > baseIndent) {
          nestedLines.push(lines[j]);
          j++;
        } else {
          break;
        }
      }
      i = j - 1;

      if (nestedLines.length > 0) {
        const nestedStr = nestedLines.map(l => l).join('\n');
        const trimmedFirst = nestedLines[0]?.trim() ?? '';
        if (trimmedFirst === '[') {
          result[key] = parseInlineArray(
            nestedLines.map(l => l.trim()),
            version,
            new Map(),
            schemasByName,
            dictionary,
          );
        } else {
          result[key] = parseKeyValueBlock(nestedStr, version, dictionary, schemasByName);
        }
      }
    } else if (valuePart.startsWith('[') && valuePart.endsWith(']')) {
      // Inline array: [val1, val2, val3]
      const inner = valuePart.slice(1, -1);
      result[key] = splitTopLevel(inner).map(v => decodeRawValue(v.trim(), version, dictionary));
    } else {
      result[key] = decodeRawValue(valuePart, version, dictionary);
    }
  }

  return result;
}

/**
 * Get the indentation level of a line (number of leading spaces).
 */
function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Parse an inline bracket array: [{key: val, ...}, {key: val, ...}]
 */
function parseInlineBracketArray(
  line: string,
  version: XronLevel,
  dictionary: string[],
  schemasByName: Map<string, SchemaDefinition>,
): any[] {
  const inner = line.slice(1, -1).trim();
  if (inner === '') return [];

  // Split top-level items (respecting braces and brackets depth)
  const items = splitTopLevel(inner);
  return items.map(item => {
    const trimmed = item.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return parseInlineBracketObject(trimmed, version, dictionary);
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return parseInlineBracketArray(trimmed, version, dictionary, schemasByName);
    }
    return decodeRawValue(trimmed, version, dictionary);
  });
}

/**
 * Parse an inline bracket object: {key: val, key: val}
 */
function parseInlineBracketObject(
  line: string,
  version: XronLevel,
  dictionary: string[],
): Record<string, any> {
  const inner = line.slice(1, -1).trim();
  if (inner === '') return {};

  const obj: Record<string, any> = {};
  const pairs = splitTopLevel(inner);

  for (const pair of pairs) {
    const [keyPart, rawValPart] = splitKeyValue(pair);
    if (!keyPart) continue;
    const key = unescapeValue(keyPart.trim());
    const rawVal = rawValPart.trim();

    if (rawVal.startsWith('{') && rawVal.endsWith('}')) {
      obj[key] = parseInlineBracketObject(rawVal, version, dictionary);
    } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      obj[key] = parseInlineBracketArray(rawVal, version, dictionary, new Map());
    } else {
      obj[key] = decodeRawValue(rawVal, version, dictionary);
    }
  }

  return obj;
}

/**
 * Split a string by commas at the top level (respecting nested braces/brackets/parens).
 */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;

  let isEscaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    
    if (ch === '\\' && !isEscaped) {
      isEscaped = true;
      current += ch;
      continue;
    }

    if (ch === '"' && !isEscaped) {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && (ch === '{' || ch === '[' || ch === '(')) {
      depth++;
      current += ch;
    } else if (!inQuotes && (ch === '}' || ch === ']' || ch === ')')) {
      depth--;
      current += ch;
    } else if (ch === ',' && !inQuotes && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
    isEscaped = false;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Split a key-value pair at the first colon outside of quotes.
 */
function splitKeyValue(str: string): [string, string] {
  let inQuotes = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\' && !isEscaped) {
      isEscaped = true;
      continue;
    }
    if (ch === '"' && !isEscaped) {
      inQuotes = !inQuotes;
    } else if (ch === ':' && !inQuotes) {
      return [str.slice(0, i), str.slice(i + 1)];
    }
    isEscaped = false;
  }
  return ['', ''];
}

import { unescapeValue } from './format/escape.js';
