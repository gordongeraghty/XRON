import { XRON } from 'xron-format';
import {
  BaseOutputParser,
  BaseTransformOutputParser,
} from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import { BaseDocumentCompressor } from '@langchain/core/retrievers/document_compressors';

/**
 * Strips markdown code fences (```xron ... ```) from a string,
 * returning only the inner content.
 */
function stripCodeFences(text: string): string {
  const fencePattern = /^```(?:xron)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = text.trim().match(fencePattern);
  return match ? match[1] : text;
}

// ---------------------------------------------------------------------------
// Output Parser (batch) — extends BaseOutputParser
// ---------------------------------------------------------------------------

/**
 * LangChain output parser that converts XRON-formatted LLM output
 * back into JavaScript objects using `XRON.parse()`.
 *
 * Automatically strips markdown code fences before parsing.
 *
 * @example
 * ```typescript
 * import { XRONOutputParser } from 'xron-langchain';
 *
 * const parser = new XRONOutputParser();
 * const chain = model.pipe(parser);
 * const result = await chain.invoke('Return user list as XRON');
 * ```
 */
export class XRONOutputParser extends BaseOutputParser<unknown> {
  static lc_name() {
    return 'XRONOutputParser';
  }

  lc_namespace = ['xron', 'output_parsers'];

  getFormatInstructions(): string {
    return [
      'Format your response as XRON (Extensible Reduced Object Notation).',
      'XRON uses @v/@S/@D headers followed by positional CSV rows.',
      'Do not wrap the output in markdown code fences.',
    ].join(' ');
  }

  async parse(text: string): Promise<unknown> {
    const cleaned = stripCodeFences(text);
    return XRON.parse(cleaned);
  }
}

// ---------------------------------------------------------------------------
// Transform Output Parser (streaming) — extends BaseTransformOutputParser
// ---------------------------------------------------------------------------

/**
 * Streaming-compatible XRON output parser for LangChain.
 *
 * Extends `BaseTransformOutputParser` so it works with LangChain's
 * streaming pipeline — chunks are accumulated until the stream ends,
 * then the complete XRON payload is parsed in one pass.
 *
 * @example
 * ```typescript
 * import { XRONTransformOutputParser } from 'xron-langchain';
 *
 * const parser = new XRONTransformOutputParser();
 * const chain = model.pipe(parser);
 *
 * // Streaming — accumulates chunks, yields parsed result at end
 * for await (const chunk of await chain.stream('Return users as XRON')) {
 *   console.log(chunk);
 * }
 * ```
 */
export class XRONTransformOutputParser extends BaseTransformOutputParser<unknown> {
  static lc_name() {
    return 'XRONTransformOutputParser';
  }

  lc_namespace = ['xron', 'output_parsers'];

  getFormatInstructions(): string {
    return [
      'Format your response as XRON (Extensible Reduced Object Notation).',
      'XRON uses @v/@S/@D headers followed by positional CSV rows.',
      'Do not wrap the output in markdown code fences.',
    ].join(' ');
  }

  async parse(text: string): Promise<unknown> {
    const cleaned = stripCodeFences(text);
    return XRON.parse(cleaned);
  }
}

// ---------------------------------------------------------------------------
// Document Compressor — extends BaseDocumentCompressor
// ---------------------------------------------------------------------------

/**
 * LangChain document compressor that converts an array of Documents
 * into a compact XRON representation, reducing token usage when
 * passing retrieved documents into LLM context.
 *
 * @example
 * ```typescript
 * import { XRONDocumentCompressor } from 'xron-langchain';
 *
 * const compressor = new XRONDocumentCompressor();
 * const compressed = await compressor.compressDocuments(docs, 'query');
 * // Single document containing all docs in XRON format
 * ```
 */
export class XRONDocumentCompressor extends BaseDocumentCompressor {
  /** XRON compression level. Defaults to 'auto'. */
  level: 1 | 2 | 3 | 'auto';

  constructor(options?: { level?: 1 | 2 | 3 | 'auto' }) {
    super();
    this.level = options?.level ?? 'auto';
  }

  async compressDocuments(
    documents: Document[],
    _query: string,
  ): Promise<Document[]> {
    if (documents.length === 0) return [];

    const data = documents.map((doc) => ({
      pageContent: doc.pageContent,
      ...doc.metadata,
    }));

    const compressed = XRON.stringify(data, { level: this.level });

    return [
      new Document({
        pageContent: compressed,
        metadata: {
          format: 'xron',
          originalCount: documents.length,
        },
      }),
    ];
  }
}
