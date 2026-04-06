/**
 * XRON: Extensible Reduced Object Notation
 *
 * A lossless data serialization format achieving ~80% token reduction
 * for LLM contexts. Combines schema extraction, positional streaming,
 * dictionary encoding, delta compression, and tokenizer alignment.
 *
 * @example
 * ```typescript
 * import { XRON } from 'xron-format';
 *
 * const data = [
 *   { id: 1, name: 'Alice', dept: 'Sales' },
 *   { id: 2, name: 'Bob', dept: 'Engineering' },
 *   { id: 3, name: 'Carol', dept: 'Sales' },
 * ];
 *
 * // Serialize to XRON (Level 2 by default)
 * const xron = XRON.stringify(data);
 * // Output:
 * // @v2
 * // @S A: id, name, dept
 * // @D: Sales
 * // @N3 A
 * // 1, Alice, $0
 * // 2, Bob, Engineering
 * // 3, Carol, $0
 *
 * // Parse back to objects (lossless)
 * const restored = XRON.parse(xron);
 * // restored deep-equals data
 *
 * // Analyze compression metrics
 * const stats = await XRON.analyze(data);
 * // { inputTokens: 85, outputTokens: 28, reduction: 67, ... }
 * ```
 *
 * @module xron-format
 */

import { stringify, stringifyStream } from './stringify.js';
import { parse, parseStream } from './parse.js';
import {
  XronOptions,
  XronLevel,
  XronLevelOrAuto,
  XronAnalysis,
  TokenizerProfile,
  DEFAULT_OPTIONS,
} from './types.js';
import { estimateTokenCount } from './utils/token-counter.js';
import { assessData, assessDataExact, XronRecommendation } from './pipeline/adaptive.js';

/**
 * Analyze compression metrics for a given data value.
 * Shows token counts at each level and overall reduction.
 */
async function analyze(
  value: any,
  options?: XronOptions,
): Promise<XronAnalysis> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const tokenizer = opts.tokenizer;

  // Get JSON baseline
  const jsonStr = JSON.stringify(value);
  const inputTokens = estimateTokenCount(jsonStr, tokenizer);

  // Get XRON at each level
  const l1Str = stringify(value, { ...opts, level: 1 });
  const l2Str = stringify(value, { ...opts, level: 2 });
  const l3Str = stringify(value, { ...opts, level: 3 });

  const l1Tokens = estimateTokenCount(l1Str, tokenizer);
  const l2Tokens = estimateTokenCount(l2Str, tokenizer);
  const l3Tokens = estimateTokenCount(l3Str, tokenizer);

  const outputTokens = estimateTokenCount(
    stringify(value, opts),
    tokenizer,
  );

  // Count schemas and dictionary entries from Level 2 output
  const l2Lines = l2Str.split('\n');
  const schemas = l2Lines.filter(l => l.startsWith('@S ')).length;
  const dictLine = l2Lines.find(l => l.startsWith('@D:'));
  const dictEntries = dictLine
    ? dictLine.slice(4).split(',').filter(v => v.trim()).length
    : 0;

  // Count delta columns from Level 3 output
  const l3Lines = l3Str.split('\n');
  let deltaColumns = 0;
  // Look for +N patterns in data rows
  const dataStartIdx = l3Lines.findIndex(l => l.startsWith('@N'));
  if (dataStartIdx >= 0 && dataStartIdx + 2 < l3Lines.length) {
    const secondDataRow = l3Lines[dataStartIdx + 2]; // first data row after header
    if (secondDataRow) {
      const cells = secondDataRow.split(',').map(c => c.trim());
      deltaColumns = cells.filter(c => c.startsWith('+')).length;
    }
  }

  const reduction = inputTokens > 0
    ? Math.round((1 - outputTokens / inputTokens) * 100)
    : 0;

  return {
    inputTokens,
    outputTokens,
    reduction,
    schemas,
    dictEntries,
    deltaColumns,
    breakdown: {
      level1Tokens: l1Tokens,
      level2Tokens: l2Tokens,
      level3Tokens: l3Tokens,
    },
  };
}

/**
 * Synchronously recommend the optimal compression level for a given value.
 *
 * Unlike `analyze()` (which actually serialises at every level), `recommend()`
 * uses a lightweight heuristic pass (~1–5 ms on typical payloads) to explain
 * *why* a level would or would not be beneficial without running the full
 * compression pipeline.
 *
 * Use this to:
 * - Understand why 'auto' mode chose a particular level.
 * - Surface compression trade-offs to end users.
 * - Decide whether to pass a hard-coded level or use 'auto'.
 *
 * @example
 * ```typescript
 * const rec = XRON.recommend({ id: 1, name: 'Alice' });
 * console.log(rec.recommendedLevel); // 1
 * console.log(rec.reason); // 'Payload is very small (30B)...'
 * console.log(rec.caveats);
 * ```
 */
function recommend(value: any, options?: XronOptions): XronRecommendation {
  return assessData(value, options);
}

/**
 * The XRON namespace — main entry point for the library.
 */
export const XRON = {
  /**
   * Serialize a JavaScript value to XRON format.
   * Pass `{ level: 'auto' }` to let XRON pick the optimal level.
   */
  stringify,
  /** Parse an XRON string back to its original JavaScript value (lossless). */
  parse,
  stringifyStream,
  parseStream,
  /** Async: measure actual token counts at every level and return metrics. */
  analyze,
  /**
   * Sync: lightweight heuristic analysis — recommends a level and explains
   * why each compression layer will or won't activate. No serialisation performed.
   */
  recommend,
};

// Named exports for tree-shaking
export { stringify, parse, analyze, recommend, stringifyStream, parseStream };

// Type re-exports
export type {
  XronOptions,
  XronLevel,
  XronLevelOrAuto,
  XronAnalysis,
  XronRecommendation,
  TokenizerProfile,
};
