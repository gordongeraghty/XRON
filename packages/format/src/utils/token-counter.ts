/**
 * Token counting utilities for analysis and benchmarking.
 */

import { TokenizerProfile } from '../types.js';
import { estimateTokens } from '../pipeline/tokenizer-opt.js';

/**
 * Synchronous token estimation (no tiktoken required).
 */
export function estimateTokenCount(
  text: string,
  tokenizer: TokenizerProfile = 'o200k_base',
): number {
  return estimateTokens(text, tokenizer);
}
