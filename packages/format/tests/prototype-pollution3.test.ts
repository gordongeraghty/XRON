import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Prototype Pollution', () => {
  it('should not pollute prototype with constructor.prototype bypass', () => {
    const malicious = `
constructor:
  prototype:
    polluted4: true
    `;
    parse(malicious);
    expect(({} as any).polluted4).toBeUndefined();
  });

  it('should block prototype key completely to avoid potential deep nested edge cases', () => {
    const malicious = `
prototype:
  polluted5: true
    `;
    parse(malicious);
    expect(({} as any).polluted5).toBeUndefined();
  });
});
