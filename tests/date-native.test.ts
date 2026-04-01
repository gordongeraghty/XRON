import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index.js';

describe('XRON Native Date Support', () => {
  it('serializes and parses Date objects inside schema arrays accurately', () => {
    const data = [
      { id: 1, created: new Date('2023-01-01T12:00:00.000Z'), active: true },
      { id: 2, created: new Date('2023-01-02T15:30:00.000Z'), active: false },
      { id: 3, created: new Date('2023-01-03T18:45:00.000Z'), active: true },
    ];

    const encoded = XRON.stringify(data, { level: 2 });
    expect(encoded).toMatch(/@v2/);

    const decoded = XRON.parse(encoded);

    expect(decoded.length).toBe(3);
    expect(decoded[0].created).toBeInstanceOf(Date);
    expect(decoded[1].created).toBeInstanceOf(Date);
    
    expect(decoded[0].created.toISOString()).toBe('2023-01-01T12:00:00.000Z');
    expect(decoded[1].created.toISOString()).toBe('2023-01-02T15:30:00.000Z');
    expect(decoded[2].created.toISOString()).toBe('2023-01-03T18:45:00.000Z');
  });

  it('serializes inline Date objects sequentially', () => {
    const d = new Date('2024-05-15T08:00:00.000Z');
    const encodedTop = XRON.stringify(d, { level: 1 });
    const decodedTop = XRON.parse(encodedTop);
    
    expect(typeof decodedTop).toBe('string');
  });
});
