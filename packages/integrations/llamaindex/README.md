# xron-llamaindex

XRON integration for [LlamaIndex.TS](https://ts.llamaindex.ai/) — reduce LLM token costs by up to 80% on structured data.

## Install

```bash
npm install xron-llamaindex xron-format llamaindex
```

## Usage

### Output Parser

Parse XRON-formatted LLM responses back into JavaScript objects:

```typescript
import { XRONOutputParser } from 'xron-llamaindex';

const parser = new XRONOutputParser();

// Add format instructions to your prompt
const prompt = parser.format('List all employees by department');

// Parse the XRON response
const result = parser.parse(llmResponse);
```

### Document Compressor

Compress retrieved documents before injecting into LLM context:

```typescript
import { XRONDocumentCompressor } from 'xron-llamaindex';

const compressor = new XRONDocumentCompressor();
const docs = [
  { text: 'Alice works in Sales', metadata: { id: 1 } },
  { text: 'Bob works in Engineering', metadata: { id: 2 } },
];

const compressed = compressor.compressDocuments(docs);
// compressed.text contains XRON-encoded data (up to 80% fewer tokens)
```

## License

MIT
