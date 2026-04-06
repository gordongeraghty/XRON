/**
 * Layer 3: Dictionary Encoding
 *
 * Collects repeated string values across the dataset, builds a dictionary,
 * and replaces occurrences with $index references.
 *
 * JSON: "Engineering", "Engineering", "Engineering", "Sales", "Sales"
 * XRON: @D: Engineering, Sales
 *       $0, $0, $0, $1, $1
 *
 * Savings: Each repeated value is replaced by 1-3 character reference ($0-$255).
 */

import { DictionaryEntry } from '../types.js';

interface ValueFrequency {
  value: string;
  frequency: number;
}

/**
 * Build a dictionary from all string values in the dataset.
 * Returns entries sorted by savings potential (frequency × length) descending.
 */
/** Maximum base-62 dictionary entries: 62 single-char + 62×62 two-char */
const MAX_BASE62_ENTRIES = 62 + 62 * 62; // 3906

export function buildDictionary(
  data: any,
  options: {
    maxSize: number;
    minLength: number;
    minFrequency: number;
  },
): DictionaryEntry[] {
  const frequencies = new Map<string, number>();

  // Collect all string value frequencies
  collectStringValues(data, frequencies);

  // Filter by minimum length and frequency
  const candidates: ValueFrequency[] = [];
  for (const [value, freq] of frequencies) {
    if (value.length >= options.minLength && freq >= options.minFrequency) {
      candidates.push({ value, frequency: freq });
    }
  }

  // Sort by savings potential: (frequency × value_length) descending
  // The idea: replacing "Engineering" (11 chars, ~2-3 tokens) appearing 50 times
  // with "$0" (1 token) saves (2-3 - 1) × 50 = ~75-100 tokens.
  candidates.sort((a, b) => {
    const savingsA = a.frequency * estimateTokenSavings(a.value);
    const savingsB = b.frequency * estimateTokenSavings(b.value);
    return savingsB - savingsA;
  });

  // Take top N entries — include if net token savings are positive
  // Clamp to base-62 maximum (3906 entries)
  const effectiveMax = Math.min(options.maxSize, MAX_BASE62_ENTRIES);
  const entries: DictionaryEntry[] = [];
  for (let i = 0; i < Math.min(candidates.length, effectiveMax); i++) {
    const c = candidates[i];
    const savings = estimateTokenSavings(c.value);
    // Cost: 1 dictionary header entry (value listed once in @D)
    // Benefit: savings per occurrence × frequency
    // Include if total savings > header cost
    const headerCost = estimateTokenCount(c.value) + 1; // value + comma
    const totalSavings = savings * c.frequency;
    if (totalSavings >= headerCost) {
      entries.push({
        value: c.value,
        index: entries.length,
        frequency: c.frequency,
        savings,
      });
    }
  }

  return entries;
}

/**
 * Recursively collect all string values and their frequencies.
 */
function collectStringValues(
  value: any,
  frequencies: Map<string, number>,
): void {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, frequencies);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      collectStringValues(value[key], frequencies);
    }
  }
}

/**
 * Rough estimate of how many tokens a string value uses.
 * BPE tokenizers typically encode ~4 chars per token for English text.
 * Quoted strings add 2 extra tokens for the quotes in JSON.
 */
function estimateTokenCount(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

/**
 * Estimate how many tokens we save by replacing this value with a $ref.
 * Single-char refs ($0-$Z, indices 0-61) cost ~1 token.
 * Two-char refs ($00-$ZZ, indices 62+) cost ~1.5 tokens.
 */
function estimateTokenSavings(value: string): number {
  const valueCost = estimateTokenCount(value);
  // Conservative estimate: 1 token for most refs
  const refCost = 1;
  return Math.max(0, valueCost - refCost);
}

// Base-62 alphabet for compact dictionary references
const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Encode a dictionary index as a compact base-62 reference string.
 * Indices 0-61:   single char ($0 - $Z)
 * Indices 62-3843: two chars ($00 - $ZZ)
 * Backwards compatible: $0-$9 are the same as old numeric encoding.
 */
function encodeDictIndex(index: number): string {
  if (index < 62) {
    return B62[index];
  }
  const adjusted = index - 62;
  const hi = Math.floor(adjusted / 62);
  const lo = adjusted % 62;
  return B62[hi] + B62[lo];
}

/**
 * Decode a base-62 dictionary reference back to a numeric index.
 */
function decodeDictIndex(ref: string): number {
  if (ref.length === 1) {
    return B62.indexOf(ref);
  }
  if (ref.length === 2) {
    const hi = B62.indexOf(ref[0]);
    const lo = B62.indexOf(ref[1]);
    if (hi === -1 || lo === -1) return -1;
    return 62 + hi * 62 + lo;
  }
  return -1;
}

/**
 * Create a lookup map from value → $ref reference string.
 * Uses base-62 encoding for compact refs beyond 62 entries.
 */
export function createDictLookup(entries: DictionaryEntry[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const entry of entries) {
    lookup.set(entry.value, `$${encodeDictIndex(entry.index)}`);
  }
  return lookup;
}

/**
 * Create a reverse lookup from index → value for parsing.
 */
export function createDictReverse(values: string[]): Map<number, string> {
  const reverse = new Map<number, string>();
  for (let i = 0; i < values.length; i++) {
    reverse.set(i, values[i]);
  }
  return reverse;
}

/**
 * Resolve a $ref reference to its dictionary value.
 * Supports both legacy numeric ($0, $123) and base-62 ($a, $Z, $aB) formats.
 */
export function resolveDictRef(ref: string, dictionary: string[]): string | null {
  if (!ref.startsWith('$') || ref.length < 2) return null;
  const body = ref.slice(1);

  // Try legacy numeric format first (backwards compatibility)
  if (/^\d+$/.test(body)) {
    const index = parseInt(body, 10);
    if (index >= 0 && index < dictionary.length) {
      return dictionary[index];
    }
    // Fall through to base-62 decode (e.g. $0 is both numeric 0 and b62 index 0)
  }

  // Base-62 decode
  const index = decodeDictIndex(body);
  if (index >= 0 && index < dictionary.length) {
    return dictionary[index];
  }
  return null;
}

/**
 * Check if a value is a dictionary reference ($ref).
 * Matches legacy numeric ($0-$255+) and base-62 ($a, $Z, $aB, etc.).
 */
export function isDictRef(value: string): boolean {
  if (!value.startsWith('$') || value.length < 2) return false;
  const body = value.slice(1);
  // Legacy numeric (any length of digits)
  if (/^\d+$/.test(body)) return true;
  // Base-62: 1-2 chars from B62 alphabet
  if (body.length > 2) return false;
  return body.split('').every(ch => B62.includes(ch));
}
