import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index.js';

describe('XRON Native BigInt Support', () => {
  it('should round-trip Small BigInt values losslessly via Schema hints', () => {
    // Array to trigger schema hint '?i'
    const data = [
        { id: 10n, count: 1n },
        { id: 20n, count: 2n }
    ];
    const xron = XRON.stringify(data);
    
    // Header should contain ?i
    expect(xron).toContain('id?i');
    expect(xron).toContain('count?i');
    
    const parsed = XRON.parse(xron);
    expect(parsed[0].id).toBe(10n);
    expect(parsed[1].count).toBe(2n);
    expect(typeof parsed[0].id).toBe('bigint');
  });

  it('should round-trip Large BigInt literals losslessly even without schemas', () => {
    const data = { id: 12345678901234567890n };
    const xron = XRON.stringify(data);
    const parsed = XRON.parse(xron);
    expect(parsed.id).toBe(12345678901234567890n);
    expect(typeof parsed.id).toBe('bigint');
  });

  it('should support BigInt delta compression (Level 3)', () => {
    // Use several items to ensure schema-backed positional streaming
    const data = [
      { id: 10000000000000000000n, val: 'A' },
      { id: 10000000000000000001n, val: 'B' },
      { id: 10000000000000000002n, val: 'C' },
      { id: 10000000000000000003n, val: 'D' },
      { id: 10000000000000000004n, val: 'E' }
    ];
    
    const xron = XRON.stringify(data, { level: 3 });
    
    // Check for +1 notations in the data rows (sequential BigInts)
    expect(xron).toContain('+1');
    
    const parsed = XRON.parse(xron);
    expect(parsed).toEqual(data);
    expect(typeof parsed[0].id).toBe('bigint');
  });

  it('should handle negative BigInt deltas', () => {
    const data = [
        { id: 100n, key: 'k1' },
        { id: 95n, key: 'k2' },
        { id: 90n, key: 'k3' },
        { id: 85n, key: 'k4' },
        { id: 80n, key: 'k5' }
      ];
      
      const xron = XRON.stringify(data, { level: 3 });
      expect(xron).toContain('-5');
      
      const parsed = XRON.parse(xron);
      expect(parsed).toEqual(data);
      expect(typeof parsed[0].id).toBe('bigint');
  });

  it('should handle mixed Large Numbers and BigInts (promotion)', () => {
    const data = { 
        large: 9007199254740991n + 1n, // Safe limit + 1
        small: 42n 
    };
    const xron = XRON.stringify(data);
    const parsed = XRON.parse(xron);
    expect(parsed.large).toBe(9007199254740992n);
    expect(typeof parsed.large).toBe('bigint');
  });
});
