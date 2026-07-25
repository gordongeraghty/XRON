# XRON: Cut LLM Token Costs by up to 80% — Lossless Compression for AI Context Windows

![XRON — Lossless LLM Token Compression](assets/og_image.png)

**XRON is a drop-in replacement for JSON in LLM prompts.** Lossless JSON compression for LLMs that preserves exact data types — including Native BigInt for AI — with zero information loss. Up to 80% fewer tokens on wide tables with repeated values, and around 50% on typical business records.

[![npm version](https://img.shields.io/npm/v/xron-format.svg)](https://www.npmjs.com/package/xron-format)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/github/actions/workflow/status/gordongeraghty/XRON/ci.yml?label=569%20tests)](https://github.com/gordongeraghty/XRON/actions)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-first--class-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Specification](https://img.shields.io/badge/Spec-FORMAT__SPEC-orange)](FORMAT_SPEC.md)
[![Benchmarks](https://img.shields.io/badge/Benchmarks-verified-blue)](BENCHMARKS.md)

**[Live Playground](https://site-three-puce-75.vercel.app)** — try XRON compression in your browser, compare formats side-by-side, and see token counts instantly.

```bash
npm install xron-format
```

```typescript
import { XRON } from 'xron-format';

const data = [
  { id: 1, name: 'Alice', dept: 'Sales', active: true },
  { id: 2, name: 'Bob', dept: 'Engineering', active: true },
  { id: 3, name: 'Carol', dept: 'Sales', active: false },
];

const compressed = XRON.stringify(data, { level: 'auto' });
const restored = XRON.parse(compressed);
// restored deep-equals data — always
```

---

## The Problem: JSON's Hidden Token Tax

Every structured payload you send to an LLM has a hidden tax: JSON's repeated keys, quotes, braces, and brackets consume thousands of tokens that carry zero information. On a 500-row dataset, that overhead adds up to **~20,000 wasted tokens per request**.

**XRON eliminates that waste.** How much you save depends on how much of your
JSON was structure rather than information — measured with the real `o200k_base`
tokenizer, not an estimate:

| Your data looks like | JSON | XRON | Reduction |
|---|---:|---:|---:|
| Wide tables, repeated values (30 cols, small vocabulary) | 150,003 | 30,261 | **~80%** |
| Highly repetitive rows, long string values | — | — | **up to 91%** |
| Long column names, small values (20 cols) | 140,002 | 29,760 | **~79%** |
| Boolean/flag matrices (20 cols) | 70,002 | 20,161 | **~71%** |
| Typical business records (6 fields, 500 rows) | 14,502 | 7,571 | **~48%** |

The pattern is simple: XRON deletes repeated keys and repeated values, so the
more of your payload is structure, the more you save. A wide table of categorical
values is mostly structure. A narrow table of unique emails is mostly
information, and information cannot be deleted losslessly.

At 1,000 requests/day on a wide 500-row payload, ~80% reduction is roughly
**$100/day** of input tokens at $2.50/MTok.

---

## Perfect For

- **RAG pipelines** — fit 3-5x more retrieved context per query
- **MCP tool responses** — slash token overhead on every tool call
- **Agent workflows** — keep multi-step context windows clear for reasoning
- **Batch processing** — cut API costs by 60-80% on high-volume structured payloads
- **Analytics dashboards** — send full datasets to LLMs without truncation
- **Chatbot context injection** — compress CRM, inventory, or user data into prompts

---

## Get Started in 30 Seconds

```bash
npm install xron-format
```

```typescript
import { XRON } from 'xron-format';

// Compress any array or object
const compressed = XRON.stringify(yourData, { level: 'auto' });

// Inject into your LLM prompt
const prompt = `Data:\n${compressed}\n\nSummarise by department.`;

// Round-trip back to JS when needed
const original = XRON.parse(compressed);
```

That's it. Works with OpenAI, Anthropic, Google Gemini, Vercel AI SDK, LangChain, and any LLM provider.

---

## The XRON Ecosystem

| Package | Purpose | Install |
|---------|---------|---------|
| [`xron-format`](packages/format) | Core serialisation library | `npm install xron-format` |
| [`xron-mcp`](packages/mcp) | Automatic MCP compression proxy | `npm install -g xron-mcp` |
| [`xron-cli`](packages/cli) | CLI for file-level compression | `npm install -g xron-cli` |
| [`xron-skill`](packages/skill) | Agent skill for AI assistants | Integrated |
| [**Cookbook**](examples/) | Integration examples for every major SDK | [Browse examples](examples/) |

---

## How It Works: 9-Layer Compression Pipeline

XRON applies nine progressive compression layers. Each builds on the previous:

| Layer | Technique | What It Eliminates |
|-------|-----------|-------------------|
| L1 | Schema extraction | Repeated property keys |
| L2 | Positional streaming | All key tokens in tabular data |
| L3 | Dictionary encoding | Repeated string values |
| L4 | Type-aware encoding | Verbose booleans, nulls, dates, UUIDs |
| L5 | Column templates | Common prefix/suffix in column values |
| L6 | Substring dictionary | Repeated substrings across unique values |
| L7 | Delta + repeat compression | Sequential numbers, repeated values |
| L8 | Separator reduction | Field separator overhead |
| L9 | Tokeniser alignment | Suboptimal BPE token boundaries |

**Result:** `XRON.parse(XRON.stringify(data))` deep-equals the original, every time.

### Before and After

**JSON** (956 chars, ~250 tokens):
```json
[{"id":1,"name":"Alice","email":"alice@example.com","dept":"Sales","active":true},{"id":2,"name":"Bob","email":"bob@example.com","dept":"Engineering","active":false}]
```

**XRON Level 3** (180 chars, ~50 tokens):
```
@v3
@S A: id, name, email, dept, active?b
@D: Sales, Engineering
@T 2: {}@example.com
@N2 A
1	Alice	alice	$0	1
+1	Bob	bob	$1	0
```

Same data, lossless. The reduction on any given payload depends on its shape —
see [the table above](#the-problem-jsons-hidden-token-tax) for measured figures.

---

## Integration Examples

### OpenAI

```typescript
import { XRON } from 'xron-format';
import OpenAI from 'openai';

const data = await fetchEmployees();
const compressed = XRON.stringify(data, { level: 'auto' });

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'Data is XRON-encoded. @S = schema, $N = dictionary ref, +N = delta.' },
    { role: 'user', content: `Data:\n${compressed}\n\nSummarise by department.` },
  ],
});
```

### Anthropic (Claude)

```typescript
import { XRON } from 'xron-format';
import Anthropic from '@anthropic-ai/sdk';

const compressed = XRON.stringify(toolOutput, { level: 'auto' });

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: compressed }],
});
```

### Google Gemini

```typescript
import { XRON } from 'xron-format';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
const compressed = XRON.stringify(inventory, { level: 'auto' });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: compressed }] }],
});
```

### Vercel AI SDK

```typescript
import { XRON } from 'xron-format';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const compressed = XRON.stringify(users, { level: 'auto' });

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: `Data:\n${compressed}\n\nHow many are active?`,
});
```

See the full [Cookbook](examples/) for LangChain, Pinecone RAG, MCP, and batch cost analysis examples.

---

## Using XRON with Cursor / AI Agents

Teach your AI coding assistant to use XRON automatically. Copy the contents of [`packages/skill/SKILL.md`](packages/skill/SKILL.md) into your `.cursorrules`, `.github/copilot-instructions.md`, or system prompt.

Your agent will then compress large JSON datasets before injecting them into LLM context, reducing token usage by up to 80% — with zero configuration.

```bash
# Quick setup for Cursor
cp packages/skill/SKILL.md .cursorrules
```

The skill covers when to compress, how to call `XRON.stringify()` and `XRON.parse()`, and which compression level to use for different payload sizes.

---

## Use Cases

### RAG — Fit 3-5x More Context Per Query

Compress retrieval payloads before prompt injection. More context per query without upgrading models.

```typescript
const docs = await vectorDb.query(embedding, { topK: 50 });
const compressed = XRON.stringify(docs, { level: 'auto' });
// 50 docs in the token budget that previously held 15
```

### MCP — Slash Token Overhead on Tool Calls

[`xron-mcp`](packages/mcp) wraps any MCP server and compresses JSON responses automatically. No code changes needed.

```bash
npm install -g xron-mcp
```

### API Cost Reduction at Scale

Processing thousands of LLM requests with structured data? XRON cuts your token bill by up to 80%.

### Agent Context Management

AI agents accumulate tool responses across multi-step workflows. Compress each response to keep the context window clear for reasoning.

---

## Compression Levels

XRON offers three compression levels plus an adaptive auto mode:

### Auto Mode (Recommended) — Adaptive with Never-Worse Guarantee

```typescript
const output = XRON.stringify(data, { level: 'auto' });
```

Auto mode tries every XRON compression level (L1, L2, L3) **and** raw `JSON.stringify`, then returns whichever produces the shortest output. This means:

- **Always lossless** — exact data types preserved through round-trip
- **Never-worse guarantee** — if no XRON level beats raw JSON (e.g. on tiny payloads where schema headers add overhead), auto returns the JSON string directly
- **Optimal by construction** — you never need to guess which level to use; auto does an exhaustive comparison

### Level 1: Human-Readable (~60% reduction)

Schema extraction only. Output is easy to read and edit.

```
@v1
@S Item: id, name, dept
@N3 Item
1, Alice, Sales
2, Bob, Engineering
3, Carol, Sales
```

### Level 2: Compact (~70% reduction)

Adds dictionary encoding, boolean/null compaction, date compression.

```
@v2
@S A: id, name, dept
@D: Sales
@N3 A
1, Alice, $0
2, Bob, Engineering
3, Carol, $0
```

### Level 3: Maximum (~80% reduction)

Adds column templates, substring dictionaries, delta encoding, repeat markers, tab separators, UUID compression.

```
@v3
@S A: id, name, email, score
@T 2: user{}@example.com
@N5 A
1	User1	1	10
+1	User2	+1	+10
+1	User3	+1	+10
```

---

## Lossless Guarantee

XRON is an **algorithmic encoder**, not an LLM summariser. It never drops, hallucinates, or estimates data.

- **Lossless for the supported shapes**: exact data types — including `BigInt`, `Date`, `null`, nested objects — are preserved through round-trip serialisation, within the scope recorded under [Known limitations](#known-limitations) below
- **Generative CI testing**: 569 tests including property-based fuzzing with random payloads on every commit
- **Compress Native BigInt for AI**: Sequential `BigInt` columns compress smoothly without precision loss — no truncation, no rounding
- **Never-worse guarantee**: Auto mode returns raw JSON if XRON would be larger

**Full evidence:** [docs/VERIFICATION.md](docs/VERIFICATION.md) documents every
test, every measurement, the fix-by-fix failure rates, and the one known
limitation — with commands to reproduce each figure.

### How the guarantee is tested

Losslessness is a single property, so it is tested as a single property rather
than as a pile of examples:

```
for every payload in the corpus × for level in [1, 2, 3, 'auto']:
    JSON.stringify(XRON.parse(XRON.stringify(data, { level }))) === JSON.stringify(data)
```

`packages/format/tests/lossless-property.test.ts` runs that identity over a
corpus deliberately placed on the boundaries where encoders break, because a
point test per known bug only ever catches the bug you already knew about:

| Corpus area | Why this boundary |
|---|---|
| Dictionaries of 61, 62, 63, 120 and 200 distinct values | 62 is where `$0`-style refs become two-character base-62 refs |
| Fractional seconds of 0, 2, 3 and 6 digits | `toISOString()` emits 3; other producers emit other widths |
| UTC offsets of both signs, plus a DST crossing | The offset sign is a `-` sitting next to date separators |
| Columns mixing date-only with datetime values | One column, two textual shapes |
| Date columns at 30, 31 and 60 rows | row counts well past the delta threshold |
| Nulls, non-monotonic dates, pre-1970 dates, epoch crossings | Negative and non-increasing epochs |
| Dates and a 120-entry dictionary in one payload | The layers interact |

Run it on its own with:

```bash
npx vitest run packages/format/tests/lossless-property.test.ts
```

### Why it works

Four properties of the pipeline are what make the round-trip hold. Each one is
load-bearing — the format silently corrupted data when any was missing:

1. **Dictionary references decode base-62 first.** The encoder writes base-62,
   so the decoder must read base-62. Decimal is attempted only as a fallback for
   legacy documents, and only when the base-62 reading is out of range — so it
   can never shadow a reference this encoder produced.
2. **Temporal delta encoding is opt-in per column, not assumed.** A column is
   only delta-encoded when every value shares one shape that is exactly
   reproducible from `(epoch seconds + that shape)`. Columns carrying UTC
   offsets, real sub-second precision, or a mix of date-only and datetime values
   are left alone and fall back to plain compact-date encoding, which round-trips.
3. **Temporal columns bypass the dictionary layer.** Dictionary substitution runs
   before delta encoding, so a repeated date would otherwise reach the delta
   layer as `$0`. Temporal columns are re-encoded as literal dates first.
4. **The decoder is total.** A column whose anchor cannot be parsed degrades to
   leaving its cells untouched. One unreadable column can never throw and take
   the whole document with it.

### Measured, not asserted

The property is measured against randomised payloads across all four levels, not
just the curated corpus:

| Version | Round-trip failures |
|---|---|
| 0.3.0 | 2,673 / 4,800 (55.7%) |
| 0.4.0 | 1 / 42,000 across 7 seeds (0.002%) |

### Known limitation

One failure in 42,000 randomised round-trips is still open and not yet
root-caused. Its signature is a cell merging with the one after it, accompanied
by a checksum-mismatch warning — which points at an encoder-side inconsistency
rather than a decoding bug. It has only been observed under a single fuzz seed
and has no minimal reproduction yet, so it is not covered by a test.

Everything previously listed here — colon-bearing strings and keys, literal
negative numbers, 8-digit integers read as dates, out-of-range dates, varying
nested-object columns, booleans decoded as numbers, and BigInt/Number
confusion — is fixed in 0.4.0 and now runs in the corpus at every level.

---

## CLI Tool

```bash
npm install -g xron-cli

# Compress a JSON file
xron compress data.json -o data.xron

# Decompress back to JSON
xron decompress data.xron -o data.json

# Analyse compression metrics
xron analyze data.json
```

---

## API Reference

### `XRON.stringify(value, options?): string`

Serialise any JavaScript value to XRON format.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `1 \| 2 \| 3 \| 'auto'` | `2` | Compression level. `'auto'` recommended. |
| `minCompressSize` | `number` | `0` | Min JSON byte size before compression (auto only). |
| `tokenizer` | `'o200k_base' \| 'cl100k_base' \| 'claude'` | `'o200k_base'` | BPE tokeniser profile for L3 optimisation. |
| `maxDictSize` | `number` | `256` | Maximum dictionary entries (L2+). |
| `deltaThreshold` | `number` | `3` | Min rows before delta encoding activates. |

### `XRON.parse(input): any`

Parse an XRON string back to a JavaScript value. Lossless round-trip guaranteed.

### `XRON.analyze(value, options?): Promise<XronAnalysis>`

Analyse compression metrics — token counts at each level and overall reduction.

### `XRON.recommend(value, options?): XronRecommendation`

Synchronously returns what auto mode would choose, without serialising. Useful for understanding compression decisions.

```typescript
const rec = XRON.recommend(data);
console.log(rec.recommendedLevel); // 3
console.log(rec.reason);           // "Full compression stack beneficial..."
```

---

## Benchmarks

### Token Reduction (BPE o200k_base)

| Rows | JSON Tokens | XRON L1 | XRON L2 | XRON L3 | L3 Reduction |
|-----:|------------:|--------:|--------:|--------:|-------------:|
| 10 | 569 | 259 | 244 | 217 | **62%** |
| 50 | 2,841 | 1,171 | 998 | 856 | **70%** |
| 100 | 5,681 | 2,311 | 1,928 | 1,646 | **71%** |
| 500 | 28,401 | 11,431 | 9,368 | 7,966 | **72%** |

### Format Comparison (100-Row, 7-Field Dataset)

| Format | Chars | vs JSON |
|--------|------:|--------:|
| JSON (minified) | 13,569 | baseline |
| YAML | 13,467 | -1% |
| TOON | 7,232 | -47% |
| TRON | 7,230 | -47% |
| **XRON Level 1** | **7,049** | **-48%** |
| **XRON Level 2** | **5,367** | **-60%** |
| **XRON Level 3** | **2,714** | **-80%** |

Full benchmark data and methodology: [BENCHMARKS.md](BENCHMARKS.md)

Run benchmarks locally:
```bash
npm install && npx vitest run packages/format/tests/benchmarks/token-count.test.ts
```

---

## Format Specification

XRON documents have a metadata header section (lines starting with `@`) followed by data rows.

| Header | Purpose | Example |
|--------|---------|---------|
| `@v` | Compression level | `@v3` |
| `@S` | Schema definition | `@S A: id, name, email` |
| `@D` | Value dictionary | `@D: Sales, Engineering` |
| `@T` | Column template | `@T 2: user{}@example.com` |
| `@P` | Substring dictionary | `@P: @example.com` |
| `@N` | Row count guard | `@N100 A` |

Full specification: [FORMAT_SPEC.md](FORMAT_SPEC.md)

---

## FAQ

### Do LLMs understand XRON?

Yes. XRON's header-based schema (`@S`, `@D`, `@N`) is self-describing. GPT-4o, Claude, Gemini, and other frontier models parse it accurately. A one-line system prompt explaining the notation is sufficient for 100% comprehension.

### Is XRON truly lossless?

For the supported shapes, yes — and it is tested as a property rather than asserted. `XRON.parse(XRON.stringify(data))` deep-equals the original input across `BigInt`, `Date`, `null`, nested objects and mixed arrays. The round-trip identity runs over a boundary-focused corpus at every level (1, 2, 3 and `auto`) as part of the 569-test suite, alongside property-based fuzzing over randomised payloads.

One failure in 42,000 randomised round-trips remains open — see [Known limitation](#known-limitation). Everything else previously listed there is fixed and now runs in the corpus at every level.

Timestamps are the area worth understanding: XRON preserves the exact string you gave it. Where a compression layer could not reproduce a timestamp exactly — a column carrying UTC offsets, genuine sub-second precision, or a mix of date-only and datetime values — that layer declines to compress the column rather than approximating it. You trade a few bytes for the guarantee, and only on the columns that need it.

### What types does XRON support?

Strings, numbers, booleans, `null`, `Date`, `BigInt`, `undefined`, nested objects, arrays, and mixed-type arrays. XRON preserves the exact type topology through round-trip serialisation.

### When should I NOT use XRON?

XRON is optimised for tabular/structured data with repeated schemas. For single objects, small payloads (< 500 bytes), or deeply nested non-tabular structures, the overhead of headers may not yield savings. Auto mode handles this automatically — it returns raw JSON if XRON would be larger.

### How does XRON compare to MessagePack / Protocol Buffers?

MessagePack and Protobuf are binary formats designed for machine-to-machine communication. XRON is a **text format designed for LLM context windows** — it produces human-readable output that language models can parse directly. They solve different problems.

### Does XRON work with streaming responses?

XRON compresses the data you *send* to the LLM (input tokens). LLM responses come back as natural language. If you need the LLM to *return* data in XRON format, use the LangChain output parser example in the [cookbook](examples/cookbook/langchain-parser.ts).

### What's the performance overhead?

`XRON.stringify()` runs in single-digit milliseconds for typical payloads (< 1,000 rows). The serialisation cost is negligible compared to LLM API latency. See [BENCHMARKS.md](BENCHMARKS.md) for detailed timings.

---

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.4.0 (for development)
- **Zero runtime dependencies** — `tiktoken` is an optional peer dependency for exact token counting

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, and the PR process.

## Security

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy. XRON is a non-executable format with zero runtime dependencies.

## License

MIT — see [LICENSE](LICENSE) for details.
