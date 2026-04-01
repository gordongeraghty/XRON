/**
 * Layer 6: Tokenizer Alignment Optimization
 *
 * Analyzes the BPE tokenizer vocabulary to select separators and layouts
 * that minimize token count. Different tokenizers have different merge rules.
 *
 * Key insight: newlines, commas+space, and common English words are typically
 * single tokens in all major tokenizers, while JSON structural characters
 * ({, }, [, ], :, ") are often individual expensive tokens.
 */

import { TokenizerProfile } from '../types.js';

/**
 * Separator configuration for a specific tokenizer.
 */
export interface SeparatorConfig {
  /** Row separator (between rows in positional arrays) */
  rowSep: string;
  /** Field separator (between values in a row) */
  fieldSep: string;
  /** Header prefix character */
  headerPrefix: string;
  /** Schema reference open */
  nestedOpen: string;
  /** Schema reference close */
  nestedClose: string;
}

/**
 * Pre-computed optimal separators for each tokenizer profile.
 *
 * These are determined by analyzing which characters/sequences are single tokens
 * in each tokenizer's vocabulary.
 */
const SEPARATOR_CONFIGS: Record<TokenizerProfile, SeparatorConfig> = {
  // GPT-4o, GPT-5: o200k_base vocabulary
  o200k_base: {
    rowSep: '\n',      // \n is always 1 token
    fieldSep: ', ',    // ", " typically merges into 1 token
    headerPrefix: '@', // @ is 1 token in o200k_base
    nestedOpen: '(',   // ( is 1 token
    nestedClose: ')',  // ) is 1 token
  },

  // GPT-4, GPT-3.5: cl100k_base vocabulary
  cl100k_base: {
    rowSep: '\n',
    fieldSep: ', ',
    headerPrefix: '@',
    nestedOpen: '(',
    nestedClose: ')',
  },

  // Claude 3.x, 4.x tokenizer
  claude: {
    rowSep: '\n',
    fieldSep: ', ',
    headerPrefix: '@',
    nestedOpen: '(',
    nestedClose: ')',
  },
};

/**
 * Get the optimal separator configuration for a tokenizer profile.
 */
export function getSeparatorConfig(profile: TokenizerProfile): SeparatorConfig {
  return SEPARATOR_CONFIGS[profile];
}

/**
 * Estimate the token count of a string for a given tokenizer.
 * This is a heuristic — use tiktoken for exact counts.
 *
 * BPE tokenizer rules of thumb:
 * - Common English words: 1 token each
 * - Spaces before common words often merge: " the" = 1 token
 * - Numbers: ~1 token per 1-3 digits
 * - Punctuation: usually 1 token each
 * - Newlines: 1 token
 * - JSON quotes: 1 token each (expensive!)
 * - Common email patterns: 2-5 tokens
 */
export function estimateTokens(text: string, profile: TokenizerProfile): number {
  if (!text) return 0;

  // Split on whitespace and count segments
  // Each word is ~1 token, each separator is ~0-1 tokens
  let tokens = 0;
  let i = 0;

  while (i < text.length) {
    // Newline: 1 token
    if (text[i] === '\n') {
      tokens++;
      i++;
      continue;
    }

    // Whitespace leading into a word often merges
    if (text[i] === ' ' && i + 1 < text.length && /[a-zA-Z]/.test(text[i + 1])) {
      // Space + word start — will merge in BPE
      i++; // skip space, it'll merge with next word
      continue;
    }

    // Space alone
    if (text[i] === ' ') {
      // Trailing/multiple spaces: 1 token each
      tokens++;
      i++;
      continue;
    }

    // Word characters: accumulate until non-word
    if (/[a-zA-Z]/.test(text[i])) {
      let word = '';
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        word += text[i];
        i++;
      }
      // Common short words: 1 token
      // Longer words: roughly 1 token per 4-5 chars
      tokens += Math.max(1, Math.ceil(word.length / 5));
      continue;
    }

    // Digits: ~1 token per 1-3 digits
    if (/\d/.test(text[i])) {
      let num = '';
      while (i < text.length && /[\d.eE+-]/.test(text[i])) {
        num += text[i];
        i++;
      }
      tokens += Math.max(1, Math.ceil(num.length / 3));
      continue;
    }

    // Punctuation and special chars: 1 token each
    tokens++;
    i++;
  }

  return Math.max(1, tokens);
}

/**
 * Try to use tiktoken for exact token counting (if available).
 * Falls back to estimation if tiktoken is not installed.
 */
export async function countTokensExact(
  text: string,
  profile: TokenizerProfile,
): Promise<number> {
  try {
    // Dynamic import — tiktoken is an optional peer dependency
    const tiktoken = await import('tiktoken');
    const encodingName = profile === 'claude' ? 'cl100k_base' : profile;
    const enc = tiktoken.encoding_for_model(
      profile === 'o200k_base' ? 'gpt-4o' :
      profile === 'cl100k_base' ? 'gpt-4' :
      'gpt-4' // fallback
    );
    const tokens = enc.encode(text);
    enc.free();
    return tokens.length;
  } catch {
    // tiktoken not installed — use heuristic
    return estimateTokens(text, profile);
  }
}

/**
 * Optimize a completed XRON string for a specific tokenizer.
 * Currently applies the separator config (separators are already optimized
 * during encoding). Future: could apply character substitutions for
 * multi-byte tokens that encode more information per token.
 */
export function optimizeForTokenizer(
  xronOutput: string,
  _profile: TokenizerProfile,
): string {
  // Currently, separator optimization happens during encoding.
  // This function is a hook for future tokenizer-specific post-processing:
  // - Unicode character substitution for privileged single-token chars
  // - Whitespace merging for better BPE boundaries
  return xronOutput;
}
