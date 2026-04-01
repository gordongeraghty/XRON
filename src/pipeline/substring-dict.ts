/**
 * Layer C: Substring Dictionary Compression
 *
 * Finds repeated substrings (4+ chars, 3+ occurrences) across cell values
 * and replaces them with %N references to a @P header.
 */

export interface SubstringEntry {
  value: string;
  index: number;
  frequency: number;
}

/**
 * Build a substring dictionary from a 2D cell array.
 * Only considers cells that are NOT already dict refs ($N), delta (+N), or repeat (~).
 *
 * @param cells - 2D array of encoded cell values
 * @param minLength - Minimum substring length (default: 6)
 * @param minFrequency - Minimum occurrence count (default: 3)
 * @param maxEntries - Maximum dictionary entries (default: 32)
 * @returns Array of substring entries sorted by savings potential
 */
export function buildSubstringDictionary(
  cells: string[][],
  minLength: number = 6,
  minFrequency: number = 3,
  maxEntries: number = 32,
): SubstringEntry[] {
  // 1. Collect all eligible cell values
  const eligibleValues: string[] = [];
  for (const row of cells) {
    for (const cell of row) {
      // Skip special values
      if (!cell || cell === '-' || cell === '~' || cell.startsWith('$') || cell.startsWith('+') || (cell.startsWith('-') && /^\-\d/.test(cell))) {
        continue;
      }
      // Skip short values
      if (cell.length < minLength) continue;
      eligibleValues.push(cell);
    }
  }

  if (eligibleValues.length < minFrequency) return [];

  // 2. Find candidate substrings using a frequency map approach
  // We use a sliding window over all values to find repeated substrings
  const substringFreq = new Map<string, number>();

  for (const val of eligibleValues) {
    // Track which substrings we've seen in THIS value (avoid double-counting)
    const seenInValue = new Set<string>();

    for (let start = 0; start < val.length; start++) {
      for (let len = minLength; len <= Math.min(val.length - start, 50); len++) {
        const sub = val.slice(start, start + len);
        if (!seenInValue.has(sub)) {
          seenInValue.add(sub);
          substringFreq.set(sub, (substringFreq.get(sub) ?? 0) + 1);
        }
      }
    }
  }

  // 3. Filter by minimum frequency
  const candidates: Array<{ value: string; frequency: number; savings: number }> = [];
  for (const [sub, freq] of substringFreq) {
    if (freq < minFrequency) continue;

    // Calculate savings: each occurrence saves (sub.length - refLength) chars
    // refLength is "%N" = 2 chars for single digit, 3 for double digit
    const refLength = 2 + (candidates.length >= 10 ? 1 : 0);
    const savingsPerOccurrence = sub.length - refLength;
    if (savingsPerOccurrence <= 0) continue;

    // Header cost: "@P: " + value + (", " if not first entry)
    // We'll compute this more precisely later
    candidates.push({ value: sub, frequency: freq, savings: savingsPerOccurrence * freq });
  }

  // 4. Sort by total savings (descending)
  candidates.sort((a, b) => b.savings - a.savings);

  // 5. Remove overlapping substrings — if "example.com" is selected, skip "@example.com" etc.
  // A substring is redundant if it's contained within an already-selected entry
  const selected: SubstringEntry[] = [];
  const selectedValues = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= maxEntries) break;

    // Check if this substring is a substring of an already-selected entry
    // or if an already-selected entry is a substring of this one
    let isRedundant = false;
    for (const existing of selectedValues) {
      if (existing.includes(candidate.value) || candidate.value.includes(existing)) {
        isRedundant = true;
        break;
      }
    }
    if (isRedundant) continue;

    // Verify net savings including header cost
    const headerCost = candidate.value.length + 4; // rough: entry length + ", " + overhead
    if (candidate.savings <= headerCost) continue;

    selected.push({
      value: candidate.value,
      index: selected.length,
      frequency: candidate.frequency,
    });
    selectedValues.add(candidate.value);
  }

  return selected;
}

/**
 * Apply substring dictionary references to a 2D cell array.
 * For each cell, find the first matching substring and replace it with %N.
 * Only ONE replacement per cell (no nested refs).
 *
 * Before substitution, any existing literal `%` characters are escaped to `%%`
 * so that expansion can distinguish refs from literals.
 */
export function applySubstringRefs(
  cells: string[][],
  substringDict: SubstringEntry[],
): string[][] {
  if (substringDict.length === 0) return cells;

  // Sort entries by value length descending — match longest first
  const sorted = [...substringDict].sort((a, b) => b.value.length - a.value.length);

  return cells.map(row =>
    row.map(cell => {
      // Skip special values
      if (!cell || cell === '-' || cell === '~' || cell.startsWith('$') || cell.startsWith('+')) {
        return cell;
      }

      // Escape existing literal % → %% before any substitution
      let escaped = cell.replace(/%/g, '%%');

      // Try each substring entry (longest first)
      for (const entry of sorted) {
        const idx = escaped.indexOf(entry.value);
        if (idx !== -1) {
          // Replace the FIRST occurrence only
          return escaped.slice(0, idx) + '%' + entry.index + escaped.slice(idx + entry.value.length);
        }
      }

      return escaped;
    })
  );
}

/**
 * Expand substring dictionary references in a 2D cell array.
 * Replaces %N with the corresponding substring value, then unescapes
 * %% back to literal %.
 */
export function expandSubstringRefs(
  cells: string[][],
  substringDict: SubstringEntry[],
): string[][] {
  if (substringDict.length === 0) return cells;

  // Build lookup: index → value
  const lookup = new Map<number, string>();
  for (const entry of substringDict) {
    lookup.set(entry.index, entry.value);
  }

  return cells.map(row =>
    row.map(cell => {
      if (!cell) return cell;

      // Step 1: Temporarily replace escaped %% with a sentinel
      const sentinel = '\x00PCNT\x00';
      let result = cell.replace(/%%/g, sentinel);

      // Step 2: Expand %N references
      result = result.replace(/%(\d+)/g, (match, indexStr) => {
        const index = parseInt(indexStr, 10);
        return lookup.get(index) ?? match; // Keep original if not found
      });

      // Step 3: Restore sentinel → literal %
      result = result.replace(new RegExp(sentinel, 'g'), '%');

      return result;
    })
  );
}
