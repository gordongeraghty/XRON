/**
 * Layer 2: Positional Value Streaming
 *
 * For arrays of objects sharing a schema, streams values in positional order
 * (matching the schema's field declaration). Eliminates all key tokens.
 *
 * JSON: [{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]
 * XRON: @S A: id, name
 *       @N2 A
 *       1, Alice
 *       2, Bob
 */

import { SchemaDefinition, XronLevel } from '../types.js';
import { escapeValue } from '../format/escape.js';

/**
 * Encode an array of objects into positional value rows.
 * Each row is a comma-separated list of values in schema field order.
 *
 * Returns an array of row strings (without trailing newlines).
 */
export function encodePositionalRows(
  items: any[],
  schema: SchemaDefinition,
  allSchemas: Map<string, SchemaDefinition>,
  encodeValue: (value: any, schemas: Map<string, SchemaDefinition>) => string,
  level: XronLevel = 2,
): string[] {
  const rows: string[] = [];

  for (const item of items) {
    const values: string[] = [];
    for (let i = 0; i < schema.fields.length; i++) {
      const field = schema.fields[i];
      const value = item[field];
      const nestedSchemaName = schema.nestedSchemas.get(i);

      if (nestedSchemaName && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Encode as nested schema reference: SchemaName(val1, val2, ...)
        const nestedSchema = findSchemaByName(allSchemas, nestedSchemaName);
        if (nestedSchema) {
          const nestedValues = nestedSchema.fields.map(f => {
            return encodeValue(value[f], allSchemas);
          });
          const displayName = level >= 2 ? nestedSchema.name : nestedSchema.fullName;
          values.push(`${displayName}(${nestedValues.join(', ')})`);
        } else {
          values.push(encodeValue(value, allSchemas));
        }
      } else {
        values.push(encodeValue(value, allSchemas));
      }
    }
    rows.push(values.join(', '));
  }

  return rows;
}

/**
 * Decode positional value rows back into objects using the schema.
 */
export function decodePositionalRows(
  rows: string[],
  schema: SchemaDefinition,
  allSchemas: Map<string, SchemaDefinition>,
  dictionary: string[],
  decodeValue: (raw: string, schemas: Map<string, SchemaDefinition>, dictionary: string[]) => any,
): any[] {
  const items: any[] = [];

  for (const row of rows) {
    const rawValues = splitRow(row);
    const obj: Record<string, any> = {};

    for (let i = 0; i < schema.fields.length; i++) {
      const field = schema.fields[i];
      const raw = i < rawValues.length ? rawValues[i].trim() : '';

      // Check for nested schema reference: SchemaName(val1, val2, ...)
      const nestedMatch = raw.match(/^([A-Z][A-Za-z0-9]*)\((.+)\)$/);
      if (nestedMatch) {
        const nestedSchemaName = nestedMatch[1];
        const nestedSchema = findSchemaByName(allSchemas, nestedSchemaName);
        if (nestedSchema) {
          const nestedValues = splitRow(nestedMatch[2]);
          const nestedObj: Record<string, any> = {};
          for (let j = 0; j < nestedSchema.fields.length; j++) {
            const nField = nestedSchema.fields[j];
            const nRaw = j < nestedValues.length ? nestedValues[j].trim() : '';
            nestedObj[nField] = decodeValue(nRaw, allSchemas, dictionary);
          }
          obj[field] = nestedObj;
          continue;
        }
      }

      obj[field] = decodeValue(raw, allSchemas, dictionary);
    }

    items.push(obj);
  }

  return items;
}

/**
 * Split a row into individual values, respecting quoted strings and nested parens.
 */
export function splitRow(row: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let parenDepth = 0;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];

    if (ch === '"' && (i === 0 || row[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && ch === '(') {
      parenDepth++;
      current += ch;
    } else if (!inQuotes && ch === ')') {
      parenDepth--;
      current += ch;
    } else if (ch === ',' && !inQuotes && parenDepth === 0) {
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
 * Find a schema by its short name (not signature).
 */
function findSchemaByName(
  schemas: Map<string, SchemaDefinition>,
  name: string,
): SchemaDefinition | null {
  for (const [, schema] of schemas) {
    if (schema.name === name || schema.fullName === name) {
      return schema;
    }
  }
  return null;
}

export { findSchemaByName };
