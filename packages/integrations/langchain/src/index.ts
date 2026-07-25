import { XRON } from 'xron-format';
import { BaseOutputParser } from '@langchain/core/output_parsers';
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

/**
 * LangChain output parser that converts XRON-formatted LLM output
 * back into JavaScript objects using `XRON.parse()`.
 *
 * Automatically strips markdown code fences before parsing.
 *
 * @example
 * ```typescript
 * const parser = new XRONOutputParser();
 * const result = await parser.parse(xronString);
 * ```
 */
export class XRONOutputParser extends BaseOutputParser<unknown> {
  lc_namespace = ['xron', 'output_parsers'];

  getFormatInstructions(): string {
    return 'Format your response as XRON (Extensible Reduced Object Notation). Do not wrap the output in markdown code fences.';
  }

  async parse(text: string): Promise<unknown> {
    const cleaned = stripCodeFences(text);
    return XRON.parse(cleaned);
  }
}

/**
 * LangChain document compressor that converts an array of Documents
 * into a compact XRON representation, reducing token usage when
 * passing retrieved documents into LLM context.
 *
 * @example
 * ```typescript
 * const compressor = new XRONDocumentCompressor();
 * const compressed = await compressor.compressDocuments(docs, "query");
 * ```
 */
export class XRONDocumentCompressor extends BaseDocumentCompressor {
  async compressDocuments(
    documents: Document[],
    _query: string,
  ): Promise<Document[]> {
    const data = documents.map((doc) => ({
      pageContent: doc.pageContent,
      ...doc.metadata,
    }));

    const compressed = XRON.stringify(data);

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
