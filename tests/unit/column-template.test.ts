import { describe, it, expect } from 'vitest';
import { detectColumnTemplates, applyColumnTemplates, expandColumnTemplates } from '../../src/pipeline/column-template.js';

describe('Column Template Detection', () => {
  it('detects email domain template', () => {
    const cells = [
      ['1', 'user1@example.com'],
      ['2', 'user2@example.com'],
      ['3', 'user3@example.com'],
    ];
    const templates = detectColumnTemplates(cells);
    expect(templates).toHaveLength(1);
    expect(templates[0].columnIndex).toBe(1);
    expect(templates[0].prefix).toBe('user');
    expect(templates[0].suffix).toBe('@example.com');
  });

  it('skips columns with dict refs', () => {
    const cells = [
      ['$0', 'alice'],
      ['$1', 'bob'],
    ];
    const templates = detectColumnTemplates(cells);
    // Column 0 has dict refs — should be skipped
    expect(templates.filter(t => t.columnIndex === 0)).toHaveLength(0);
  });

  it('skips columns where savings are too small', () => {
    const cells = [
      ['ab1', 'x'],
      ['ab2', 'y'],
    ];
    // prefix "ab" = 2 chars, no suffix, savings = 2/row which is < default minSavingsPerRow=4
    const templates = detectColumnTemplates(cells);
    expect(templates).toHaveLength(0);
  });

  it('handles prefix only (no suffix)', () => {
    const cells = [
      ['https://example.com/page1'],
      ['https://example.com/page2'],
      ['https://example.com/page3'],
    ];
    const templates = detectColumnTemplates(cells);
    expect(templates).toHaveLength(1);
    expect(templates[0].prefix).toBe('https://example.com/page');
    expect(templates[0].suffix).toBe('');
  });

  it('handles suffix only (no prefix)', () => {
    const cells = [
      ['file1.json'],
      ['file2.json'],
      ['file3.json'],
    ];
    const templates = detectColumnTemplates(cells);
    expect(templates).toHaveLength(1);
    expect(templates[0].prefix).toBe('file');
    expect(templates[0].suffix).toBe('.json');
  });

  it('returns empty for fewer than 2 rows', () => {
    const cells = [['user1@example.com']];
    const templates = detectColumnTemplates(cells);
    expect(templates).toHaveLength(0);
  });

  it('skips columns where all values are identical', () => {
    const cells = [
      ['same', 'a1'],
      ['same', 'a2'],
    ];
    const templates = detectColumnTemplates(cells);
    expect(templates.filter(t => t.columnIndex === 0)).toHaveLength(0);
  });
});

describe('Column Template Application', () => {
  it('strips prefix and suffix correctly', () => {
    const cells = [['user1@example.com'], ['user2@example.com']];
    const templates = [{ columnIndex: 0, prefix: 'user', suffix: '@example.com' }];
    const result = applyColumnTemplates(cells, templates);
    expect(result).toEqual([['1'], ['2']]);
  });

  it('returns input unchanged when no templates', () => {
    const cells = [['a', 'b'], ['c', 'd']];
    const result = applyColumnTemplates(cells, []);
    expect(result).toEqual(cells);
  });
});

describe('Column Template Expansion', () => {
  it('re-adds prefix and suffix correctly', () => {
    const cells = [['1'], ['2']];
    const templates = [{ columnIndex: 0, prefix: 'user', suffix: '@example.com' }];
    const result = expandColumnTemplates(cells, templates);
    expect(result).toEqual([['user1@example.com'], ['user2@example.com']]);
  });

  it('returns input unchanged when no templates', () => {
    const cells = [['a'], ['b']];
    const result = expandColumnTemplates(cells, []);
    expect(result).toEqual(cells);
  });
});
