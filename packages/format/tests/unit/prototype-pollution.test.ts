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
  it('should ignore __proto__ in positional rows (layer 2)', () => {
    const payload = `XRON:0.1
users:
  @S A: __proto__, value
  @N2 A
  {"polluted": "yes"}, 123`;
    const result = XRON.parse(payload) as any;
    expect(({} as any).polluted).toBeUndefined();
  });

  it('should ignore __proto__ in nested positional rows (layer 2)', () => {
    const payload = `XRON:0.1
users:
  @S B: __proto__, value
  @S A: nested, value
  @N2 A
  B({"polluted": "yes"}, 123), 456`;
    const result = XRON.parse(payload) as any;
    expect(({} as any).polluted).toBeUndefined();
  });

});
