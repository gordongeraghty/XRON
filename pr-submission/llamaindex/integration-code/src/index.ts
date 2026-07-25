import { XRON } from 'xron-format';

// ---------------------------------------------------------------------------
// LlamaIndex.TS native base types (from llamaindex package)
// These are the interfaces your code must satisfy when dropped into the
// LlamaIndex.TS monorepo. We declare them here so this file compiles
// standalone — inside the actual repo, replace with real imports:
//   import { BaseOutputParser } from 'llamaindex';
//   import { BaseNodePostprocessor, TextNode, NodeWithScore } from 'llamaindex';
// ---------------------------------------------------------------------------

/** LlamaIndex BaseOutputParser interface. */
interface BaseOutputParser<T = string> {
  parse(output: string): T;
  format(query: string): string;
}

/** Minimal TextNode shape (LlamaIndex core). */
interface TextNode {
  text: string;
  metadata: Record<string, unknown>;
  id_?: string;
}

/** NodeWithScore wraps a node with a relevance score. */
interface NodeWithScore {
  node: TextNode;
  score?: number;
}

/** QueryBundle used by postprocessors. */
interface QueryBundle {
  queryStr: string;
}

/** BaseNodePostprocessor interface. */
interface BaseNodePostprocessor {
  postprocessNodes(
    nodes: NodeWithScore[],
    query?: QueryBundle,
  ): Promise<NodeWithScore[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripCodeFences(text: string): string {
  const fencePattern = /^```(?:xron)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = text.trim().match(fencePattern);
  return match ? match[1] : text;
}

// ---------------------------------------------------------------------------
// XRONParser — extends BaseOutputParser
// ---------------------------------------------------------------------------

/**
 * LlamaIndex output parser that converts XRON-formatted LLM output
 * back into JavaScript objects using `XRON.parse()`.
 *
 * Implements the LlamaIndex `BaseOutputParser` interface so it can be
 * used directly in query pipelines.
 *
 * @example
 * ```typescript
 * import { XRONParser } from 'xron-llamaindex';
 *
 * const parser = new XRONParser();
 * const formatted = parser.format('List all users');
 * // → 'List all users\n\nReturn output in XRON format...'
 * const result = parser.parse(xronString);
 * ```
 */
export class XRONParser implements BaseOutputParser<unknown> {
  format(query: string): string {
    return `${query}\n\nReturn output in XRON format (Extensible Reduced Object Notation). XRON uses @v/@S/@D headers followed by positional CSV rows. Do not wrap the output in markdown code fences.`;
  }

  parse(output: string): unknown {
    const cleaned = stripCodeFences(output);
    return XRON.parse(cleaned);
  }
}

// ---------------------------------------------------------------------------
// XRONPostprocessor — extends BaseNodePostprocessor
// ---------------------------------------------------------------------------

/**
 * LlamaIndex node postprocessor that compresses an array of `TextNode`
 * objects into a single XRON-encoded node, dramatically reducing token
 * usage when feeding retrieved context into an LLM.
 *
 * Implements `BaseNodePostprocessor` so it plugs directly into
 * LlamaIndex's retrieval pipeline.
 *
 * @example
 * ```typescript
 * import { XRONPostprocessor } from 'xron-llamaindex';
 * import { VectorStoreIndex } from 'llamaindex';
 *
 * const index = await VectorStoreIndex.fromDocuments(documents);
 * const retriever = index.asRetriever({ similarityTopK: 10 });
 * const postprocessor = new XRONPostprocessor({ level: 2 });
 *
 * const queryEngine = index.asQueryEngine({
 *   retriever,
 *   nodePostprocessors: [postprocessor],
 * });
 *
 * const response = await queryEngine.query('Summarise the data');
 * ```
 */
export class XRONPostprocessor implements BaseNodePostprocessor {
  private level: 1 | 2 | 3 | 'auto';

  constructor(options?: { level?: 1 | 2 | 3 | 'auto' }) {
    this.level = options?.level ?? 'auto';
  }

  async postprocessNodes(
    nodes: NodeWithScore[],
    _query?: QueryBundle,
  ): Promise<NodeWithScore[]> {
    if (nodes.length === 0) return [];

    const data = nodes.map(({ node, score }) => ({
      text: node.text,
      score,
      ...node.metadata,
    }));

    const compressed = XRON.stringify(data, { level: this.level });

    const compressedNode: TextNode = {
      text: compressed,
      metadata: {
        format: 'xron',
        originalCount: nodes.length,
      },
    };

    return [{ node: compressedNode, score: undefined }];
  }
}
