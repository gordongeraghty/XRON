# xron-vercel

XRON integration for [Vercel AI SDK](https://sdk.vercel.ai/) — compress data in LLM messages for up to 80% token reduction.

## Installation

```bash
npm install xron-vercel xron-format ai
```

## Usage

### Compress Data for Prompts

```typescript
import { compressDataForPrompt } from 'xron-vercel';

const products = [
  { id: 1, name: 'Widget', price: 9.99, category: 'Tools' },
  { id: 2, name: 'Gadget', price: 19.99, category: 'Tools' },
];

const compressed = compressDataForPrompt(products);
// Use directly in your prompt template
```

### Create XRON Messages

```typescript
import { createXRONMessage } from 'xron-vercel';
import { generateText } from 'ai';

const systemMsg = createXRONMessage('system', products, { level: 2 });

const { text } = await generateText({
  model: yourModel,
  messages: [
    systemMsg,
    { role: 'user', content: 'Which product is cheapest?' },
  ],
});
```

### Middleware

Automatically compress JSON array content in messages:

```typescript
import { xronMiddleware } from 'xron-vercel';

const messages = [
  { role: 'system', content: JSON.stringify(largeDataset) },
  { role: 'user', content: 'Summarise this data' },
];

const compressed = xronMiddleware(messages);
// The system message content is now XRON-encoded
```

## API

### `compressDataForPrompt(data, options?)`

Compress an array into an XRON string for prompt injection.

### `createXRONMessage(role, data, options?)`

Create a Vercel AI SDK compatible message with XRON-compressed content.

### `xronMiddleware(messages, options?)`

Intercept messages and compress any JSON array content into XRON format.

### Options

- `level`: Compression level — `1`, `2`, `3`, or `'auto'` (default: `'auto'`)

## Licence

MIT
