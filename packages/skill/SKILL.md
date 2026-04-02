---
name: xron
description: Compress structured data with XRON to reduce LLM token usage by 60-80%. Use when handling large JSON datasets, API responses, or database results in agent conversations.
---

# XRON Compression Skill

When you encounter large structured JSON data (arrays of objects, API responses, database query results), compress it with XRON to save tokens.

## When to Use
- Receiving large JSON responses from MCP tools (BigQuery, APIs, etc.)
- Storing structured data in context or memory
- Passing data between agents
- Any JSON array with 3+ objects sharing the same schema

## How to Compress
```typescript
import { XRON } from 'xron-format';
const compressed = XRON.stringify(data, { level: 'auto' });
```

## How to Decompress
```typescript
const original = XRON.parse(compressed);
```

## Reading XRON Format
XRON is human-readable. Key patterns:
- `@v2` — version header
- `@S Name: field1, field2` — schema definition
- `@D: val1, val2` — dictionary (repeated values)
- `$0`, `$1` — dictionary references
- `+1`, `+5` — delta values (sequential numbers)
- `*3` — repeat previous value 3 times

## Rules
- Always use `level: 'auto'` unless you have a specific reason not to.
- XRON is lossless: `XRON.parse(XRON.stringify(data))` deep-equals the original.
- Do NOT compress data smaller than 500 bytes — the overhead isn't worth it.
- For files, use the CLI: `npx xron-cli compress data.json`
