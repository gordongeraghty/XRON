import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';

describe('Prototype Pollution Prevention', () => {
  it('should ignore prototype in schema rows', () => {
    const payload = `
@v 1
@S A: __proto__,prototype,constructor,foo
@N1 A
1,2,3,bar
`;
    const result = parse(payload) as any;
    expect(result[0].prototype).toBeUndefined();
    expect(result[0].foo).toBe('bar');
  });
});
