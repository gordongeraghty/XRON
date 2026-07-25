import { XRON } from 'xron-format';

/**
 * Options for XRON compression in Vercel AI SDK contexts.
 */
export interface XRONCompressOptions {
  /** XRON compression level (1, 2, 3, or 'auto'). Defaults to 'auto'. */
  level?: 1 | 2 | 3 | 'auto';
}

/**
 * Compress an array of data objects into an XRON string suitable
 * for injection into LLM prompts. Achieves up to 80% token reduction.
 *
 * @example
 * ```typescript
 * const users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
 * const compressed = compressDataForPrompt(users);
 * // Use in a prompt: `Here is the data:\n${compressed}`
 * ```
 */
export function compressDataForPrompt(
  data: unknown[],
  options?: XRONCompressOptions,
): string {
  return XRON.stringify(data, { level: options?.level ?? 'auto' });
}

/**
 * A Vercel AI SDK compatible message object.
 */
export interface XRONMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Create a Vercel AI SDK compatible message with XRON-compressed content.
 *
 * @example
 * ```typescript
 * const msg = createXRONMessage('system', products, { level: 2 });
 * // { role: 'system', content: '<XRON-compressed data>' }
 * ```
 */
export function createXRONMessage(
  role: 'system' | 'user' | 'assistant',
  data: unknown[],
  options?: XRONCompressOptions,
): XRONMessage {
  return {
    role,
    content: compressDataForPrompt(data, options),
  };
}

/**
 * Middleware function that intercepts messages and compresses any
 * array data found in message content into XRON format.
 *
 * Processes messages where content is a JSON-encoded array string,
 * replacing it with XRON-compressed output.
 *
 * @example
 * ```typescript
 * const messages = [
 *   { role: 'system', content: JSON.stringify(largeDataset) },
 *   { role: 'user', content: 'Analyse this data' },
 * ];
 * const compressed = xronMiddleware(messages);
 * ```
 */
export function xronMiddleware(
  messages: XRONMessage[],
  options?: XRONCompressOptions,
): XRONMessage[] {
  return messages.map((msg) => {
    if (typeof msg.content !== 'string') return msg;

    try {
      const parsed = JSON.parse(msg.content);
      if (Array.isArray(parsed)) {
        return {
          ...msg,
          content: compressDataForPrompt(parsed, options),
        };
      }
    } catch {
      // Not JSON — leave the message as-is
    }

    return msg;
  });
}
