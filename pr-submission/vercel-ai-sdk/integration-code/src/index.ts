import { XRON } from 'xron-format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for XRON compression in Vercel AI SDK contexts.
 */
export interface XRONCompressOptions {
  /** XRON compression level (1, 2, 3, or 'auto'). Defaults to 'auto'. */
  level?: 1 | 2 | 3 | 'auto';
}

// ---------------------------------------------------------------------------
// AI SDK LanguageModelV2Middleware type declarations
// These mirror the Vercel AI SDK 3.x types. Inside the actual SDK repo,
// replace with real imports:
//   import type { LanguageModelV2Middleware } from 'ai';
// ---------------------------------------------------------------------------

interface LanguageModelV2Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}

interface LanguageModelV2CallOptions {
  prompt: LanguageModelV2Message[];
  [key: string]: unknown;
}

interface LanguageModelV2Middleware {
  transformParams?: (options: {
    params: LanguageModelV2CallOptions;
  }) => Promise<LanguageModelV2CallOptions>;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Compress an array of data objects into an XRON string suitable
 * for injection into LLM prompts. Achieves up to 80% token reduction.
 *
 * @example
 * ```typescript
 * import { compressDataForPrompt } from 'xron-vercel';
 * import { generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const users = await fetchUsers();
 * const compressed = compressDataForPrompt(users, { level: 'auto' });
 *
 * const { text } = await generateText({
 *   model: openai('gpt-4o'),
 *   prompt: `Data:\n${compressed}\n\nHow many users are active?`,
 * });
 * ```
 */
export function compressDataForPrompt(
  data: unknown[],
  options?: XRONCompressOptions,
): string {
  return XRON.stringify(data, { level: options?.level ?? 'auto' });
}

/**
 * Create an AI SDK compatible message with XRON-compressed content.
 *
 * @example
 * ```typescript
 * import { createXRONMessage } from 'xron-vercel';
 *
 * const msg = createXRONMessage('system', products, { level: 2 });
 * // { role: 'system', content: '<XRON-compressed data>' }
 * ```
 */
export function createXRONMessage(
  role: 'system' | 'user' | 'assistant',
  data: unknown[],
  options?: XRONCompressOptions,
): { role: string; content: string } {
  return {
    role,
    content: compressDataForPrompt(data, options),
  };
}

// ---------------------------------------------------------------------------
// LanguageModelV2Middleware — the AI SDK 3.x native integration
// ---------------------------------------------------------------------------

/**
 * Creates a `LanguageModelV2Middleware` that automatically compresses
 * JSON array content in system and user messages before they reach
 * the model. Works with `experimental_wrapLanguageModel` for drop-in
 * integration.
 *
 * The middleware inspects each message's text content. If it contains a
 * valid JSON array, it replaces it with XRON-compressed output — saving
 * 60-80% of input tokens with zero information loss.
 *
 * @example
 * ```typescript
 * import { xronMiddleware } from 'xron-vercel';
 * import { experimental_wrapLanguageModel, generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const model = experimental_wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: xronMiddleware({ level: 'auto' }),
 * });
 *
 * // JSON arrays in system/user messages are automatically compressed
 * const { text } = await generateText({
 *   model,
 *   messages: [
 *     { role: 'system', content: JSON.stringify(largeDataset) },
 *     { role: 'user', content: 'Analyse this data' },
 *   ],
 * });
 * ```
 */
export function xronMiddleware(
  options?: XRONCompressOptions,
): LanguageModelV2Middleware {
  const level = options?.level ?? 'auto';

  return {
    async transformParams({ params }) {
      const compressedPrompt = params.prompt.map((msg) => {
        // Only compress system and user messages
        if (msg.role !== 'system' && msg.role !== 'user') return msg;

        if (typeof msg.content === 'string') {
          return { ...msg, content: tryCompressJson(msg.content, level) };
        }

        // Handle multi-part content (array of content parts)
        if (Array.isArray(msg.content)) {
          const compressed = msg.content.map((part) => {
            if (part.type === 'text' && typeof part.text === 'string') {
              return { ...part, text: tryCompressJson(part.text, level) };
            }
            return part;
          });
          return { ...msg, content: compressed };
        }

        return msg;
      });

      return { ...params, prompt: compressedPrompt };
    },
  };
}

/**
 * Attempt to parse a string as a JSON array and compress it with XRON.
 * Returns the original string if it's not a JSON array.
 */
function tryCompressJson(text: string, level: 1 | 2 | 3 | 'auto'): string {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return XRON.stringify(parsed, { level });
    }
  } catch {
    // Not JSON — return as-is
  }
  return text;
}
