import { describe, it, expect } from 'vitest';
import { crc32, crc32Hex } from '../../src/utils/crc32.js';

describe('crc32', () => {
  it('returns 0x00000000 for an empty string', () => {
    expect(crc32('')).toBe(0x00000000);
  });

  it('returns the known CRC32 value for "hello"', () => {
    expect(crc32('hello')).toBe(0x3610a686);
  });

  it('handles multi-byte UTF-8 characters', () => {
    const result = crc32('über');
    expect(result).toBeTypeOf('number');
    expect(result >>> 0).toBe(result); // unsigned 32-bit integer
  });

  it('handles emoji / surrogate pairs', () => {
    const result = crc32('hello 🌍');
    expect(result).toBeTypeOf('number');
    expect(result >>> 0).toBe(result);
  });

  it('is consistent across repeated calls', () => {
    const a = crc32('deterministic');
    const b = crc32('deterministic');
    expect(a).toBe(b);
  });
});

describe('crc32Hex', () => {
  it('returns an 8-character lowercase hex string', () => {
    const hex = crc32Hex('hello');
    expect(hex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('zero-pads the result for empty string', () => {
    expect(crc32Hex('')).toBe('00000000');
  });

  it('matches the numeric crc32 output', () => {
    const num = crc32('hello');
    const hex = crc32Hex('hello');
    expect(parseInt(hex, 16)).toBe(num);
  });
});
