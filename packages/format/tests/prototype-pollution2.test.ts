import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Prototype Pollution', () => {
  it('should not pollute prototype with bracket object', () => {
    const malicious = `{__proto__: {polluted1: true}}`;
    parse(malicious);
    expect(({} as any).polluted1).toBeUndefined();
  });

  it('should not pollute prototype with inline bracket array', () => {
    const malicious = `[{__proto__: {polluted2: true}}]`;
    parse(malicious);
    expect(({} as any).polluted2).toBeUndefined();
  });

  it('should not pollute prototype with indent object', () => {
    const malicious = `
__proto__:
  polluted3: true
    `;
    parse(malicious);
    expect(({} as any).polluted3).toBeUndefined();
  });
});
