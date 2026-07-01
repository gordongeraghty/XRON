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
  if (strs.length === 0) return '';
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  // Ensure we don't split a surrogate pair: if the last char is a high surrogate, remove it
  if (prefix.length > 0) {
    const lastCode = prefix.charCodeAt(prefix.length - 1);
    if (lastCode >= 0xD800 && lastCode <= 0xDBFF) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

/** Find the longest common suffix of an array of strings */
function longestCommonSuffix(strs: string[]): string {
  if (strs.length === 0) return '';
  let suffix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].endsWith(suffix)) {
      suffix = suffix.slice(1);
      if (suffix === '') return '';
    }
  }
  // Ensure we don't split a surrogate pair: if the first char is a low surrogate, remove it
  if (suffix.length > 0) {
    const firstCode = suffix.charCodeAt(0);
    if (firstCode >= 0xDC00 && firstCode <= 0xDFFF) {
      suffix = suffix.slice(1);
    }
  }
  return suffix;
}
