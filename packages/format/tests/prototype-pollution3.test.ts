import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Prototype Pollution Schema', () => {
  it('should not pollute prototype with constructor object', () => {
    const malicious = `SCHEMA MySchema constructor\nMySchema({ "prototype": { "polluted": true } })`;
    parse(malicious);
    expect(({} as any).polluted).toBeUndefined();
    expect(({} as any).constructor.prototype.polluted).toBeUndefined();
  });

  it('should not pollute prototype with prototype object', () => {
    const malicious = `SCHEMA MySchema prototype\nMySchema({ "polluted": true })`;
    parse(malicious);
    expect(({} as any).polluted).toBeUndefined();
    expect(({} as any).constructor.prototype.polluted).toBeUndefined();
  });
});
