# PR: Add XRON Output Parser & Document Compressor for LlamaIndex.TS

## Summary

This PR adds XRON support to LlamaIndex.TS via two new components:

- **`XRONOutputParser`** — parses XRON-formatted LLM responses back into structured JavaScript objects
- **`XRONDocumentCompressor`** — compresses retrieved document arrays into compact XRON format before prompt injection

## Why XRON?

XRON is a lossless JSON compression format purpose-built for LLM context windows. It eliminates JSON's structural overhead (repeated keys, quotes, braces) while preserving exact data types — including `BigInt`, `Date`, and `null`.

### Token Reduction Benchmarks (BPE o200k_base)

| Dataset | JSON Tokens | XRON Tokens | Reduction |
|---------|------------:|------------:|----------:|
| 10 rows | 569 | 217 | **62%** |
| 100 rows | 5,681 | 1,646 | **71%** |
| 500 rows | 28,401 | 7,966 | **72%** |

At scale, this translates to **60-80% cost savings** on input tokens with zero information loss.

### Format Comparison (100-row, 7-field dataset)

| Format | Characters | vs JSON |
|--------|----------:|--------:|
| JSON (minified) | 13,569 | baseline |
| YAML | 13,467 | -1% |
| **XRON Level 3** | **2,714** | **-80%** |

## How It Works

XRON applies a 9-layer compression pipeline (schema extraction, positional streaming, dictionary encoding, type-aware encoding, column templates, substring dictionaries, delta compression, separator reduction, tokeniser alignment). The result is strictly lossless: `XRON.parse(XRON.stringify(data))` deep-equals the original, every time.

## Usage

```typescript
import { XRONOutputParser, XRONDocumentCompressor } from 'xron-llamaindex';

// Output Parser — parse XRON responses from LLMs
const parser = new XRONOutputParser();
const result = parser.parse(llmResponse);

// Document Compressor — compress RAG retrieval results
const compressor = new XRONDocumentCompressor();
const compressed = compressor.compressDocuments(docs);
// Fit 3-5x more context per query
```

## Tests

- 6 unit tests covering parse, code-fence stripping, format instructions, document compression, and metadata-free documents
- All tests pass with `vitest run`

## Links

- **npm**: [xron-format](https://www.npmjs.com/package/xron-format)
- **Repository**: [github.com/gordongeraghty/XRON](https://github.com/gordongeraghty/XRON)
- **Benchmarks**: [BENCHMARKS.md](https://github.com/gordongeraghty/XRON/blob/master/BENCHMARKS.md)
- **Format Specification**: [FORMAT_SPEC.md](https://github.com/gordongeraghty/XRON/blob/master/FORMAT_SPEC.md)
