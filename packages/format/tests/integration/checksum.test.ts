import { describe, it, expect, vi } from 'vitest';
import { XRON } from '../../src/index.js';

const data = [
  { id: 1, name: 'Alice', dept: 'Sales' },
  { id: 2, name: 'Bob', dept: 'Engineering' },
  { id: 3, name: 'Carol', dept: 'Sales' },
];

describe('checksum integration', () => {
  it('round-trips with checksum at level 2', () => {
    const encoded = XRON.stringify(data, { level: 2 });
    const decoded = XRON.parse(encoded);
    expect(decoded).toEqual(data);
  });

  it('includes a @C checksum header in stringified output', () => {
    const encoded = XRON.stringify(data, { level: 2 });
    const lines = encoded.split('\n');
    const checksumLine = lines.find((l: string) => l.startsWith('@C '));
    expect(checksumLine).toBeDefined();
  });

  it('places the checksum line as the second line (after @v)', () => {
    const encoded = XRON.stringify(data, { level: 2 });
    const lines = encoded.split('\n');
    expect(lines[0]).toMatch(/^@v\d$/);
    expect(lines[1]).toMatch(/^@C [0-9a-f]{8}$/);
  });

  it('warns on corrupted payload', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const encoded = XRON.stringify(data, { level: 2 });
    const corrupted = encoded.replace('Alice', 'Alicx');
    XRON.parse(corrupted);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns on truncated payload (last data line removed)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const encoded = XRON.stringify(data, { level: 2 });
    const lines = encoded.split('\n');
    // Remove the last non-empty data line
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    lines.pop();
    const truncated = lines.join('\n');
    XRON.parse(truncated);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('throws with strictValidation on corrupted payload', () => {
    const encoded = XRON.stringify(data, { level: 2 });
    const corrupted = encoded.replace('Alice', 'Alicx');

    expect(() => {
      XRON.parse(corrupted, { strictValidation: true });
    }).toThrow();
  });

  it('parses pre-0.3.0 data without @C line normally', () => {
    const encoded = XRON.stringify(data, { level: 2 });
    const lines = encoded.split('\n');
    // Remove the @C line
    const withoutChecksum = lines
      .filter((l: string) => !l.startsWith('@C '))
      .join('\n');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decoded = XRON.parse(withoutChecksum);
    expect(decoded).toEqual(data);
    // Should not warn when no checksum is present (legacy format)
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
