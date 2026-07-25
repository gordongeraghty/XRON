# PR: Add XRON Compression Utilities for Vercel AI SDK

## Summary

This PR adds XRON compression utilities for the Vercel AI SDK, enabling developers to reduce LLM token costs by up to 80% when passing structured data in prompts.

Components:

- **`compressDataForPrompt()`** — compress any data array into an XRON string for prompt injection
- **`createXRONMessage()`** — create AI SDK-compatible message objects with XRON-compressed content
- **`xronMiddleware()`** — middleware that automatically compresses JSON array content in message streams

## Why XRON?

XRON is a lossless JSON compression format purpose-built for LLM context windows. It eliminates JSON's structural overhead (repeated keys, quotes, braces) while preserving exact data types — including `BigInt`, `Date`, and `null`.

### Token Reduction Benchmarks (BPE o200k_base)

| Dataset | JSON Tokens | XRON Tokens | Reduction |
|---------|------------:|------------:|----------:|
| 10 rows | 569 | 217 | **62%** |
| 100 rows | 5,681 | 1,646 | **71%** |
| 500 rows | 28,401 | 7,966 | **72%** |

At scale, this translates to **60-80% cost savings** on input tokens with zero information loss.

## Usage with Vercel AI SDK

```typescript
import { compressDataForPrompt } from 'xron-vercel';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const users = await fetchUsers();
const compressed = compressDataForPrompt(users, { level: 'auto' });

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: `Data:\n${compressed}\n\nHow many users are active?`,
});
```

### Message Middleware

```typescript
import { xronMiddleware } from 'xron-vercel';

const messages = [
  { role: 'system', content: JSON.stringify(largeDataset) },
  { role: 'user', content: 'Analyse this data' },
];

// Automatically compresses JSON array content
const compressed = xronMiddleware(messages);
```

## Tests

- Unit tests covering compression, message creation, and middleware round-trips
- All tests pass with `vitest run`

## Links

- **npm**: [xron-format](https://www.npmjs.com/package/xron-format)
- **Repository**: [github.com/gordongeraghty/XRON](https://github.com/gordongeraghty/XRON)
- **Benchmarks**: [BENCHMARKS.md](https://github.com/gordongeraghty/XRON/blob/master/BENCHMARKS.md)
- **Format Specification**: [FORMAT_SPEC.md](https://github.com/gordongeraghty/XRON/blob/master/FORMAT_SPEC.md)
