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
  const entries: DictionaryEntry[] = [];
  for (let i = 0; i < Math.min(candidates.length, options.maxSize); i++) {
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
 * $ref costs 1 token ($0-$9) or 2 tokens ($10-$255).
 */
function estimateTokenSavings(value: string): number {
  const valueCost = estimateTokenCount(value);
  // $ref is typically 1 token for $0-$9, might be 1-2 for higher indices
  const refCost = 1;
  return Math.max(0, valueCost - refCost);
}

/**
 * Create a lookup map from value → $index reference string.
 */
export function createDictLookup(entries: DictionaryEntry[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const entry of entries) {
    lookup.set(entry.value, `$${entry.index}`);
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
 * Resolve a $index reference to its dictionary value.
 */
export function resolveDictRef(ref: string, dictionary: string[]): string | null {
  const match = ref.match(/^\$(\d+)$/);
  if (!match) return null;
  const index = parseInt(match[1], 10);
  if (index >= 0 && index < dictionary.length) {
    return dictionary[index];
  }
  return null;
}

/**
 * Check if a value is a dictionary reference ($N).
 */
export function isDictRef(value: string): boolean {
  return /^\$\d+$/.test(value);
}
