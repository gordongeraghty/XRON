/**
 * XRON Serialization Engine
 *
 * Orchestrates the 6-layer compression pipeline:
 * L1: Schema extraction → L2: Positional streaming → L3: Dictionary encoding
 * L4: Type-aware encoding → L5: Delta compression → L6: Tokenizer alignment
 */

import {
  XronOptions,
  XronLevel,
  SchemaDefinition,
  DictionaryEntry,
  DEFAULT_OPTIONS,
} from './types.js';
import { assessData } from './pipeline/adaptive.js';
import { extractSchemas, matchSchema } from './pipeline/schema.js';
import { encodePositionalRows, splitRow } from './pipeline/positional.js';
import { buildDictionary, createDictLookup } from './pipeline/dictionary.js';
import { encodeTypedValue, compactDate } from './pipeline/type-encoding.js';
import {
  analyzeDeltaColumns,
  applyDeltaEncoding,
  applyRepeatEncoding,
} from './pipeline/delta.js';
import {
  formatVersionHeader,
  formatChecksumHeader,
  formatSchemaHeader,
  formatDictHeader,
  formatCardinalityHeader,
  formatAnonymousArrayHeader,
  formatTemplateHeader,
  formatSubstringDictHeader,
} from './format/header.js';
import { crc32Hex } from './utils/crc32.js';
import { escapeValue } from './format/escape.js';
import { getSeparatorConfig, getFieldSep } from './pipeline/tokenizer-opt.js';
import {
  ColumnTemplate,
  detectColumnTemplates,
  applyColumnTemplates,
} from './pipeline/column-template.js';
import {
  SubstringEntry,
  buildSubstringDictionary,
  applySubstringRefs,
} from './pipeline/substring-dict.js';

/**
 * Recursively check whether a value contains any BigInt leaves.
 * Used by auto mode to avoid JSON fallback (which loses BigInt type info).
 */
function containsBigInt(value: any): boolean {
  if (typeof value === 'bigint') return true;
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsBigInt);
  return Object.values(value).some(containsBigInt);
}

/**
 * Pre-check for circular references before any processing.
 */
function checkCircular(value: any, seen: WeakSet<object>, depth: number, maxDepth: number): void {
  if (depth > maxDepth) throw new TypeError('Maximum serialization depth exceeded');
  if (value === null || value === undefined || typeof value !== 'object') return;
  if (seen.has(value)) throw new TypeError('Circular reference detected');
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) checkCircular(item, seen, depth + 1, maxDepth);
  } else {
    for (const key of Object.keys(value)) checkCircular(value[key], seen, depth + 1, maxDepth);
  }
  seen.delete(value);
}

/**
 * Serialize any JavaScript value to XRON format.
 *
 * When `options.level` is `'auto'`, the function analyses the data
 * characteristics first and selects the most efficient compression level.
 * If the payload is below `options.minCompressSize` bytes, the raw
 * JSON string is returned instead (no XRON overhead on tiny payloads).
 */
export function stringify(value: any, options?: XronOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ── Adaptive level selection ─────────────────────────────────────────────
  // Auto mode tries ALL levels and picks whichever produces the smallest output.
  // This guarantees auto never recommends L3 when L2 is actually smaller.
  const isAuto = opts.level === 'auto';
  if (isAuto) {
    // Return primitives directly
    if (value === null || value === undefined || typeof value !== 'object') {
      return stringify(value, { ...opts, level: 1 });
    }

    // JSON.stringify loses BigInt type info, so only use it as a candidate
    // when the data contains no BigInts (preserving losslessness).
    const hasBigInt = containsBigInt(value);
    const jsonStr = hasBigInt
      ? null
      : JSON.stringify(value);

    // Try all XRON levels and pick the shortest output
    let bestOutput: string | null = jsonStr;
    for (const lvl of [1, 2, 3] as const) {
      try {
        const candidate = stringify(value, { ...opts, level: lvl });
        if (bestOutput === null || candidate.length < bestOutput.length) {
          bestOutput = candidate;
        }
      } catch {
        // If a level fails, skip it
      }
    }
    // Never-Worse Guarantee: return raw JSON if no XRON level beats it
    return bestOutput!;
  }

  const level = opts.level as XronLevel;

  // Handle primitives — standalone primitives always use unambiguous encoding
  // (compact boolean 1/0 only used inside schema rows where type hints exist)
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return escapeValue(value);
  if (value instanceof Date) return escapeValue(compactDate(value.toISOString()));
  if (typeof value === 'bigint') return String(value);

  // Detect circular references early
  const seen = new WeakSet();
  checkCircular(value, new WeakSet(), 0, opts.maxDepth);

  // Extract schemas from the data
  const schemas = extractSchemas(value);

  // Build dictionary (Level 2+)
  let dictEntries: DictionaryEntry[] = [];
  let dictLookup = new Map<string, string>();
  if (level >= 2) {
    dictEntries = buildDictionary(value, {
      maxSize: opts.maxDictSize,
      minLength: opts.minDictValueLength,
      minFrequency: opts.minDictFrequency,
    });
    dictLookup = createDictLookup(dictEntries);
  }

  const sepConfig = getSeparatorConfig(opts.tokenizer);
  const lines: string[] = [];

  // Write version header
  lines.push(formatVersionHeader(level));

  // Write schema definitions
  for (const [, schema] of schemas) {
    lines.push(formatSchemaHeader(schema, level));
  }

  // Write dictionary (Level 2+)
  if (level >= 2 && dictEntries.length > 0) {
    lines.push(formatDictHeader(dictEntries.map(e => e.value)));
  }

  // Encode the data
  const dataLines = encodeData(value, schemas, dictLookup, level, opts, seen, 0);
  lines.push(...dataLines);

  // Build output without checksum, then insert @C after the version header
  const payload = lines.join(sepConfig.rowSep);
  const checksum = crc32Hex(payload);
  // Insert @C line after @v line (first line)
  const firstNewline = payload.indexOf('\n');
  if (firstNewline === -1) {
    // Single-line output (unlikely for non-primitives) — append checksum
    return payload + sepConfig.rowSep + formatChecksumHeader(checksum);
  }
  const withChecksum =
    payload.slice(0, firstNewline) +
    sepConfig.rowSep +
    formatChecksumHeader(checksum) +
    payload.slice(firstNewline);
  return withChecksum;
}

/**
 * Recursively encode data values.
 */
function encodeData(
  value: any,
  schemas: Map<string, SchemaDefinition>,
  dictLookup: Map<string, string>,
  level: XronLevel,
  opts: Required<XronOptions>,
  seen: WeakSet<object>,
  depth: number,
): string[] {
  if (value === null || value === undefined) {
    return [encodeTypedValue(value, level)];
  }

  if (typeof value !== 'object') {
    return [encodePrimitive(value, level, dictLookup)];
  }

  if (value instanceof Date) {
    return [encodePrimitive(compactDate(value.toISOString()), level, dictLookup)];
  }

  // Circular reference detection
  if (seen.has(value)) {
    throw new TypeError('Circular reference detected');
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return encodeArray(value, schemas, dictLookup, level, opts, seen, depth);
    }
    return encodeObject(value, schemas, dictLookup, level, opts, seen, depth);
  } finally {
    seen.delete(value);
  }
}

/**
 * Encode an array value.
 * If all items share the same schema → positional streaming with cardinality guard.
 * If all items are arrays of the same length → anonymous 2D array encoding.
 * Otherwise → inline encoding.
 */
function encodeArray(
  arr: any[],
  schemas: Map<string, SchemaDefinition>,
  dictLookup: Map<string, string>,
  level: XronLevel,
  opts: Required<XronOptions>,
  seen: WeakSet<object>,
  depth: number,
): string[] {
  if (arr.length === 0) return ['[]'];

  // Check if all items are objects matching the same schema
  const firstSchema = arr[0] && typeof arr[0] === 'object' && !Array.isArray(arr[0])
    ? matchSchema(arr[0], schemas)
    : null;

  if (firstSchema && arr.every(item =>
    item && typeof item === 'object' && !Array.isArray(item) &&
    matchSchema(item, schemas)?.signature === firstSchema.signature
  )) {
    const fieldSep = getFieldSep(level, opts.tokenizer);
    return encodeSchemaArray(arr, firstSchema, schemas, dictLookup, level, opts, seen, fieldSep);
  }

  // Check for 2D array: all items are arrays of the same length
  if (Array.isArray(arr[0]) && arr[0].length > 0) {
    const colCount = arr[0].length;
    const isUniform2D = arr.every(
      item => Array.isArray(item) && item.length === colCount
    );

    if (isUniform2D && arr.length >= 2) {
      return encode2DArray(arr, colCount, dictLookup, level, opts, seen);
    }
  }

  // Mixed or non-schema array — encode as JSON-like inline
  const items: string[] = [];
  for (const item of arr) {
    items.push(encodeInlineValue(item, level, dictLookup, seen));
  }
  return [`[${items.join(', ')}]`];
}

/**
 * Encode a uniform 2D array (array of same-length arrays) using anonymous positional streaming.
 */
function encode2DArray(
  arr: any[][],
  colCount: number,
  dictLookup: Map<string, string>,
  level: XronLevel,
  opts: Required<XronOptions>,
  seen: WeakSet<object>,
): string[] {
  const fieldSep = getFieldSep(level, opts.tokenizer);
  const lines: string[] = [];

  // Encode each inner array as a row of values
  // Use encodeInlineValue for non-primitives (objects, arrays) to preserve structure
  const rows: string[][] = arr.map(innerArr =>
    innerArr.map(val => {
      if (val !== null && typeof val === 'object') {
        return encodeInlineValue(val, level, dictLookup, seen);
      }
      return encodePrimitive(val, level, dictLookup);
    })
  );

  // Apply dictionary-based compression at Level 2+
  if (level >= 2 && rows.length >= 2) {
    // Apply repeat encoding (same-as-previous ~)
    let compressed = rows;
    if (level >= 3) {
      // Skip delta for now on anonymous arrays — no schema type hints
      compressed = applyRepeatEncoding(compressed, []);
    }

    lines.push(formatAnonymousArrayHeader(arr.length, colCount));
    for (const row of compressed) {
      lines.push(row.join(fieldSep));
    }
  } else {
    lines.push(formatAnonymousArrayHeader(arr.length, colCount));
    for (const row of rows) {
      lines.push(row.join(fieldSep));
    }
  }

  return lines;
}

/**
 * Encode an array of uniform objects using positional streaming.
 */
function encodeSchemaArray(
  arr: any[],
  schema: SchemaDefinition,
  schemas: Map<string, SchemaDefinition>,
  dictLookup: Map<string, string>,
  level: XronLevel,
  opts: Required<XronOptions>,
  seen: WeakSet<object>,
  fieldSep: string = ', ',
): string[] {
  const schemaName = level >= 2 ? schema.name : schema.fullName;
  const lines: string[] = [];

  // Encode values positionally — use encodePrimitive for simple values,
  // encodeInlineValue for arrays/objects that aren't nested schemas
  const valueEncoder = (val: any, allSchemas: Map<string, SchemaDefinition>): string => {
    if (val !== null && typeof val === 'object') {
      return encodeInlineValue(val, level, dictLookup, seen);
    }
    return encodePrimitive(val, level, dictLookup);
  };

  const rows = encodePositionalRows(arr, schema, schemas, valueEncoder, level, fieldSep);

  // Compression Pipeline
  if (level >= 2 && rows.length >= 2) {
    let parsed2D = rows.map(row => splitRow(row));

    // 1. Delta & Repeat Encoding (Level 3)
    let deltaColumnsInfo = [] as any[];
    if (level >= 3 && rows.length >= opts.deltaThreshold) {
      const rawRows = arr.map(item => schema.fields.map(f => item[f]));
      deltaColumnsInfo = analyzeDeltaColumns(rawRows, schema, opts.deltaThreshold);
      parsed2D = applyDeltaEncoding(parsed2D, deltaColumnsInfo);
      parsed2D = applyRepeatEncoding(parsed2D, deltaColumnsInfo);
    }

    // 2. Column Templates (Level 2+)
    const templates = detectColumnTemplates(parsed2D);
    if (templates.length > 0) {
      for (const tmpl of templates) {
        lines.push(formatTemplateHeader(tmpl));
      }
      parsed2D = applyColumnTemplates(parsed2D, templates);
    }

    // 3. Substring Dictionary Compression (Level 3)
    if (level >= 3) {
      const substringEntries = buildSubstringDictionary(parsed2D);
      if (substringEntries.length > 0) {
        lines.push(formatSubstringDictHeader(substringEntries.map(e => e.value)));
        parsed2D = applySubstringRefs(parsed2D, substringEntries);
      }
    }

    // Cardinality guard
    lines.push(formatCardinalityHeader(arr.length, schemaName));

    // Rejoin rows
    for (const row of parsed2D) {
      lines.push(row.join(fieldSep));
    }
  } else {
    // Cardinality guard
    lines.push(formatCardinalityHeader(arr.length, schemaName));
    lines.push(...rows);
  }

  return lines;
}

/**
 * Encode a standalone object.
 * If it matches a schema → use schema reference notation.
 * Otherwise → key-value pairs with indentation.
 */
function encodeObject(
  obj: Record<string, any>,
  schemas: Map<string, SchemaDefinition>,
  dictLookup: Map<string, string>,
  level: XronLevel,
  opts: Required<XronOptions>,
  seen: WeakSet<object>,
  depth: number,
): string[] {
  const schema = matchSchema(obj, schemas);
  const indent = ' '.repeat(depth * opts.indent);

  if (schema) {
    // Schema-referenced standalone object: SchemaName(val1, val2, ...)
    const schemaName = level >= 2 ? schema.name : schema.fullName;
    const values = schema.fields.map(f => encodePrimitive(obj[f], level, dictLookup));
    return [`${indent}${schemaName}(${values.join(', ')})`];
  }

  // No schema match — use inline {key: val, key: val} format.
  // encodeData already added `obj` to `seen`; remove it so encodeInlineValue
  // can add it during its own subtree traversal (preventing false-positive).
  seen.delete(obj);
  return [encodeInlineValue(obj, level, dictLookup, seen)];
}

/**
 * Encode a primitive value, applying dictionary lookup and type encoding.
 */
function encodePrimitive(
  value: any,
  level: XronLevel,
  dictLookup: Map<string, string>,
): string {
  // Dictionary lookup (Level 2+)
  if (level >= 2 && typeof value === 'string') {
    const dictRef = dictLookup.get(value);
    if (dictRef) return dictRef;
  }

  return encodeTypedValue(value, level);
}

/**
 * Encode any value as a single inline string (for mixed arrays, etc.).
 * Objects become JSON-like {key: val, ...} on one line.
 *
 * NOTE: Booleans are always encoded as `true`/`false` here, never as `1`/`0`,
 * because the inline decoder has no schema field-type hints to recover them.
 */
function encodeInlineValue(
  value: any,
  level: XronLevel,
  dictLookup: Map<string, string>,
  seen: WeakSet<object>,
): string {
  if (value === null || value === undefined) return level >= 2 ? '-' : 'null';
  // Always use true/false for booleans in inline encoding — no type-hint available on decode.
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value !== 'object') return encodePrimitive(value, level, dictLookup);
  if (value instanceof Date) return encodePrimitive(compactDate(value.toISOString()), level, dictLookup);

  if (seen.has(value)) throw new TypeError('Circular reference detected');
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      const items = value.map(v => encodeInlineValue(v, level, dictLookup, seen));
      return `[${items.join(', ')}]`;
    }

    // Object — encode as {key: val, key: val}
    const pairs: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      pairs.push(`${escapeValue(k)}: ${encodeInlineValue(v, level, dictLookup, seen)}`);
    }
    return `{${pairs.join(', ')}}`;
  } finally {
    seen.delete(value);
  }
}

export async function* stringifyStream(value: any, options?: XronOptions): AsyncIterable<string> {
  const result = stringify(value, options);
  const lines = result.split('\n');
  for (let i = 0; i < lines.length; i++) {
    yield lines[i] + (i < lines.length - 1 ? '\n' : '');
  }
}
