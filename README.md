# XRON: Extensible Reduced Object Notation

**Lossless data serialization achieving up to ~80% token reduction for LLM contexts.**

[![npm version](https://img.shields.io/npm/v/xron-format.svg)](https://www.npmjs.com/package/xron-format)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/github/actions/workflow/status/gordongeraghty/XRON/ci.yml?label=tests)](https://github.com/gordongeraghty/XRON/actions)

---

## The XRON Ecosystem

| Package | Purpose | Installation |
|---------|---------|--------------|
| [`xron-format`](packages/format) | Core serialization library | `npm install xron-format` |
| [`xron-mcp`](packages/mcp) | Automatic MCP compression proxy | `npm install -g xron-mcp` |
| [`xron-cli`](packages/cli) | CLI tool for file-level compression | `npm install -g xron-cli` |
| [`xron-skill`](packages/skill) | Agent skill for AI assistants | (Integrated with Antigravity) |

---

## The Problem: JSON's Token Tax

Every time you send structured data to an LLM, JSON imposes significant token overhead:

- **Repeated keys**: `{"name":"Alice","name":"Bob","name":"Carol"}` -- the key `"name"` is paid for on every single object.
- **Structural punctuation**: Braces `{}`, brackets `[]`, colons `:`, and quotes `"` each consume a BPE token. A 500-row JSON array consumes thousands of additional tokens on syntax alone.
- **No compression**: Repeated values like `"Engineering"` appearing 50 times cost the same 50 times.
- **No numeric awareness**: Sequential IDs `1, 2, 3, ... 500` are encoded verbatim, even though the pattern is trivially compressible.

For a typical 500-user dataset, JSON consumes **~4,200 tokens**. At $15/MTok (GPT-4o output pricing), that is $0.063 per query. These tokens also consume context window space that could hold actual instructions or conversation history.

## The Solution: XRON's 9-Layer Compression Pipeline

XRON is a lossless serialization format purpose-built for LLM token efficiency. It applies nine progressive compression layers:

| Layer | Technique | What It Eliminates |
|-------|-----------|-------------------|
| L1 | Schema extraction | Repeated property keys |
| L2 | Positional streaming | All key tokens in tabular data |
| L3 | Dictionary encoding | Repeated string values |
| L4 | Type-aware encoding | Verbose booleans, nulls, dates, UUIDs |
| L5 | Column templates | Common prefix/suffix in column values |
| L6 | Substring dictionary | Repeated substrings across unique values |
| L7 | Delta + repeat compression | Sequential numbers, repeated values |
| L8 | Separator reduction | Field separator overhead (tab vs comma-space) |
| L9 | Tokenizer alignment | Suboptimal BPE token boundaries |

The result: `XRON.parse(XRON.stringify(data))` deep-equals the original data, while using 60-80% fewer tokens.

---

## 🛡️ Zero-Hallucination & Lossless Guarantee

Because XRON targets LLMs, a common concern is the "hallucination" of data during compression or decompression. 

**XRON is an algorithmic encoder, not an LLM summarizer.** It never drops, hallucinates, or estimates data.
- **Strictly Lossless:** The exact data type topology (including native Javascript `BigInt` arrays and primitive permutations) is structurally identical via `XRON.parse(XRON.stringify(data))` assertion logic.
- **Generative CI Testing:** XRON's CI/CD pipeline uses property-based generative testing (using randomly nested payloads of variable keys, `Date`, `BigInt`, floats, and Unicode strings) to simulate intense chaos. Hundreds of randomized edge cases are automatically compressed and decompressed on every commit to mathematically isolate and guarantee zero hallucination drops.
- **Native BigInt Support:** XRON dynamically manages integer precision via Level 3 BigInt Delta calculation heuristics out-of-the-box. Sequential `BigInt` columns (e.g. `9999999999999999999n`) compress smoothly (`+1`) without Javascript math degradation.

---

## Quick Start

### Installation

```bash
# To use the library in your code:
npm install xron-format

# To use the CLI tool:
npm install -g xron-cli

# To use the MCP compression proxy:
npm install -g xron-mcp
```

### Basic Usage

```typescript
import { XRON } from 'xron-format';

const data = [
  { id: 1, name: 'Alice', dept: 'Sales' },
  { id: 2, name: 'Bob', dept: 'Engineering' },
  { id: 3, name: 'Carol', dept: 'Sales' },
];

// Serialize to XRON (Level 2 by default)
const xron = XRON.stringify(data);
// Output:
// @v2
// @S A: id, name, dept
// @D: Sales
// @N3 A
// 1, Alice, $0
// 2, Bob, Engineering
// 3, Carol, $0

// Parse back to objects (lossless round-trip)
const restored = XRON.parse(xron);
// restored deep-equals data

// Analyze compression metrics
const stats = await XRON.analyze(data);
// { inputTokens: 85, outputTokens: 28, reduction: 67, ... }
```

### Adaptive Mode (Recommended)

Let XRON automatically pick the optimal compression level based on your data:

```typescript
// Auto mode: analyses data and picks the best level
const xron = XRON.stringify(data, { level: 'auto' });

// Auto with threshold: skip compression for tiny payloads
const xron = XRON.stringify(data, { level: 'auto', minCompressSize: 150 });

// Understand why a level was chosen (sync, no serialization)
const rec = XRON.recommend(data);
console.log(rec.recommendedLevel);  // 3
console.log(rec.reason);            // "Full compression stack beneficial..."
```

**Guarantees in auto mode:**
- **Always lossless**: `XRON.parse(XRON.stringify(data, { level: 'auto' }))` deep-equals the original.
- **Never worse than JSON**: If XRON output would be larger than `JSON.stringify`, auto returns raw JSON instead. You never pay an overhead penalty.

---

## Compression Levels

XRON supports three compression levels, selectable via the `level` option. Each level builds on the previous one.

### Level 1: Human-Readable (~60% reduction)

Uses full schema names. No dictionary encoding, no delta compression. Output is easy for humans to read and edit.

```typescript
const output = XRON.stringify(data, { level: 1 });
```

```
@v1
@S Item: id, name, dept
@N3 Item
1, Alice, Sales
2, Bob, Engineering
3, Carol, Sales
```

**What Level 1 does:** Extracts schemas from repeated object shapes and streams values positionally, eliminating all repeated key tokens. Strings are unquoted when safe. Full (human-readable) schema names are used.

### Level 2: Compact (~70% reduction)

Adds short single-letter schema names, dictionary encoding for repeated values, compact booleans (`true` becomes `1`, `false` becomes `0`), compact nulls (`null` becomes `-`), and compact date encoding.

```typescript
const output = XRON.stringify(data, { level: 2 });
```

```
@v2
@S A: id, name, dept
@D: Sales
@N3 A
1, Alice, $0
2, Bob, Engineering
3, Carol, $0
```

**What Level 2 adds:** The dictionary `@D: Sales` maps the repeated value "Sales" to `$0`. Booleans become `1`/`0` (with `?b` type hints on schema fields to ensure lossless parsing). Null becomes `-`. ISO dates like `2026-04-01` become `20260401`.

### Level 3: Maximum (~80% reduction)

Adds column templates (`@T`), substring dictionary (`@P`), delta encoding for sequential numeric columns, repeat markers (`~`) for consecutive identical values, tab separators, and Base62 UUID compression.

```typescript
const records = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  name: `User${i + 1}`,
  email: `user${i + 1}@example.com`,
  score: (i + 1) * 10,
}));

const output = XRON.stringify(records, { level: 3 });
```

```
@v3
@S A: id, name, email, score
@T 2: user{}@example.com
@N5 A
1	User1	1	10
+1	User2	+1	+10
+1	User3	+1	+10
+1	User4	+1	+10
+1	User5	+1	+10
```

**What Level 3 adds:** Column templates (`@T`) detect common prefix/suffix patterns — in this example, all emails match `user{}@example.com`, so only the variable part (`1`, `2`, etc.) is stored. Substring dictionaries (`@P`) extract repeated substrings shared across otherwise-unique values. The `id` column is delta-encoded as `+1` after the first row (since each ID increments by 1). The `score` column is also delta-encoded as `+10`. If consecutive rows share the same value in a non-delta column, that value is replaced with `~` (repeat marker). Tab separators replace `, ` to save one character per field boundary. UUIDs like `550e8400-e29b-41d4-a716-446655440000` are compressed to `^` plus a Base62 string (~22 characters instead of 36).

---

## Payload Size Categories & Expected Behaviour

XRON classifies payloads by their JSON-serialized byte size. The adaptive mode (`level: 'auto'`) uses these categories to decide what compression is worthwhile.

| Category | JSON Size | Typical Data | Auto Behaviour | Expected Savings |
|----------|-----------|-------------|----------------|------------------|
| **Tiny** | < 150 B | Single config object, 1-2 items | Returns raw JSON (headers cost more than they save) | 0% (no overhead) |
| **Small** | 150 B – 500 B | 3-10 item array, shallow config | Level 1 (schema only, no dict/delta) | 10-30% |
| **Medium** | 500 B – 5 KB | 10-50 item array with some repetition | Level 2 (schema + dictionary) | 30-55% |
| **Large** | 5 KB – 50 KB | 50-500 item array, API responses | Level 2 or 3 (full stack when delta applies) | 55-70% |
| **Very Large** | > 50 KB | 500+ item datasets, bulk exports | Level 3 (all layers activate) | 65-80% |

### What each threshold means

- **< 150 B**: The `@v1` header line alone is 4 bytes. Add a schema line (`@S A: id, name` = ~15 bytes) and you've consumed 19 bytes of overhead. On a 50-byte payload that overhead wipes out any savings, so auto returns `JSON.stringify` instead.

- **150-500 B**: Schema extraction can eliminate repeated keys, but the dictionary `@D` header often costs more than it saves (few repeated values in small datasets). Level 1 is the sweet spot.

- **500 B+**: With more than ~10 rows, key elimination amortizes well. Repeated string values (department names, status codes) start appearing enough to justify a dictionary. Level 2 activates.

- **5 KB+**: Datasets large enough for delta patterns (sequential IDs, incrementing timestamps) to emerge. Level 3's `+1` notation on an ID column saves ~2 chars per row across hundreds of rows.

### How auto decides

```
Is data < 150 bytes (or < minCompressSize)?
  YES → return JSON.stringify (no XRON overhead)
  NO  ↓

Are there ≥2 objects sharing the same shape?
  NO  → Level 1 (schema headers still provide some key savings)
  YES ↓

Are there repeated string values worth a dictionary?
  NO  → Are there sequential numeric columns?
          YES → Level 3 (schema + delta, skip dictionary)
          NO  → Level 1 (higher levels add nothing)
  YES ↓

Are there sequential numeric columns?
  YES → Level 3 (full compression stack)
  NO  → Level 2 (schema + dictionary)

Finally: is the XRON output actually smaller than JSON?
  NO  → return JSON.stringify (never worse guarantee)
  YES → return XRON output
```

### Configuring the threshold

```typescript
// Skip XRON for payloads under 200 bytes
XRON.stringify(data, { level: 'auto', minCompressSize: 200 });

// Always compress (even tiny data — uses XRON format, may be larger than JSON for tiny payloads)
XRON.stringify(data, { level: 2 }); // Fixed levels always compress
```

> **Note**: `minCompressSize` only applies to `level: 'auto'`. Fixed levels (1, 2, 3) always produce XRON output regardless of payload size. Even with a fixed level, the library naturally skips layers that don't help (e.g., dictionary encoding is omitted when no repeated values exist, delta encoding is omitted when no sequential columns exist).

---

## API Reference

### `XRON.stringify(value, options?): string`

Serialize any JavaScript value to XRON format.

```typescript
function stringify(value: any, options?: XronOptions): string;
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `any` | -- | The value to serialize. Objects, arrays, primitives, and nested structures are all supported. |
| `options.level` | `1 \| 2 \| 3 \| 'auto'` | `2` | Compression level. `'auto'` analyses the data and picks the optimal level (recommended for most use cases). |
| `options.minCompressSize` | `number` | `0` | Minimum JSON byte size before XRON compression is attempted. Only applies when `level` is `'auto'`. Payloads below this threshold are returned as `JSON.stringify`. Recommended: `150`. |
| `options.tokenizer` | `'o200k_base' \| 'cl100k_base' \| 'claude'` | `'o200k_base'` | BPE tokenizer profile for Level 3 optimization. |
| `options.indent` | `number` | `2` | Indentation width for Level 1 nested objects. |
| `options.maxDictSize` | `number` | `256` | Maximum dictionary entries (Level 2+). |
| `options.deltaThreshold` | `number` | `3` | Minimum rows required before delta encoding activates. |
| `options.minDictValueLength` | `number` | `2` | Minimum string length for dictionary inclusion. |
| `options.minDictFrequency` | `number` | `2` | Minimum occurrence count for dictionary inclusion. |

**Returns:** An XRON-formatted string (or raw JSON when `level: 'auto'` determines XRON would be larger).

**Guarantees (auto mode):**
- Output is always lossless: `XRON.parse(result)` deep-equals the original value.
- Output is never larger than `JSON.stringify(value)`.

**Throws:**
- `TypeError` if the value contains circular references.
- `TypeError` if the value contains `BigInt` values.

---

### `XRON.parse(input): any`

Parse an XRON string back to a JavaScript value. Lossless round-trip guaranteed.

```typescript
function parse(input: string): any;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | An XRON-formatted string. |

**Returns:** The deserialized JavaScript value.

**Throws:**
- `TypeError` if the input is not a string.
- `Error` if an unknown schema is referenced.

---

### `XRON.analyze(value, options?): Promise<XronAnalysis>`

Analyze compression metrics for a given value. Reports token counts at each level and overall reduction percentage.

```typescript
function analyze(value: any, options?: XronOptions): Promise<XronAnalysis>;
```

**Returns:** An `XronAnalysis` object:

```typescript
interface XronAnalysis {
  inputTokens: number;     // Token count for JSON.stringify output
  outputTokens: number;    // Token count for XRON output at chosen level
  reduction: number;       // Percentage reduction (0-100)
  schemas: number;         // Number of schemas extracted
  dictEntries: number;     // Number of dictionary entries
  deltaColumns: number;    // Number of delta-encoded columns
  breakdown: {
    level1Tokens: number;  // Tokens at Level 1
    level2Tokens: number;  // Tokens at Level 2
    level3Tokens: number;  // Tokens at Level 3
  };
}
```

---

### `XRON.recommend(value, options?): XronRecommendation`

Synchronously analyses the data and returns a compression recommendation without actually serializing. Useful for understanding what auto mode would do, displaying compression advice to users, or making informed decisions about which level to use.

```typescript
function recommend(value: any, options?: XronOptions): XronRecommendation;
```

**Returns:** An `XronRecommendation` object:

```typescript
interface XronRecommendation {
  recommendedLevel: 1 | 2 | 3;        // The level auto would pick
  reason: string;                       // Human-readable explanation
  willCompress: boolean;                // false if below minCompressSize
  skipReason?: string;                  // Why compression was skipped (when willCompress=false)
  characteristics: {
    jsonSize: number;                   // JSON.stringify byte size
    distinctSchemas: number;            // Unique object shapes found
    repeatingSchemaInstances: number;   // Instances of shapes appearing 2+ times
    hasRepeatingSchemas: boolean;       // Whether schema extraction will help
    dictionaryPotential: number;        // Entries that would qualify for @D
    hasBeneficialDictionary: boolean;   // Whether dictionary saves more than it costs
    hasDeltaColumns: boolean;           // Whether sequential numeric columns exist
    estimatedReduction: {               // Char-based reduction estimates per level
      level1: number;
      level2: number;
      level3: number;
    };
  };
  caveats: string[];                    // Known limitations of the recommendation
}
```

**Example:**

```typescript
// Large tabular data
const rec = XRON.recommend(users500);
// rec.recommendedLevel = 3
// rec.reason = "Full compression stack beneficial: schemas + dictionary + delta..."
// rec.characteristics.hasRepeatingSchemas = true
// rec.characteristics.hasBeneficialDictionary = true
// rec.characteristics.hasDeltaColumns = true

// Single config object
const rec = XRON.recommend({ host: 'localhost', port: 3000 });
// rec.recommendedLevel = 1
// rec.reason = "Payload is very small (31B). Level 1 adds minimal overhead..."
```

---

## Format Specification

An XRON document consists of a header section followed by a data section. All headers are prefixed with `@`.

### `@v` -- Version Header

Declares the compression level of the document.

```
@v1    Level 1 (human-readable)
@v2    Level 2 (compact)
@v3    Level 3 (maximum)
```

### `@S` -- Schema Definition

Defines a named schema with an ordered list of field names. At Level 2+, schemas use short single-letter names (A, B, C, ..., Z, A0, B0, ...).

```
@S User: id, name, email            Level 1 (full names)
@S A: id, name, email               Level 2+ (short names)
@S A: id, name, email, active?b     Level 2+ with boolean type hint
```

**Type hints** are appended to field names for lossless round-tripping:

| Suffix | Type | Purpose |
|--------|------|---------|
| `?b` | boolean | Distinguishes `1`/`0` as `true`/`false` vs. numbers |
| `?n` | number | Explicit numeric field |
| `?s` | string | Explicit string field |

Type hints are only emitted when needed for disambiguation (primarily `?b` for boolean fields at Level 2+ where booleans are encoded as `1`/`0`).

### `@D` -- Dictionary

Defines a lookup table of repeated string values. Values are referenced in data rows as `$0`, `$1`, `$2`, etc.

```
@D: Sales, Engineering, Marketing
```

A value appearing as `$0` in a data row resolves to `"Sales"`, `$1` to `"Engineering"`, and so on. Dictionary entries that contain commas are quoted:

```
@D: "New York, NY", "Los Angeles, CA"
```

### `@N` -- Cardinality Guard

Declares how many data rows follow for a given schema. This enables the parser to validate completeness and supports streaming.

```
@N5 A        5 rows of schema A follow
@N100 User   100 rows of schema User follow
```

### `@T` -- Column Template

Defines a prefix/suffix pattern for a column. Values in that column are stored as the variable part only. The `{}` placeholder marks where the variable portion sits within the template.

```
@T 2: user{}@example.com    ← column 2 follows this pattern
```

Data rows for column 2 then contain only the variable part (e.g., `alice` instead of `alice@example.com`). The parser reconstructs the full value by inserting the stored part into the template.

### `@P` -- Substring Dictionary

Like `@D` but for substrings within values. Repeated substrings that appear across otherwise-unique values are extracted into a shared dictionary. References use the `%N;` format, where `N` is the zero-based dictionary index.

```
@P: @example.com            ← shared substring
user1%0;                     ← %0; expands to @example.com
user2%0;                     ← same expansion
```

Substring dictionaries are built when full-value dictionary encoding (`@D`) does not apply — i.e., the values are unique but share common fragments.

### Delta Encoding (`+N`)

At Level 3, numeric columns with sequential patterns are delta-encoded. After the first absolute value, subsequent values are expressed as deltas from the previous row:

```
1, Alice, 50000       First row: absolute values
+1, Bob, +1000        id incremented by 1, salary incremented by 1000
+1, Carol, +1000      Same deltas
```

Negative deltas use standard negative notation: `-5` means "subtract 5 from the previous value."

### Repeat Encoding (`~`)

At Level 3, when a non-delta column has the same value as the previous row, it is replaced with `~`:

```
1, Alice, Sales
+1, Bob, ~            dept is same as previous row ("Sales")
+1, Carol, Engineering
```

### Nested Schema References (`Schema(val1, val2)`)

When an object field consistently contains objects matching another schema, nested values are encoded inline using parenthesized notation:

```
@S A: id, name, address
@S B: street, city, zip
@N2 A
1, Alice, B(123 Main, NYC, 10001)
2, Bob, B(456 Oak, LA, 90001)
```

---

## Benchmarks & Format Comparison

### Side-by-Side: 10-Row Employee Table

The same 10 employees (id, name, email, department, active) encoded in every format:

**JSON (minified)** — 956 chars
```json
[{"id":1,"name":"Alice Johnson","email":"alice@example.com","department":"Sales","active":true},{"id":2,"name":"Bob Smith","email":"bob@example.com","department":"Engineering","active":false},...]
```

**TOON** — 560 chars (41% smaller)
```
[10]:
  - id, name, email, department, active
  1, Alice Johnson, alice@example.com, Sales, true
  2, Bob Smith, bob@example.com, Engineering, false
  3, Carol Williams, carol@example.com, Sales, true
  ...
```

**TRON** — 559 chars (42% smaller)
```
class A: id, name, email, department, active
A 1, Alice Johnson, alice@example.com, Sales, true
A 2, Bob Smith, bob@example.com, Engineering, false
A 3, Carol Williams, carol@example.com, Sales, true
...
```

**XRON Level 1** — 557 chars (42% smaller)
```
@v1
@S Entity: id, name, email, department, active
@N10 Entity
1, Alice Johnson, alice@example.com, Sales, true
2, Bob Smith, bob@example.com, Engineering, false
3, Carol Williams, carol@example.com, Sales, true
...
```

**XRON Level 2** — 487 chars (49% smaller) ← *dictionary encoding kicks in*
```
@v2
@S A: id, name, email, department, active?b
@D: Engineering, Sales, Marketing
@N10 A
1, Alice Johnson, alice@example.com, $1, 1
2, Bob Smith, bob@example.com, $0, 0
3, Carol Williams, carol@example.com, $1, 1
...
```

**XRON Level 3** — 495 chars (48% smaller) ← *delta + repeat encoding*
```
@v3
@S A: id, name, email, department, active?b
@D: Engineering, Sales, Marketing
@N10 A
1, Alice Johnson, alice@example.com, $1, 1
+1, Bob Smith, bob@example.com, $0, 0
+1, Carol Williams, carol@example.com, $1, 1
+1, Dave Brown, dave@example.com, $0, ~
...
```

> **Note**: At 10 rows, TOON and TRON perform similarly to XRON L1 because key elimination is the dominant win. XRON L2 pulls ahead via dictionary encoding (`Sales` → `$1`), and L3 adds delta (`+1`) and repeat (`~`) markers. The gap increases with dataset size.

### At Scale: 100-Row Dataset (7 fields)

100 employees with id, name, email, department (5 values), active, salary, and joinDate:

| Format | Chars | vs JSON | vs TOON | vs TRON |
|--------|------:|--------:|--------:|--------:|
| JSON (pretty) | 18,370 | +35% | +154% | +154% |
| JSON (minified) | 13,569 | baseline | +88% | +88% |
| YAML | 13,467 | -1% | +86% | +86% |
| **TOON** | **7,232** | **-47%** | baseline | -0% |
| **TRON** | **7,230** | **-47%** | -0% | baseline |
| **XRON Level 1** | **7,049** | **-48%** | **-3%** | **-3%** |
| **XRON Level 2** | **5,367** | **-60%** | **-26%** | **-26%** |
| **XRON Level 3** | **2,714** | **-80%** | **-62%** | **-62%** |

Additional benchmarks:

| Dataset | Rows | Fields | JSON Chars | XRON L3 Chars | Reduction |
|---------|-----:|-------:|-----------:|--------------:|----------:|
| Employees | 100 | 7 | 13,569 | 2,714 | 80% |
| Employees | 500 | 5 | 52,840 | 12,682 | 76% |
| IoT sensors | 200 | 6 | 28,150 | 7,882 | 72% |

At 100 rows, XRON L3 is **62% smaller than TOON/TRON** — the gap comes from column templates, substring dictionaries, delta encoding, and separator reduction that neither TOON nor TRON have.

### What XRON Does That TOON and TRON Cannot

| Technique | TOON | TRON | XRON | What It Saves |
|-----------|:----:|:----:|:----:|---------------|
| Key elimination (schema headers) | ✅ | ✅ | ✅ | Repeated property names across N objects |
| Quote removal | ✅ | ✅ | ✅ | `"` around keys and simple values |
| Short schema names (A, B, C) | ❌ | ✅ | ✅ | `User` → `A` saves chars per row |
| Dictionary encoding (`$0`, `$1`) | ❌ | ❌ | ✅ | `"Engineering"` × 20 → `$0` × 20 |
| Boolean compaction (`1`/`0`) | ❌ | ❌ | ✅ | `true`/`false` → `1`/`0` with lossless `?b` hint |
| Null compaction (`-`) | ❌ | ❌ | ✅ | `null` → `-` |
| Date compaction | ❌ | ❌ | ✅ | `"2026-04-01"` → `20260401` (no quotes, no hyphens) |
| UUID compression | ❌ | ❌ | ✅ | 36-char UUID → ~22-char Base62 |
| Delta encoding (`+1`) | ❌ | ❌ | ✅ | Sequential IDs: `1, 2, 3, ..., 100` → `1, +1, +1, ...` |
| Column templates (`@T`) | ❌ | ❌ | ✅ | `user1@example.com` → `1` with template `user{}@example.com` |
| Substring dictionary (`@P`) | ❌ | ❌ | ✅ | Repeated substrings across unique values → `%N;` refs |
| Repeat markers (`~`) | ❌ | ❌ | ✅ | Consecutive same values: `Sales, Sales` → `Sales, ~` |
| Separator reduction | ❌ | ❌ | ✅ | Tab separators at L3 save 1 char per field boundary |
| Cardinality guards (`@N`) | ❌ | ❌ | ✅ | `@N100 A` — parser knows row count upfront (streaming) |
| Adaptive level selection | ❌ | ❌ | ✅ | Auto-picks best level, returns JSON for tiny payloads |
| Multi-tokenizer profiles | ❌ | ❌ | ✅ | Optimises separators for o200k_base, cl100k_base, claude |

### Why the Gap Grows at Scale

At 10 rows, all three formats achieve ~42% reduction. The key-elimination layer is the dominant win, and all three have it. But as datasets grow:

- **Dictionary savings scale linearly with row count.** "Engineering" appearing 200 times at 11 chars each = 2,200 chars. `$0` × 200 = 600 chars. Net saving: 1,600 chars. TOON and TRON pay the full 2,200 every time.

- **Delta savings scale linearly with row count.** A 500-row sequential ID column: JSON/TOON/TRON store `1, 2, 3, ..., 500` (varying lengths). XRON stores `1, +1, +1, ..., +1` — saving ~1,200 chars.

- **Boolean/null savings accumulate.** 500 × `true` = 2,000 chars. 500 × `1` = 500 chars. Saving: 1,500 chars.

- **XRON overhead is fixed.** The `@v2`, `@S`, `@D` headers cost ~50 chars regardless of dataset size. This fixed cost amortizes to near-zero on large datasets.

---

## How It Works

### Layer 1: Schema Extraction

Traverses the data with a depth-first search, collecting all object shapes (sets of property keys) and their frequencies. Shapes with 2+ properties appearing 2+ times are promoted to schemas. Schemas are sorted by frequency (most common first) and assigned sequential names (A, B, C, ...).

### Layer 2: Positional Value Streaming

For arrays where all items share the same schema, values are streamed in positional order matching the schema's field declarations. This eliminates every key token in the dataset -- converting O(N * K) key overhead to O(1) with a single schema definition.

### Layer 3: Dictionary Encoding

Scans all string values, counts frequencies, and builds a dictionary of repeated values sorted by savings potential (`frequency * estimated_token_savings`). Each entry is included only if its total savings exceed the header cost of listing it in the `@D` line. Values are replaced with `$index` references.

### Layer 4: Type-Aware Compact Encoding

Reduces verbose type representations:
- Booleans: `true` / `false` (5-6 chars, 1 token each) become `1` / `0` (1 char, still 1 token but saves BPE bytes in context)
- Null: `null` (4 chars) becomes `-` (1 char)
- Dates: `"2026-04-01"` (12 chars, ~4 tokens with quotes) becomes `20260401` (8 chars, ~2 tokens, no quotes)
- UUIDs: 36-character UUID becomes `^` + ~22-character Base62 string

### Layer 5: Column Templates

Detects columns where all values share a common prefix and/or suffix (e.g., email addresses like `user1@example.com`, `user2@example.com`). The shared pattern is declared once in an `@T` header, and data rows store only the variable portion. This eliminates the repeated prefix/suffix from every row.

### Layer 6: Substring Dictionary

Identifies repeated substrings that appear across otherwise-unique string values. Unlike full-value dictionary encoding (`@D`), which replaces entire values, substring dictionaries (`@P`) replace fragments within values using `%N;` references. Particularly effective for columns with structured but non-identical values (e.g., URLs, file paths, email addresses that don't share a uniform template).

### Layer 7: Delta + Repeat Compression

Analyzes numeric columns for sequential patterns. If deltas between consecutive values are constant or significantly smaller than absolute values, the column is delta-encoded. Non-delta columns with repeated consecutive values are replaced with `~` (same-as-previous) markers.

### Layer 8: Separator Reduction

Replaces the default comma-space (`, `) field separator with a tab character (`\t`) at Level 3. This saves one character per field boundary across every row. The parser auto-detects whether a document uses tab or comma-space separators, so both formats decode transparently.

### Layer 9: Tokenizer Alignment

Selects separators and layout characters that minimise token count for the target BPE tokenizer. Key choices:
- Newline (`\n`) as row separator: always 1 token
- Tab (`\t`) or comma-space (`, `) as field separator depending on level
- `@` as header prefix: 1 token in o200k_base, cl100k_base, and Claude tokenizers
- Parentheses for nesting: 1 token each

Supports `o200k_base` (GPT-4o/GPT-5), `cl100k_base` (GPT-4/GPT-3.5), and `claude` (Claude 3.x/4.x) tokenizer profiles.

---

## Comparison with Alternatives

| Feature | JSON | YAML | CSV | TOON | TRON | XRON |
|---------|------|------|-----|------|------|------|
| Lossless round-trip | Yes | Yes | No | Yes | Yes | Yes |
| Nested objects | Yes | Yes | No | Yes | Yes | Yes |
| Schema extraction | No | No | No | No | No | Yes |
| Dictionary encoding | No | No | No | No | No | Yes |
| Column templates | No | No | No | No | No | Yes |
| Substring dictionary | No | No | No | No | No | Yes |
| Delta compression | No | No | No | No | No | Yes |
| Separator reduction | No | No | No | No | No | Yes |
| Tokenizer alignment | No | No | No | No | No | Yes |
| Type-aware encoding | No | No | No | Partial | Partial | Yes |
| Token reduction | 0% | ~5% | ~40% | ~33% | ~50% | ~80% |
| Streaming-friendly | No | No | Yes | Yes | Yes | Yes |
| Human-readable | Yes | Yes | Yes | Yes | No | Level 1 |

**TOON** (Terse Object-Oriented Notation) strips JSON quotes and uses indentation but retains keys on every object. **TRON** (Terse Reduced Object Notation) adds columnar encoding but lacks dictionary, delta, and tokenizer optimizations. XRON builds on both with a full compression pipeline.

---

## Contributing

Contributions are welcome. To get started:

```bash
git clone https://github.com/gordongeraghty/XRON.git
cd xron-javascript
npm install
npm test
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build the package (ESM + CJS + types) |
| `npm test` | Run all tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run bench` | Run benchmarks |
| `npm run lint` | Type-check with TypeScript |

### Project Structure

```
src/
  index.ts              Main entry point, XRON namespace, analyze()
  stringify.ts           Serialization engine (9-layer pipeline orchestration)
  parse.ts              Deserialization engine (reverse pipeline)
  types.ts              Core type definitions and defaults
  pipeline/
    adaptive.ts         L0: Adaptive level selection (auto mode)
    schema.ts           L1: Schema extraction and matching
    positional.ts       L2: Positional value streaming
    dictionary.ts       L3: Dictionary building and reference encoding
    type-encoding.ts    L4: Type-aware compact encoding
    column-template.ts  L5: Column template detection and encoding
    substring-dict.ts   L6: Substring frequency analysis and encoding
    delta.ts            L7: Delta and repeat compression
    tokenizer-opt.ts    L8-L9: Separator reduction and tokenizer alignment
  format/
    header.ts           @v, @S, @D, @N header formatting and parsing
    escape.ts           String escaping and quoting rules
    separator.ts        Re-exports separator configuration
  utils/
    class-names.ts      Sequential schema name generator (A, B, ..., Z, A0, ...)
    token-counter.ts    Token counting (tiktoken or heuristic estimation)
    base62.ts           Base62 encoding/decoding for UUID compression
    date-compact.ts     Date compaction utilities
```

### Guidelines

- All changes must pass `npm test` (lossless round-trip tests are the primary correctness guarantee).
- New compression techniques should be added as new pipeline layers with clear entry/exit contracts.
- The format must remain human-readable at Level 1.
- Performance matters: the serializer should add minimal overhead beyond `JSON.stringify`.

---

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.4.0 (for development)
- **Optional**: `tiktoken` (>= 1.0.0) for exact token counting in `XRON.analyze()`. Without it, a built-in heuristic estimator is used.

---

## License

MIT -- see [LICENSE](LICENSE) for details.
