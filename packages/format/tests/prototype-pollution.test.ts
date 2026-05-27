import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Prototype Pollution', () => {
  it('should not pollute prototype', () => {
    const malicious = `{"__proto__": {"polluted": true}}`;
    const result = parse(malicious);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('should not pollute prototype via constructor and prototype keys', () => {
    const maliciousJson = `{"constructor": {"prototype": {"pollutedConstructorJson": true}}}`;
    parse(maliciousJson);
    expect(({} as any).pollutedConstructorJson).toBeUndefined();

    const maliciousObj = `User(id,constructor)\n1|{"prototype": {"pollutedConstructorObj": true}}`;
    parse(maliciousObj);
    expect(({} as any).pollutedConstructorObj).toBeUndefined();
  });
});
