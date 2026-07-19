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

  it('should ignore __proto__ in positional rows', () => {
    const payload = `@S A: __proto__, val
@N2 A
{"polluted": "yes"}, 123`;
    const result = XRON.parse(payload) as any;
    expect(({} as any).polluted).toBeUndefined();
  });
});
