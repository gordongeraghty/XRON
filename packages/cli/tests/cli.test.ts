import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TMP = resolve(__dirname, '..', '.tmp-test');
const CLI = resolve(__dirname, '..', 'src', 'index.ts');

function run(...args: string[]): string {
  return execSync(`npx tsx "${CLI}" ${args.map(a => `"${a}"`).join(' ')}`, {
    encoding: 'utf-8',
    cwd: TMP,
    timeout: 15000,
  });
}

const SAMPLE_DATA = [
  { id: 1, name: 'Alice', role: 'admin', active: true },
  { id: 2, name: 'Bob', role: 'user', active: true },
  { id: 3, name: 'Carol', role: 'user', active: false },
  { id: 4, name: 'Dave', role: 'admin', active: true },
];

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, 'sample.json'), JSON.stringify(SAMPLE_DATA, null, 2));
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('xron-cli', () => {
  // 1. Help output
  it('shows help with --help', () => {
    const out = run('--help');
    expect(out).toContain('xron-cli');
    expect(out).toContain('compress');
    expect(out).toContain('decompress');
    expect(out).toContain('analyze');
  });

  // 2. Compress outputs XRON starting with @v
  it('compresses JSON to XRON format', () => {
    const file = join(TMP, 'sample.json');
    const out = run('compress', file);
    expect(out.trim().startsWith('@v')).toBe(true);
  });

  // 3. Compress with --output writes to file
  it('compresses to a file with -o flag', () => {
    const inFile = join(TMP, 'sample.json');
    const outFile = join(TMP, 'sample.xron');
    run('compress', inFile, '-o', outFile);
    const content = readFileSync(outFile, 'utf-8');
    expect(content.trim().startsWith('@v')).toBe(true);
  });

  // 4. Decompress XRON back to JSON
  it('decompresses XRON back to JSON', () => {
    const inFile = join(TMP, 'sample.json');
    const xronFile = join(TMP, 'dec.xron');
    run('compress', inFile, '-o', xronFile);
    const out = run('decompress', xronFile);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(4);
  });

  // 5. Round-trip: compress then decompress equals original
  it('round-trips losslessly', () => {
    const inFile = join(TMP, 'sample.json');
    const xronFile = join(TMP, 'rt.xron');
    const jsonFile = join(TMP, 'rt.json');
    run('compress', inFile, '-o', xronFile);
    run('decompress', xronFile, '-o', jsonFile);
    const restored = JSON.parse(readFileSync(jsonFile, 'utf-8'));
    expect(restored).toEqual(SAMPLE_DATA);
  });

  // 6. Analyze returns valid metrics
  it('shows compression metrics with analyze', () => {
    const file = join(TMP, 'sample.json');
    const out = run('analyze', file);
    expect(out).toContain('JSON size:');
    expect(out).toContain('XRON size:');
    expect(out).toContain('Token reduction:');
    expect(out).toContain('Breakdown:');
  });

  // 7. Handles single object (non-array) JSON
  it('compresses single-object JSON', () => {
    const file = join(TMP, 'single.json');
    writeFileSync(file, JSON.stringify({ key: 'value', num: 42 }));
    const out = run('compress', file);
    expect(out.length).toBeGreaterThan(0);
    // Round-trip
    const xronFile = join(TMP, 'single.xron');
    writeFileSync(xronFile, out);
    const restored = run('decompress', xronFile);
    expect(JSON.parse(restored)).toEqual({ key: 'value', num: 42 });
  });

  // 8. Errors on missing file argument
  it('errors when no file argument given', () => {
    expect(() => run('compress')).toThrow();
  });

  // 9. Errors on unknown command
  it('errors on unknown command', () => {
    expect(() => run('foobar', join(TMP, 'sample.json'))).toThrow();
  });
});
