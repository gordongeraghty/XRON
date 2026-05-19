import { describe, it, expect } from 'vitest';
import { XRON } from '../../src/index.js';
import { parse } from '../../src/parse.js';

describe('Prototype Pollution Prevention', () => {
  it('should ignore __proto__ in key-value blocks', () => {
    const payload = `__proto__:
  polluted: "yes"`;
    const result = XRON.parse(payload) as any;
    expect(({} as any).polluted).toBeUndefined();
  });

  it('should ignore __proto__ in inline objects', () => {
    const payload = `{__proto__: {polluted: "yes"}}`;
    const result = XRON.parse(payload) as any;
    expect(({} as any).polluted).toBeUndefined();
  });

  it('should not pollute prototype with constructor/prototype via XRON schemas', () => {
    const malicious = `@v1
Schema(a, constructor)
Schema(1, {prototype: {polluted: true}})
`;
    parse(malicious);
    expect(({} as any).polluted).toBeUndefined();
  });
});
