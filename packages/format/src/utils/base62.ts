/**
 * Base62 encoding utilities for compact representation of large values.
 */

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function encodeBase62(num: bigint): string {
  if (num === 0n) return '0';
  let result = '';
  const base = 62n;
  let n = num;
  while (n > 0n) {
    result = BASE62_CHARS[Number(n % base)] + result;
    n = n / base;
  }
  return result;
}

export function decodeBase62(str: string): bigint {
  let result = 0n;
  const base = 62n;
  for (const ch of str) {
    const idx = BASE62_CHARS.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base62 character: ${ch}`);
    result = result * base + BigInt(idx);
  }
  return result;
}
