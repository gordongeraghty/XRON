/**
 * Layer 1: Schema Extraction
 *
 * Traverses data to detect repeated object shapes, generating schema definitions
 * that eliminate repeated property key tokens. Converts O(N×K) key overhead → O(1).
 */

import { SchemaDefinition } from '../types.js';
import { ClassNameGenerator } from '../utils/class-names.js';

/**
 * Internal tracker for object shape frequency analysis.
 */
interface ShapeInfo {
  signature: string;
  keys: string[];
  frequency: number;
  samplePath: string;
}

/**
 * Extract schemas from data. Returns a Map of signature → SchemaDefinition.
 * Only creates schemas for objects with 2+ properties appearing 2+ times.
 */
export function extractSchemas(data: any): Map<string, SchemaDefinition> {
  const shapeMap = new Map<string, ShapeInfo>();

  // Phase 1: DFS to discover all object shapes and their frequencies
  collectShapes(data, shapeMap, '');

  // Phase 2: Filter — only shapes with 1+ properties appearing 2+ times
  const qualifying = new Map<string, ShapeInfo>();
  for (const [sig, info] of shapeMap) {
    if (info.keys.length >= 1 && info.frequency >= 2) {
      qualifying.set(sig, info);
    }
  }

  // Phase 3: Sort by frequency (most common first) then by key count (larger first)
  const sorted = [...qualifying.entries()].sort((a, b) => {
    const freqDiff = b[1].frequency - a[1].frequency;
    if (freqDiff !== 0) return freqDiff;
    return b[1].keys.length - a[1].keys.length;
  });

  // Phase 4: Assign schema names
  const nameGen = new ClassNameGenerator();
  const schemas = new Map<string, SchemaDefinition>();

  for (const [sig, info] of sorted) {
    const name = nameGen.next();
    schemas.set(sig, {
      name,
      fullName: guessFullName(info.samplePath, info.keys),
      fields: info.keys,
      signature: sig,
      frequency: info.frequency,
      nestedSchemas: new Map(),
      fieldTypes: new Map(),
    });
  }

  // Phase 5: Detect nested schema relationships
  resolveNestedSchemas(data, schemas);

  // Phase 6: Detect field types for lossless round-tripping
  detectFieldTypes(data, schemas);

  return schemas;
}

/**
 * DFS to collect all object shapes in the data. Circular-safe.
 */
function collectShapes(
  value: any,
  shapes: Map<string, ShapeInfo>,
  path: string,
  seen?: WeakSet<object>,
): void {
  if (value === null || value === undefined) return;
  if (typeof value !== 'object') return;

  const seenSet = seen ?? new WeakSet();
  if (seenSet.has(value)) return; // circular — skip silently
  seenSet.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectShapes(value[i], shapes, `${path}[${i}]`, seenSet);
    }
    return;
  }

  const keys = Object.keys(value);
  if (keys.length >= 1) {
    const signature = keys.slice().sort().join(',');
    const existing = shapes.get(signature);
    if (existing) {
      existing.frequency++;
    } else {
      shapes.set(signature, {
        signature,
        keys, // preserve original insertion order
        frequency: 1,
        samplePath: path,
      });
    }
  }

  // Recurse into values
  for (const key of keys) {
    collectShapes(value[key], shapes, `${path}.${key}`, seenSet);
  }
}

/**
 * Detect the predominant type for each field in each schema.
 * Used for lossless boolean round-tripping (1/0 → true/false at Level 2+).
 */
function detectFieldTypes(
  data: any,
  schemas: Map<string, SchemaDefinition>,
): void {
  for (const [, schema] of schemas) {
    const instances = findInstances(data, schema.signature);
    if (instances.length === 0) continue;

    for (let fieldIdx = 0; fieldIdx < schema.fields.length; fieldIdx++) {
      const fieldName = schema.fields[fieldIdx];
      const types = new Set<string>();

      for (const instance of instances) {
        const val = instance[fieldName];
        if (val === null || val === undefined) {
          types.add('null');
        } else if (val instanceof Date) {
          types.add('date');
        } else if (typeof val === 'bigint') {
          types.add('bigint');
        } else {
          types.add(typeof val);
        }
      }

      if (types.size === 1) {
        const t = [...types][0];
        if (t === 'boolean') schema.fieldTypes.set(fieldIdx, 'boolean');
        else if (t === 'number') schema.fieldTypes.set(fieldIdx, 'number');
        else if (t === 'string') schema.fieldTypes.set(fieldIdx, 'string');
        else if (t === 'null') schema.fieldTypes.set(fieldIdx, 'null');
        else if (t === 'date') schema.fieldTypes.set(fieldIdx, 'date');
        else if (t === 'bigint') schema.fieldTypes.set(fieldIdx, 'bigint');
      } else if (types.has('boolean') && types.size <= 2) {
        // boolean + null → still boolean
        schema.fieldTypes.set(fieldIdx, 'boolean');
      } else if (types.has('bigint') && !types.has('string') && !types.has('boolean') && !types.has('date')) {
        // bigint (+ null or + number) → promote to bigint
        schema.fieldTypes.set(fieldIdx, 'bigint');
      } else {
        schema.fieldTypes.set(fieldIdx, 'mixed');
      }
    }
  }
}

/**
 * Try to guess a meaningful full name for the schema based on path context.
 * Falls back to generic names like "Item", "Record", etc.
 */
function guessFullName(samplePath: string, keys: string[]): string {
  // Try to extract from array parent path: e.g., ".users[0]" → "User"
  const arrayMatch = samplePath.match(/\.(\w+)\[\d+\]$/);
  if (arrayMatch) {
    const plural = arrayMatch[1];
    // Simple depluralize: remove trailing 's'
    const singular = plural.endsWith('s') ? plural.slice(0, -1) : plural;
    return capitalize(singular);
  }

  // Try direct property name
  const dotMatch = samplePath.match(/\.(\w+)$/);
  if (dotMatch) {
    return capitalize(dotMatch[1]);
  }

  // Fallback based on key patterns
  if (keys.includes('id') && keys.includes('name')) return 'Entity';
  if (keys.includes('lat') && keys.includes('lng')) return 'Location';
  if (keys.includes('street') && keys.includes('city')) return 'Address';
  if (keys.includes('width') && keys.includes('height')) return 'Size';

  return 'Item';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Second pass: detect which fields in a schema contain values
 * matching another schema, establishing nesting relationships.
 */
function resolveNestedSchemas(
  data: any,
  schemas: Map<string, SchemaDefinition>,
): void {
  // Build reverse lookup: signature → schema name
  const sigToSchema = new Map<string, string>();
  for (const [sig, schema] of schemas) {
    sigToSchema.set(sig, schema.name);
  }

  // For each schema, check if any field values consistently match another schema
  for (const [, schema] of schemas) {
    const instances = findInstances(data, schema.signature);
    if (instances.length === 0) continue;

    for (let fieldIdx = 0; fieldIdx < schema.fields.length; fieldIdx++) {
      const fieldName = schema.fields[fieldIdx];
      let matchedSchema: string | null = null;
      let allMatch = true;

      for (const instance of instances) {
        const fieldValue = instance[fieldName];
        if (fieldValue !== null && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          const nestedKeys = Object.keys(fieldValue);
          if (nestedKeys.length >= 1) {
            const nestedSig = nestedKeys.slice().sort().join(',');
            const nestedSchemaName = sigToSchema.get(nestedSig);
            if (nestedSchemaName) {
              if (matchedSchema === null) {
                matchedSchema = nestedSchemaName;
              } else if (matchedSchema !== nestedSchemaName) {
                allMatch = false;
                break;
              }
            } else {
              allMatch = false;
              break;
            }
          } else {
            allMatch = false;
            break;
          }
        } else {
          allMatch = false;
          break;
        }
      }

      if (allMatch && matchedSchema !== null) {
        schema.nestedSchemas.set(fieldIdx, matchedSchema);
      }
    }
  }
}

/**
 * Find all object instances in data that match a given signature.
 */
function findInstances(data: any, signature: string): any[] {
  const instances: any[] = [];
  collectInstances(data, signature, instances);
  return instances;
}

function collectInstances(value: any, signature: string, results: any[]): void {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectInstances(item, signature, results);
    }
    return;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length >= 1) {
      const sig = keys.slice().sort().join(',');
      if (sig === signature) {
        results.push(value);
      }
    }
    for (const key of keys) {
      collectInstances(value[key], signature, results);
    }
  }
}

/**
 * Look up which schema (if any) matches a given object.
 * Returns the schema name or null.
 */
export function matchSchema(
  obj: Record<string, any>,
  schemas: Map<string, SchemaDefinition>,
): SchemaDefinition | null {
  const keys = Object.keys(obj);
  if (keys.length < 1) return null;
  const signature = keys.slice().sort().join(',');
  return schemas.get(signature) ?? null;
}
