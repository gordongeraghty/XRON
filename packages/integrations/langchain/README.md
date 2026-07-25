# xron-langchain

XRON integration for [LangChain](https://js.langchain.com/) — output parser and document compressor for token-efficient LLM interactions.

## Installation

```bash
npm install xron-langchain xron-format @langchain/core
```

## Usage

### Output Parser

Parse XRON-formatted LLM responses back into JavaScript objects:

```typescript
import { XRONOutputParser } from 'xron-langchain';
import { ChatOpenAI } from '@langchain/openai';

const parser = new XRONOutputParser();
const model = new ChatOpenAI();

const chain = model.pipe(parser);
const result = await chain.invoke('List three users as XRON');
// Returns parsed JavaScript objects
```

### Document Compressor

Compress retrieved documents into XRON format before passing to an LLM, reducing token usage by up to 80%:

```typescript
import { XRONDocumentCompressor } from 'xron-langchain';

const compressor = new XRONDocumentCompressor();
const docs = [
  new Document({ pageContent: 'Alice works in Sales', metadata: { id: 1 } }),
  new Document({ pageContent: 'Bob works in Engineering', metadata: { id: 2 } }),
];

const compressed = await compressor.compressDocuments(docs, 'team members');
// Returns a single Document with XRON-encoded content
```

## API

### `XRONOutputParser`

Extends `BaseOutputParser`. Parses XRON strings (with automatic markdown code fence stripping) into JavaScript objects.

### `XRONDocumentCompressor`

Extends `BaseDocumentCompressor`. Compresses an array of `Document` objects into a single XRON-encoded document.

## Licence

MIT
