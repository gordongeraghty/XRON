import { describe, it, expect } from 'vitest';
import { XRON } from '../../src/index.js';

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

  it('should ignore __proto__ and prototype in positional rows', () => {
    const payload = `@S A: __proto__, prototype
@N2 A
{"polluted":"yes"}, {"polluted2":"yes"}`;
    const result = XRON.parse(payload) as any;
    expect(({} as any).polluted).toBeUndefined();
    expect(({} as any).polluted2).toBeUndefined();
  });

  it('should ignore __proto__ and prototype in nested schema positional rows', () => {
    const payload = `@S B: __proto__, prototype
@S A: nested(B)
@N2 A
B({"polluted":"yes"}, {"polluted2":"yes"})`;
    const result = XRON.parse(payload) as any;
    expect(({} as any).polluted).toBeUndefined();
    expect(({} as any).polluted2).toBeUndefined();
  });
});
