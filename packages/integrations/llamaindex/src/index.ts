import { XRON } from 'xron-format';

/**
 * Strips markdown code fences (```xron ... ```) from a string,
 * returning only the inner content.
 */
function stripCodeFences(text: string): string {
  const fencePattern = /^```(?:xron)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = text.trim().match(fencePattern);
  return match ? match[1] : text;
}

/**
 * LlamaIndex output parser that converts XRON-formatted LLM output
 * back into JavaScript objects using `XRON.parse()`.
 *
 * Automatically strips markdown code fences before parsing.
 *
 * @example
 * ```typescript
 * import { XRONOutputParser } from 'xron-llamaindex';
 *
 * const parser = new XRONOutputParser();
 * const result = parser.parse(xronString);
 * ```
 */
export class XRONOutputParser {
  /**
   * Returns instructions for the LLM on how to format its output.
   */
  format(prompt: string): string {
    return `${prompt}\n\nReturn output in XRON format (Extensible Reduced Object Notation). Do not wrap the output in markdown code fences.`;
  }

  /**
   * Parse XRON-formatted text into a JavaScript value.
   * Strips markdown code fences before parsing.
   */
  parse(output: string): unknown {
    const cleaned = stripCodeFences(output);
    return XRON.parse(cleaned);
  }
}

/**
 * Document compressor that converts an array of documents into a compact
 * XRON representation, reducing token usage when passing retrieved
 * documents into LLM context.
 *
 * Compatible with LlamaIndex.TS document workflows.
 *
 * @example
 * ```typescript
 * import { XRONDocumentCompressor } from 'xron-llamaindex';
 *
 * const compressor = new XRONDocumentCompressor();
 * const compressed = compressor.compressDocuments(docs);
 * ```
 */
export class XRONDocumentCompressor {
  /**
   * Compress an array of documents into a single XRON-encoded document.
   *
   * Each input document should have a `text` property (LlamaIndex convention)
   * and optional `metadata`.
   */
  compressDocuments(
    documents: Array<{ text: string; metadata?: Record<string, unknown> }>,
  ): { text: string; metadata: Record<string, unknown> } {
    const data = documents.map((doc) => ({
      text: doc.text,
      ...(doc.metadata ?? {}),
    }));

    const compressed = XRON.stringify(data);

    return {
      text: compressed,
      metadata: {
        format: 'xron',
        originalCount: documents.length,
      },
    };
  }
}
