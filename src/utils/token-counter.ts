/**
 * Token counting utilities for analysis and benchmarking.
 * Uses tiktoken if available, falls back to heuristic estimation.
 */

import { TokenizerProfile } from '../types.js';
import { estimateTokens, countTokensExact } from '../pipeline/tokenizer-opt.js';

/**
 * Count tokens in a string. Uses tiktoken if installed, otherwise estimates.
 */
export async function countTokens(
  text: string,
  tokenizer: TokenizerProfile = 'o200k_base',
): Promise<number> {
  return countTokensExact(text, tokenizer);
}

/**
 * Synchronous token estimation (no tiktoken required).
 */
export function estimateTokenCount(
  text: string,
  tokenizer: TokenizerProfile = 'o200k_base',
): number {
  return estimateTokens(text, tokenizer);
}
