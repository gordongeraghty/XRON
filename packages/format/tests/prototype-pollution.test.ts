import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Prototype Pollution', () => {
  it('should not pollute prototype', () => {
    const malicious = `{"__proto__": {"polluted": true}}`;
    const result = parse(malicious);
    expect(({} as any).polluted).toBeUndefined();
  });
});
