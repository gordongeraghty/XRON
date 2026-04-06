/**
 * CRC32 implementation — zero dependencies.
 *
 * Used for the @C integrity checksum header to detect truncation or corruption
 * of XRON payloads (e.g. LLM context window cut-off, copy-paste errors).
 */

// Pre-computed CRC32 lookup table (IEEE 802.3 / ITU-T V.42 polynomial)
const TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  TABLE[i] = crc;
}

/**
 * Compute CRC32 of a UTF-8 string.
 * Returns an unsigned 32-bit integer.
 */
export function crc32(input: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) {
      crc = (crc >>> 8) ^ TABLE[(crc ^ code) & 0xff];
    } else if (code < 0x800) {
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0xc0 | (code >> 6))) & 0xff];
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0x80 | (code & 0x3f))) & 0xff];
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Surrogate pair — decode to full code point
      const next = input.charCodeAt(++i);
      const cp = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0xf0 | (cp >> 18))) & 0xff];
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0x80 | ((cp >> 12) & 0x3f))) & 0xff];
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0x80 | ((cp >> 6) & 0x3f))) & 0xff];
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0x80 | (cp & 0x3f))) & 0xff];
    } else {
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0xe0 | (code >> 12))) & 0xff];
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0x80 | ((code >> 6) & 0x3f))) & 0xff];
      crc = (crc >>> 8) ^ TABLE[(crc ^ (0x80 | (code & 0x3f))) & 0xff];
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Format a CRC32 value as an 8-character lowercase hex string.
 */
export function crc32Hex(input: string): string {
  return crc32(input).toString(16).padStart(8, '0');
}
