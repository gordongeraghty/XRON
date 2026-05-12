import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Prototype Pollution Schema Bypass', () => {
  it('should not allow prototype field in schema rows to pollute prototype', () => {
    const malicious = `
@v 1
@S Object: prototype
@N1 Object
{"polluted":true}
`;
    const result = parse(malicious);
    expect((result as any)[0].prototype).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });

  it('should not allow prototype field in nested schema instance to pollute prototype', () => {
    const malicious = `
@v 1
@S Root: nested
@S Nested: prototype
@N1 Root
Nested({"polluted":true})
`;
    const result = parse(malicious);
    expect((result as any)[0].nested.prototype).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });
});
