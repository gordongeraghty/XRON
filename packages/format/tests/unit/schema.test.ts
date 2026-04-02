import { describe, it, expect } from 'vitest';
import { extractSchemas, matchSchema } from '../../src/pipeline/schema.js';

describe('Schema Extraction', () => {
  it('extracts schema from array of uniform objects', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const schemas = extractSchemas(data);
    expect(schemas.size).toBe(1);

    const schema = [...schemas.values()][0];
    expect(schema.fields).toEqual(['id', 'name']);
    expect(schema.frequency).toBe(2);
  });

  it('does NOT create schema for single-occurrence objects', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { x: 10, y: 20 },
    ];
    const schemas = extractSchemas(data);
    // Neither shape appears twice
    expect(schemas.size).toBe(0);
  });

  it('does NOT create schema for single-property objects', () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const schemas = extractSchemas(data);
    expect(schemas.size).toBe(0);
  });

  it('handles multiple schema shapes', () => {
    const data = {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      products: [
        { sku: 'A1', price: 10 },
        { sku: 'B2', price: 20 },
      ],
    };
    const schemas = extractSchemas(data);
    expect(schemas.size).toBe(2);
  });

  it('detects nested schemas', () => {
    const data = [
      { id: 1, addr: { street: 'A', city: 'B' } },
      { id: 2, addr: { street: 'C', city: 'D' } },
    ];
    const schemas = extractSchemas(data);
    expect(schemas.size).toBe(2); // parent + nested
  });

  it('matches objects to schemas', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const schemas = extractSchemas(data);
    const match = matchSchema({ id: 3, name: 'Carol' }, schemas);
    expect(match).not.toBeNull();
    expect(match!.fields).toEqual(['id', 'name']);
  });

  it('detects boolean field types', () => {
    const data = [
      { id: 1, active: true },
      { id: 2, active: false },
    ];
    const schemas = extractSchemas(data);
    const schema = [...schemas.values()][0];
    const activeIdx = schema.fields.indexOf('active');
    expect(schema.fieldTypes.get(activeIdx)).toBe('boolean');
  });

  it('handles deeply nested data without infinite recursion', () => {
    const deep: any = { a: 1, b: 2 };
    let current = deep;
    for (let i = 0; i < 100; i++) {
      current.child = { a: 1, b: 2, level: i };
      current = current.child;
    }
    // Should not throw
    const schemas = extractSchemas(deep);
    expect(schemas.size).toBeGreaterThan(0);
  });
});
