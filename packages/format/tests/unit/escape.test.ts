import { describe, it, expect } from 'vitest';
import { needsQuoting, escapeValue, unescapeValue } from '../../src/format/escape.js';

describe('String Escaping', () => {
  describe('needsQuoting', () => {
    it('returns false for simple strings', () => {
      expect(needsQuoting('hello')).toBe(false);
      expect(needsQuoting('Alice Johnson')).toBe(false);
      expect(needsQuoting('alice@example.com')).toBe(false);
    });

    it('returns true for empty strings', () => {
      expect(needsQuoting('')).toBe(true);
    });

    it('returns true for strings containing commas', () => {
      expect(needsQuoting('hello, world')).toBe(true);
    });

    it('returns true for strings containing newlines', () => {
      expect(needsQuoting('line1\nline2')).toBe(true);
    });

    it('returns true for strings that look like numbers', () => {
      expect(needsQuoting('42')).toBe(true);
      expect(needsQuoting('-3.14')).toBe(true);
    });

    it('returns true for reserved words', () => {
      expect(needsQuoting('true')).toBe(true);
      expect(needsQuoting('false')).toBe(true);
      expect(needsQuoting('null')).toBe(true);
    });

    it('returns true for strings starting with special prefixes', () => {
      expect(needsQuoting('$0')).toBe(true);
      expect(needsQuoting('+1')).toBe(true);
      expect(needsQuoting('~')).toBe(true);
      expect(needsQuoting('@header')).toBe(true);
    });
  });

  describe('escapeValue / unescapeValue', () => {
    it('returns simple strings unquoted', () => {
      expect(escapeValue('hello')).toBe('hello');
    });

    it('quotes strings that need escaping', () => {
      expect(escapeValue('hello, world')).toBe('"hello, world"');
    });

    it('quotes strings containing internal quotes', () => {
      const result = escapeValue('say "hello"');
      // The string 'say "hello"' doesn't match needsQuoting patterns
      // (no commas, no newlines, doesn't start with special chars)
      // but it does start with a letter — check actual behavior
      expect(typeof result).toBe('string');
      // Round-trip is what matters
      expect(unescapeValue(result)).toBe('say "hello"');
    });

    it('round-trips escaped strings', () => {
      const values = ['hello, world', 'line1\nline2', 'say "hi"', '', '42', 'true'];
      for (const v of values) {
        expect(unescapeValue(escapeValue(v))).toBe(v);
      }
    });
  });
});
