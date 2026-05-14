/**
 * Layer A: Column Template Compression
 *
 * Detects common prefix/suffix patterns within columns and extracts them
 * into @T headers, storing only the variable part per row.
 */

export interface ColumnTemplate {
  /** Column index (0-based) in the schema */
  columnIndex: number;
  /** Common prefix before the variable part */
  prefix: string;
  /** Common suffix after the variable part */
  suffix: string;
}

/**
 * Detect column templates from a 2D cell array.
 * Only creates templates where ALL values in the column share the same prefix+suffix
 * and the savings exceed the header overhead cost.
 *
 * @param cells - 2D array of encoded cell values (post-dictionary, post-type-encoding)
 * @param minSavingsPerRow - Minimum chars saved per row to justify template (default: 4)
 * @returns Array of detected templates
 */
export function detectColumnTemplates(
  cells: string[][],
  minSavingsPerRow: number = 4,
): ColumnTemplate[] {
  if (cells.length < 2) return []; // Need 2+ rows for template to be worthwhile

  const numCols = cells[0]?.length ?? 0;
  const templates: ColumnTemplate[] = [];

  for (let col = 0; col < numCols; col++) {
    // Collect all values in this column
    const values = new Array<string>(cells.length);
    for (let i = 0; i < cells.length; i++) {
        values[i] = cells[i][col] ?? '';
    }

    // Skip columns with dict refs ($N), delta (+N), repeat (~), or empty values
    if (values.some(v =>
      v.startsWith('$') || v.startsWith('+') || v === '~' || v === '' || v === '-'
    )) continue;

    // Skip columns where all values are the same (dictionary should handle these)
    if (values.every(v => v === values[0])) continue;

    // Find longest common prefix
    const prefix = longestCommonPrefix(values);

    // Find longest common suffix (reverse the strings, find prefix, reverse back)
    const suffix = longestCommonSuffix(values);

    // Calculate savings
    const savedPerRow = prefix.length + suffix.length;
    const headerCost = `@T ${col}: ${prefix}{}${suffix}`.length + 1; // +1 for newline
    const totalSavings = savedPerRow * cells.length - headerCost;

    if (savedPerRow >= minSavingsPerRow && totalSavings > 0) {
      templates.push({ columnIndex: col, prefix, suffix });
    }
  }

  return templates;
}

/**
 * Apply column templates to a 2D cell array.
 * Strips the prefix and suffix from each value in templated columns.
 */
export function applyColumnTemplates(
  cells: string[][],
  templates: ColumnTemplate[],
): string[][] {
  if (templates.length === 0) return cells;

  const result = new Array<string[]>(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const row = cells[i];
    const newRow = new Array<string>(row.length);
    for (let j = 0; j < row.length; j++) {
      newRow[j] = row[j];
    }
    for (let j = 0; j < templates.length; j++) {
      const tmpl = templates[j];
      const val = newRow[tmpl.columnIndex] ?? '';
      // Strip prefix and suffix to get the variable part
      const endIdx = tmpl.suffix.length > 0 ? val.length - tmpl.suffix.length : val.length;
      const variable = val.slice(tmpl.prefix.length, endIdx);
      newRow[tmpl.columnIndex] = variable;
    }
    result[i] = newRow;
  }
  return result;
}

/**
 * Expand column templates during decoding.
 * Wraps each variable part with its prefix and suffix.
 */
export function expandColumnTemplates(
  cells: string[][],
  templates: ColumnTemplate[],
): string[][] {
  if (templates.length === 0) return cells;

  const result = new Array<string[]>(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const row = cells[i];
    const newRow = new Array<string>(row.length);
    for (let j = 0; j < row.length; j++) {
      newRow[j] = row[j];
    }
    for (let j = 0; j < templates.length; j++) {
      const tmpl = templates[j];
      const variable = newRow[tmpl.columnIndex] ?? '';
      newRow[tmpl.columnIndex] = tmpl.prefix + variable + tmpl.suffix;
    }
    result[i] = newRow;
  }
  return result;
}

/** Find the longest common prefix of an array of strings */
function longestCommonPrefix(strs: string[]): string {
  // ⚡ Bolt Optimization: Use code-unit matching by index instead of
  // `.slice(0, -1)` allocations and `.startsWith()` inside a nested loop.
  // This safely handles emojis natively by comparing UTF-16 surrogates in sequence.
  if (strs.length === 0) return '';
  const firstStr = strs[0];
  let prefixLen = 0;
  while (prefixLen < firstStr.length) {
    const char = firstStr[prefixLen];
    for (let i = 1; i < strs.length; i++) {
      if (prefixLen >= strs[i].length || strs[i][prefixLen] !== char) {
        return prefixLen === 0 ? '' : firstStr.slice(0, prefixLen);
      }
    }
    prefixLen++;
  }
  return firstStr.slice(0, prefixLen);
}

/** Find the longest common suffix of an array of strings */
function longestCommonSuffix(strs: string[]): string {
  // ⚡ Bolt Optimization: Calculate suffix matching backward dynamically to
  // avoid massive allocations from mapping, spreading `[...s]`, `.reverse()`,
  // and joining. Evaluates surrogate pairs perfectly via index iteration.
  if (strs.length === 0) return '';
  const firstStr = strs[0];
  const firstLen = firstStr.length;
  let suffixLen = 0;
  while (suffixLen < firstLen) {
    const char = firstStr[firstLen - 1 - suffixLen];
    for (let i = 1; i < strs.length; i++) {
      const str = strs[i];
      if (suffixLen >= str.length || str[str.length - 1 - suffixLen] !== char) {
        return suffixLen === 0 ? '' : firstStr.slice(firstLen - suffixLen);
      }
    }
    suffixLen++;
  }
  return suffixLen === 0 ? '' : firstStr.slice(firstLen - suffixLen);
}
