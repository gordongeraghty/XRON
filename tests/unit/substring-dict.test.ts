import { describe, it, expect } from 'vitest';
import { buildSubstringDictionary, applySubstringRefs, expandSubstringRefs, SubstringEntry } from '../../src/pipeline/substring-dict.js';

describe('Substring Dictionary Building', () => {
  it('finds repeated email domains', () => {
    const cells = [
      ['user1@example.com'],
      ['user2@example.com'],
      ['user3@example.com'],
    ];
    const dict = buildSubstringDictionary(cells, 6, 3);
    expect(dict.length).toBeGreaterThan(0);
    expect(dict.some(e => e.value.includes('example.com'))).toBe(true);
  });

  it('skips dict refs and delta values', () => {
    const cells = [
      ['$0', '+1'],
      ['$1', '+1'],
      ['$2', '+1'],
    ];
    const dict = buildSubstringDictionary(cells, 4, 3);
    expect(dict).toHaveLength(0);
  });

  it('respects minimum frequency', () => {
    const cells = [
      ['unique-value-abc'],
      ['different-value-xyz'],
    ];
    const dict = buildSubstringDictionary(cells, 4, 3);
    expect(dict).toHaveLength(0);
  });
});

describe('Substring Application and Expansion', () => {
  it('replaces and expands correctly', () => {
    const cells = [['user1@example.com'], ['user2@example.com']];
    const dict: SubstringEntry[] = [{ value: '@example.com', index: 0, frequency: 2 }];

    const applied = applySubstringRefs(cells, dict);
    expect(applied[0][0]).toBe('user1%0;');
    expect(applied[1][0]).toBe('user2%0;');

    const expanded = expandSubstringRefs(applied, dict);
    expect(expanded[0][0]).toBe('user1@example.com');
    expect(expanded[1][0]).toBe('user2@example.com');
  });

  it('skips special values during application', () => {
    const cells = [['$0'], ['~'], ['-'], ['+5']];
    const dict: SubstringEntry[] = [{ value: 'test', index: 0, frequency: 3 }];

    const applied = applySubstringRefs(cells, dict);
    expect(applied[0][0]).toBe('$0');
    expect(applied[1][0]).toBe('~');
    expect(applied[2][0]).toBe('-');
    expect(applied[3][0]).toBe('+5');
  });

  it('matches longest substring first', () => {
    const cells = [['hello@longdomain.example.com']];
    const dict: SubstringEntry[] = [
      { value: '@longdomain.example.com', index: 0, frequency: 3 },
      { value: 'example.com', index: 1, frequency: 5 },
    ];

    const applied = applySubstringRefs(cells, dict);
    // Should match the longer one (semicolon-terminated ref)
    expect(applied[0][0]).toBe('hello%0;');
  });
});
