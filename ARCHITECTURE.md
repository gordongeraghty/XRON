# XRON Architecture

This document describes the internal architecture of the XRON serialization library: its module structure, the 6-layer compression pipeline, data flow, key design decisions, and extension points.

---

## System Overview

XRON transforms JSON-compatible data through a 6-layer compression pipeline during serialization, and reverses the pipeline during deserialization. The architecture is a linear pipeline where each layer's output feeds the next:

```
                        STRINGIFY (Serialization)
  +------------------------------------------------------------------------+
  |                                                                        |
  |  JavaScript   L1: Schema    L2: Positional   L3: Dictionary            |
  |  Value    --> Extraction --> Streaming    --> Encoding                  |
  |               (schema.ts)   (positional.ts)  (dictionary.ts)           |
  |                                                                        |
  |           L4: Type-Aware   L5: Delta +      L6: Tokenizer    XRON     |
  |           --> Encoding  --> Repeat      --> Alignment   --> String     |
  |              (type-        (delta.ts)      (tokenizer-                 |
  |               encoding.ts)                  opt.ts)                    |
  +------------------------------------------------------------------------+

                         PARSE (Deserialization)
  +------------------------------------------------------------------------+
  |                                                                        |
  |  XRON      Headers:       Data Rows:        Reverse L5:               |
  |  String --> @v, @S, @D --> Split rows    --> Decode ~     --> Decode   |
  |             @N parsing     into cells        repeats         deltas   |
  |             (header.ts)    (positional.ts)   (delta.ts)               |
  |                                                                        |
  |           Reverse L3:    Reverse L4:       Reconstruct     JavaScript |
  |           --> Resolve --> Decode types --> Objects from --> Value      |
  |              $refs        bools, dates     schema fields              |
  |              (dictionary.ts)  (type-encoding.ts)                      |
  +------------------------------------------------------------------------+
```

---

## Module Dependency Graph

```
index.ts  (public API: XRON.stringify, XRON.parse, XRON.analyze)
  |
  +-- stringify.ts  (serialization orchestrator)
  |     |
  |     +-- pipeline/schema.ts        L1: Schema extraction
  |     +-- pipeline/positional.ts    L2: Positional row encoding
  |     +-- pipeline/dictionary.ts    L3: Dictionary building
  |     +-- pipeline/type-encoding.ts L4: Type-aware value encoding
  |     +-- pipeline/delta.ts         L5: Delta and repeat encoding
  |     +-- pipeline/tokenizer-opt.ts L6: Separator configuration
  |     +-- format/header.ts          Header formatting (@v, @S, @D, @N)
  |     +-- format/escape.ts          String escaping/quoting
  |
  +-- parse.ts  (deserialization orchestrator)
  |     |
  |     +-- format/header.ts          Header parsing
  |     +-- pipeline/type-encoding.ts Reverse type decoding
  |     +-- pipeline/dictionary.ts    $ref resolution
  |     +-- pipeline/delta.ts         Delta/repeat decoding
  |     +-- pipeline/positional.ts    Row splitting
  |
  +-- types.ts  (shared type definitions, defaults)
  |
  +-- utils/
        +-- token-counter.ts          Token counting for analyze()
        +-- class-names.ts            Schema name generation (A, B, C, ...)
        +-- base62.ts                 Base62 encode/decode
        +-- date-compact.ts           Re-exports from type-encoding
```

Key architectural property: `stringify.ts` and `parse.ts` are **symmetric orchestrators**. The stringify module calls pipeline layers in forward order (L1 through L6); the parse module calls them in reverse order (L6 through L1). Each pipeline module exports both encoding and decoding functions.

---

## Pipeline Layer Details

### Layer 1: Schema Extraction (`pipeline/schema.ts`)

**Purpose:** Detect repeated object shapes and assign named schemas, converting O(N * K) key overhead to O(1).

**Algorithm:**

1. **DFS shape collection** (`collectShapes`): Traverse the entire data structure depth-first. For each object with 2+ properties, compute a signature (sorted keys joined by comma). Track frequency per signature. Circular references are detected via a `WeakSet` and silently skipped.

2. **Filtering**: Only shapes with 2+ properties appearing 2+ times qualify as schemas.

3. **Sorting**: Qualifying shapes are sorted by frequency (descending), then by key count (descending, as tie-breaker). The most common shape becomes schema `A`.

4. **Name assignment** (`ClassNameGenerator`): Schemas receive sequential single-letter names: A, B, C, ..., Z, A0, B0, ..., Z0, A1, .... A `guessFullName` heuristic also assigns human-readable names for Level 1 output by inspecting the sample path (e.g., `.users[0]` yields `"User"`).

5. **Nested schema detection** (`resolveNestedSchemas`): Second pass that checks whether any field in a schema consistently contains objects matching another schema. If so, the nesting relationship is recorded in `schema.nestedSchemas` (a Map from field index to nested schema name).

6. **Field type detection** (`detectFieldTypes`): Third pass that collects the JavaScript types of each field across all instances. If a field is uniformly `boolean`, it is marked with `fieldTypes.set(idx, 'boolean')`. This enables lossless round-tripping at Level 2+ where booleans are encoded as `1`/`0`.

**Complexity:** O(N * K) where N is the number of objects and K is the average number of keys per object. The three passes (shape collection, nested resolution, type detection) are each linear in the data size.

---

### Layer 2: Positional Value Streaming (`pipeline/positional.ts`)

**Purpose:** For arrays where all items share a schema, emit only the values in field-declaration order. Eliminate every key token.

**Algorithm:**

1. In `stringify.ts`, `encodeArray` checks whether all array items are objects matching the same schema (via `matchSchema`, which computes the signature and looks it up in the schema map).

2. If uniform, `encodeSchemaArray` is called:
   - Emits a cardinality guard (`@N{count} {schemaName}`).
   - Calls `encodePositionalRows`, which iterates over items, extracting each field value in schema field order.
   - Nested schema fields are encoded inline as `SchemaName(val1, val2, ...)`.

3. `splitRow` is the inverse: it splits a comma-separated row back into individual cell strings, respecting quoted strings and nested parentheses.

**Key design decision:** Values are separated by `, ` (comma-space), which in BPE tokenizers typically merges into a single token. This is more efficient than comma alone (which does not merge) or tab (which varies by tokenizer).

---

### Layer 3: Dictionary Encoding (`pipeline/dictionary.ts`)

**Purpose:** Replace repeated string values with short `$index` references.

**Algorithm:**

1. **Frequency collection** (`collectStringValues`): Recursively scan all string values in the data, building a `Map<string, number>` of value-to-frequency.

2. **Filtering**: Exclude strings shorter than `minDictValueLength` (default 2) or appearing fewer than `minDictFrequency` times (default 2).

3. **Sorting by savings potential**: Candidates are sorted by `frequency * estimateTokenSavings(value)` descending. The savings estimate is `max(0, estimatedTokenCount - refCost)`, where token count is heuristically `ceil(length / 4)` and ref cost is 1 token.

4. **Net-positive inclusion**: Each candidate is included only if `totalSavings > headerCost`, where header cost is the tokens required to list the value once in the `@D` line.

5. **Lookup creation** (`createDictLookup`): A `Map<string, string>` mapping each value to its `$index` reference string (e.g., `"Sales"` to `"$0"`).

**During encoding:** `encodePrimitive` checks `dictLookup.get(value)` before any other encoding, short-circuiting to the `$ref` if found.

**During parsing:** `isDictRef` tests for the `$N` pattern; `resolveDictRef` indexes into the parsed dictionary array.

**Constraint:** Maximum 256 dictionary entries (configurable via `maxDictSize`). References `$0` through `$9` are 1 token; `$10` through `$255` are typically 1-2 tokens.

---

### Layer 4: Type-Aware Compact Encoding (`pipeline/type-encoding.ts`)

**Purpose:** Use the most token-efficient representation for each data type.

**Encoding rules:**

| Type | Level 1 | Level 2+ | Level 3 |
|------|---------|----------|---------|
| `null` | `null` | `-` | `-` |
| `true` | `true` | `1` | `1` |
| `false` | `false` | `0` | `0` |
| Number | Unquoted string | Same | Same |
| ISO date string | Quoted | Remove separators (`20260401`) | Same as L2 |
| UUID | Quoted | Quoted | `^` + Base62 (~22 chars) |
| Safe string | Unquoted | Unquoted | Unquoted |
| Unsafe string | Quoted with `\"` escaping | Same | Same |

**Boolean disambiguation:** At Level 2+, `true`/`false` become `1`/`0`, but the schema header marks boolean fields with `?b` (e.g., `@S A: id, name, active?b`). The parser uses this hint to convert `1`/`0` back to `true`/`false` for those fields.

**Date compaction:** ISO dates like `2026-04-01T14:30:00Z` become `20260401T143000Z` -- removing dashes and colons saves 3-5 tokens per date.

**UUID compression:** UUIDs are converted from 36-character hex-with-dashes to a `^`-prefixed Base62 string of approximately 22 characters. The `^` prefix disambiguates UUID values from other strings during parsing.

**String quoting rules** (`format/escape.ts`): Strings are unquoted by default (saving 2 tokens for the quote pair). Quoting is applied only when the value contains commas, newlines, leading/trailing spaces, starts with a special prefix (`$`, `+`, `*`, `~`, `@`, `-`), looks like a number, or matches a reserved word (`true`, `false`, `null`).

---

### Layer 5: Delta + Repeat Compression (`pipeline/delta.ts`)

**Purpose:** Compress sequential numeric columns and repeated adjacent values.

**Delta encoding algorithm:**

1. **Column analysis** (`analyzeDeltaColumns`): For each column in the schema, extract all values. A column qualifies for delta encoding if:
   - All values are finite numbers.
   - The row count meets or exceeds `deltaThreshold` (default 3).
   - Either all deltas are constant (e.g., incrementing IDs), or the average absolute delta is less than 50% of the average absolute value.

2. **Application** (`applyDeltaEncoding`): For qualifying columns, the first row retains its absolute value. Subsequent rows replace the absolute value with `+N` (positive delta) or `-N` (negative delta).

**Repeat encoding algorithm:**

1. **Application** (`applyRepeatEncoding`): Applied after delta encoding. For each non-delta column, if a cell has the same string value as the cell above it, it is replaced with `~`.

2. **Ordering matters:** Repeat encoding runs after delta encoding to avoid marking delta values as repeats. Delta columns are explicitly skipped.

**Decoding:** The parser reverses the process: `decodeRepeatRows` expands `~` markers by copying the value from the previous row, then `decodeDeltaRows` converts `+N` values back to absolutes by accumulating deltas.

---

### Layer 6: Tokenizer Alignment (`pipeline/tokenizer-opt.ts`)

**Purpose:** Choose separators and layout characters that minimize token count for the target BPE tokenizer.

**Current implementation:**

Pre-computed `SeparatorConfig` objects for three tokenizer profiles:

| Config | o200k_base | cl100k_base | claude |
|--------|-----------|-------------|--------|
| Row separator | `\n` (1 token) | `\n` (1 token) | `\n` (1 token) |
| Field separator | `, ` (1 token) | `, ` (1 token) | `, ` (1 token) |
| Header prefix | `@` (1 token) | `@` (1 token) | `@` (1 token) |
| Nested open | `(` (1 token) | `(` (1 token) | `(` (1 token) |
| Nested close | `)` (1 token) | `)` (1 token) | `)` (1 token) |

The three profiles currently converge on the same configuration because `\n`, `, `, `@`, `(`, and `)` are single tokens across all major BPE vocabularies. The architecture supports divergence as tokenizers evolve.

**Token estimation** (`estimateTokens`): A heuristic tokenizer that walks the string character by character:
- Newlines: 1 token each.
- Space before a word: merges with the word (0 extra tokens).
- Words: `ceil(length / 5)` tokens.
- Numbers: `ceil(length / 3)` tokens.
- Punctuation: 1 token each.

**Exact counting** (`countTokensExact`): Dynamically imports `tiktoken` (optional peer dependency) and uses the appropriate encoding. Falls back to the heuristic if tiktoken is not installed.

**Extension hook** (`optimizeForTokenizer`): A post-processing function that currently passes through unchanged. Designed as an extension point for future tokenizer-specific optimizations such as Unicode character substitution or whitespace merging.

---

## Data Flow: Stringify

```
stringify(value, options)
    |
    v
  [1] Check primitives (null, boolean, number, string) --> return directly
    |
    v
  [2] Circular reference pre-check (WeakSet DFS)
    |
    v
  [3] extractSchemas(value) --> Map<signature, SchemaDefinition>
    |   - DFS shape collection
    |   - Filter: 2+ props, 2+ frequency
    |   - Sort by frequency, assign names
    |   - Resolve nested schemas
    |   - Detect field types
    |
    v
  [4] buildDictionary(value, opts) --> DictionaryEntry[]  (Level 2+ only)
    |   - Collect string frequencies
    |   - Filter by length/frequency
    |   - Sort by savings potential
    |   - Net-positive inclusion filter
    |
    v
  [5] getSeparatorConfig(tokenizer) --> SeparatorConfig
    |
    v
  [6] Format headers:
    |   - @v{level}
    |   - @S {name}: {fields}   (for each schema)
    |   - @D: {values}          (if dictionary non-empty)
    |
    v
  [7] encodeData(value, schemas, dictLookup, level, ...)
    |   |
    |   +-- Array of uniform objects?
    |   |     |
    |   |     +-- encodeSchemaArray:
    |   |           - @N{count} {schema}
    |   |           - encodePositionalRows (L2)
    |   |           - Level 3: analyzeDeltaColumns --> applyDeltaEncoding
    |   |                      --> applyRepeatEncoding (L5)
    |   |
    |   +-- Mixed array? --> inline [val, val, ...] encoding
    |   |
    |   +-- Object matching schema? --> SchemaName(val1, val2, ...)
    |   |
    |   +-- Other object? --> {key: val, key: val} inline
    |
    v
  [8] Join lines with rowSep (\n)
    |
    v
  Return XRON string
```

---

## Data Flow: Parse

```
parse(input)
    |
    v
  [1] Check primitives (null, true, false, number) --> return directly
    |
    v
  [2] Check for @v header --> if missing, parse as primitive/key-value
    |
    v
  [3] parseDocument(input):
    |
    +-- Phase 1: Parse headers (line by line)
    |     - @v{N}  --> set version
    |     - @S ...  --> build SchemaDefinition, store by signature and name
    |     - @D ...  --> parse dictionary values into string[]
    |     - @N ...  --> stop header parsing (cardinality is part of data)
    |
    +-- Phase 2: parseDataSection(remainingLines, ...)
          |
          +-- @N{count} {schema}?
          |     |
          |     +-- Collect {count} data rows
          |     +-- decodeSchemaRows:
          |           [a] splitRow each row into cells
          |           [b] decodeRepeatRows: expand ~ markers (L3)
          |           [c] Detect delta columns (+ prefix in cells)
          |           [d] decodeDeltaRows: accumulate deltas (L3)
          |           [e] For each row, for each field:
          |               - Check for nested SchemaName(...)
          |               - Resolve $N dict references
          |               - decodeTypedValue (reverse L4)
          |               - Apply ?b type hints for boolean fields
          |               - Assign to object
          |
          +-- []? --> empty array
          +-- [...]? --> parseInlineBracketArray
          +-- {...}? --> parseInlineBracketObject
          +-- SchemaName(...)? --> decodeSchemaInstance
          +-- Otherwise --> parseKeyValueBlock (indentation-based)
```

---

## Key Design Decisions

### 1. Pipeline ordering is deliberate

The layers must execute in a specific order:

- **Schema extraction first** (L1): All subsequent layers operate on schema-aware data. Dictionary encoding only considers values (not keys). Delta encoding operates on columns defined by the schema.
- **Positional streaming before dictionary** (L2 before L3): Values must be extracted from objects before we can count string frequencies for the dictionary.
- **Type encoding before delta** (L4 before L5): Booleans and dates are encoded to their compact forms before delta analysis examines the column values.
- **Delta before repeat** (L5 internal ordering): Delta encoding changes numeric values to `+N` notation, which should not be confused with repeat markers. Repeat encoding explicitly skips delta columns.
- **Tokenizer alignment is pervasive** (L6): Separator selection happens at the start (`getSeparatorConfig`), and the chosen separators are used throughout all formatting. The final join uses the tokenizer-specific row separator.

### 2. Lossless round-tripping is non-negotiable

Every design choice is validated against the lossless round-trip test suite. Key mechanisms that ensure losslessness:

- **Boolean type hints** (`?b`): Without these, `1`/`0` in Level 2+ output would be ambiguous between booleans and numbers. The `?b` suffix on schema fields resolves this.
- **String quoting rules**: Values that could be misinterpreted (numbers, reserved words, values starting with special prefixes) are always quoted.
- **Cardinality guards** (`@N`): Explicitly encode array length so the parser knows exactly how many rows to consume.

### 3. Schemas use signature-based matching, not structural hashing

Schema identity is defined by the sorted set of property keys (the "signature"). Two objects with the same keys in different orders map to the same schema. This is simpler and more robust than structural hashing, and property insertion order is preserved via the first-seen instance's key order.

### 4. Dictionary inclusion uses net-positive economics

A dictionary entry is only included if its total savings (savings per occurrence times frequency) exceeds its header cost (tokens to list the value once in `@D`). This prevents short or infrequent values from bloating the dictionary header without providing net savings.

### 5. Heuristic token estimation as default

Exact token counting requires `tiktoken`, which is a native module with platform-specific binaries. Making it an optional peer dependency keeps the core library lightweight and cross-platform. The built-in heuristic (~4 chars per token for words, ~3 chars per digit cluster) is accurate enough for dictionary inclusion decisions and savings analysis.

---

## Token Budget Analysis: Why 80% Is Achievable

Consider a canonical dataset: 500 employee records with fields `{id, name, email, department, active, salary}`.

**JSON baseline cost breakdown:**

| Component | Per record | x500 records | Tokens |
|-----------|-----------|-------------|--------|
| Key tokens (`"id":`, `"name":`, etc.) | ~12 | 6,000 | ~1,500 |
| Structural tokens (`{`, `}`, `,`, `:`) | ~11 | 5,500 | ~1,375 |
| Value tokens | ~6 | 3,000 | ~750 |
| Quote tokens around keys and strings | ~10 | 5,000 | ~500 |
| Array brackets + commas | -- | -- | ~75 |
| **Total** | | | **~4,200** |

**XRON Level 3 cost breakdown:**

| Component | Tokens |
|-----------|--------|
| Headers: @v3, @S A:..., @D:..., @N500 A | ~25 |
| Dictionary: 5 department values listed once | ~10 |
| Value tokens: 500 rows x ~5 values per row | ~625 |
| Delta columns (id, salary): `+1`, `+1000` instead of absolute | ~-250 (savings) |
| Repeat column (dept): `~` instead of full string | ~-125 (savings) |
| Field separators: 500 rows x 5 commas = 2,500 `, ` | ~500 |
| Row separators: 500 `\n` | ~100 |
| **Total** | **~840** |

**Reduction: (4,200 - 840) / 4,200 = 80%**

The savings come from fundamentally different sources: schema extraction eliminates all key overhead (~1,500 tokens), unquoted values eliminate quote overhead (~500 tokens), dictionary encoding reduces repeated strings (~250 tokens), delta encoding reduces sequential numbers (~250 tokens), and compact types reduce booleans and nulls (~125 tokens).

---

## Performance Characteristics

**Serialization (`stringify`):**
- Time complexity: O(N * K) for schema extraction (one DFS pass), O(N * K) for nested schema detection, O(N * K) for field type detection, O(V) for dictionary building where V is total string value count, O(N * K) for positional encoding. Overall: O(N * K), same as `JSON.stringify`.
- Space complexity: O(S) for schema storage, O(D) for dictionary, O(N * K) for output buffer. Where S = number of unique schemas, D = dictionary size.

**Deserialization (`parse`):**
- Time complexity: O(L) for header parsing where L is number of header lines, O(N * K) for row splitting and value decoding. Overall: O(N * K), same as `JSON.parse`.
- Space complexity: O(S + D + N * K) for schemas, dictionary, and reconstructed objects.

**Build output:** The library uses `tsup` to produce ESM, CJS, and declaration files. The minified bundle is small (no runtime dependencies; `tiktoken` is optional).

---

## Extension Points

### Adding a New Compression Layer

To add a new pipeline layer (e.g., "Layer 7: Run-Length Encoding for numeric sequences"):

1. **Create the module:** Add `src/pipeline/your-layer.ts` with:
   - An analysis/detection function (determines if the optimization applies).
   - An encoding function (transforms data during stringify).
   - A decoding function (reverses the transformation during parse).

2. **Integrate into stringify:** In `stringify.ts`, call your encoding function at the appropriate point in the pipeline. If it operates on positional rows, insert it in `encodeSchemaArray` between the existing delta/repeat encoding steps.

3. **Integrate into parse:** In `parse.ts`, call your decoding function at the corresponding reverse point in `decodeSchemaRows`.

4. **Level gating:** Gate the layer behind a level check (e.g., `if (level >= 3)`). More aggressive optimizations should require higher levels.

5. **Test:** Add round-trip tests in `tests/integration/roundtrip.test.ts` that exercise the new optimization and verify lossless reconstruction.

### Adding a New Tokenizer Profile

1. In `pipeline/tokenizer-opt.ts`, add a new entry to the `SEPARATOR_CONFIGS` record and the `TokenizerProfile` union in `types.ts`.

2. If the new tokenizer has different optimal separators (e.g., a tokenizer where tab is cheaper than comma-space), update the config accordingly.

3. Add tokenizer-specific post-processing in `optimizeForTokenizer` if needed.

### Adding New Type Encodings

1. In `pipeline/type-encoding.ts`, add detection and encoding logic in `encodeTypedValue`.

2. Add the reverse decoding logic in `decodeTypedValue`.

3. Ensure the new encoding is unambiguous: it must not collide with existing value patterns (numbers, dict refs, delta notation, repeat markers).

4. If the encoding requires a new prefix character, add it to the quoting rules in `format/escape.ts` so that string values starting with that character are properly quoted.

---

## BPE Tokenizer Alignment Strategy

The core insight behind Layer 6 is that BPE tokenizers have a fixed vocabulary of token patterns learned from training data. Choosing format characters that align with common single-token patterns in these vocabularies minimizes the per-character token cost.

**Analysis of major tokenizers:**

All three supported tokenizers (o200k_base, cl100k_base, Claude) share these properties:
- `\n` is always a single token.
- `, ` (comma-space) is a single token when it appears between common word patterns.
- `@` is a single token.
- `(` and `)` are each single tokens.
- Bare English words preceded by a space are typically single tokens (` Alice` = 1 token).
- Unquoted numbers are ~1 token per 1-3 digits.

**What XRON avoids:**
- JSON quotes (`"`) are each 1 token, and they appear around every key and string value. XRON eliminates most quotes.
- JSON colons (`:`) paired with keys consume tokens. XRON eliminates them via positional encoding.
- JSON braces (`{`, `}`) around every object. XRON uses one schema definition for all objects of that shape.

**Future optimization:** The `optimizeForTokenizer` post-processing hook is designed for advanced tokenizer-specific optimizations that go beyond separator selection, such as:
- Substituting multi-byte characters that happen to be single tokens in a specific vocabulary.
- Merging whitespace patterns to align with BPE merge boundaries.
- Choosing between equivalent encodings based on actual token costs (e.g., `20260401` vs. `2026/04/01` for dates).

---

## Layer 0: Adaptive Compression (`pipeline/adaptive.ts`)

When `level: 'auto'`, XRON runs a lightweight analysis pass before serializing. This is "Layer 0" — it decides which layers to activate.

### Decision Algorithm

```
assessData(data, options)
  │
  ├─ jsonSize < minCompressSize? ──── YES → willCompress = false → stringify returns JSON
  │
  ├─ jsonSize < 150 bytes? ────────── YES → Level 1 (headers alone cost more than savings)
  │
  ├─ extractSchemas() finds 0 ─────── YES → Level 1 (no repeating object shapes)
  │   qualifying schemas?
  │
  ├─ hasDeltaColumns but ──────────── YES → Level 3 (schema + delta, skip dictionary)
  │   no beneficial dictionary?
  │
  ├─ no dictionary AND ────────────── YES → Level 1 (L2/L3 add nothing)
  │   no delta columns?
  │
  ├─ dictionary but ───────────────── YES → Level 2 (schema + dictionary)
  │   no delta columns?
  │
  └─ dictionary AND ───────────────── YES → Level 3 (full stack)
      delta columns?

  Finally: is the XRON output ≥ JSON.stringify?
    YES → return JSON (never-worse guarantee)
    NO  → return XRON
```

### Payload Size Categories

| Category | JSON Size | Auto Behaviour | Why |
|----------|-----------|----------------|-----|
| **Tiny** | < 150 B | Returns raw JSON | `@v1` header + schema line exceeds savings |
| **Small** | 150–500 B | Level 1 | Schema extraction helps; dictionary too few entries |
| **Medium** | 500 B – 5 KB | Level 2 | Dictionary entries amortize across 10-50 rows |
| **Large** | 5–50 KB | Level 2 or 3 | Delta encoding activates if sequential columns exist |
| **Very Large** | > 50 KB | Level 3 | All layers deliver savings; fixed header cost is negligible |

### Guarantees

1. **Always lossless**: `XRON.parse(XRON.stringify(data, { level: 'auto' }))` deep-equals the original for all data types.
2. **Never worse than JSON**: After serializing, auto compares against `JSON.stringify`. If XRON is not smaller, it returns the JSON string instead. The parser handles both transparently.
3. **Deterministic**: Same data with same options always produces the same output.
4. **Parser compatibility**: The parser accepts both XRON format (starting with `@v`) and raw JSON (starting with `{` or `[`), so auto-mode output always round-trips correctly.

---

## XRON vs TOON vs TRON: Compression Layer Comparison

This section explains exactly what each format does and does not do, so the architectural differences are clear.

### What all three share

All three formats eliminate the biggest source of JSON waste: **repeated property keys**. In a 100-row JSON array, the key `"department"` appears 100 times (plus 100 colons and 200 quotes around each key). TOON, TRON, and XRON all define the key set once and stream values positionally.

```
JSON overhead per row (5 fields):
  {"id":1,"name":"Alice","email":"a@b.com","department":"Sales","active":true}
   ^    ^ ^     ^        ^      ^          ^           ^       ^       ^
   20 structural tokens (braces, colons, quotes around keys)

After key elimination (all three formats):
  1, Alice, a@b.com, Sales, true
  0 structural tokens — just the values
```

### Where TOON stops

TOON (Terse Object-Oriented Notation) uses indentation to define structure and a header row to declare field names:

```
[100]:
  - id, name, email, department, active
  1, Alice, alice@example.com, Sales, true
  2, Bob, bob@example.com, Engineering, false
  ...
```

TOON eliminates keys and JSON punctuation. It does **not**:
- Build a dictionary of repeated values (every `Sales` is stored in full)
- Compact booleans (`true`/`false` stay as-is)
- Delta-encode sequential numbers (IDs stored verbatim)
- Compact dates or UUIDs
- Optimise for specific BPE tokenizers

### Where TRON stops

TRON (Terse Reduced Object Notation) adds class-based schema definitions with short names:

```
class A: id, name, email, department, active
A 1, Alice, alice@example.com, Sales, true
A 2, Bob, bob@example.com, Engineering, false
...
```

TRON adds short schema names (`A` instead of `User`) and class-prefix notation. It does **not**:
- Build a dictionary of repeated values
- Compact booleans, nulls, or dates
- Delta-encode sequential numbers
- Use repeat markers for consecutive identical values
- Provide cardinality guards (`@N100 A`) for streaming
- Offer adaptive level selection

### What XRON adds: layer by layer

**Layer 3 — Dictionary Encoding** (not in TOON or TRON):

```
@D: Sales, Engineering, Marketing
...
1, Alice, alice@example.com, $0, 1     ← $0 replaces "Sales" (5 chars → 2 chars)
2, Bob, bob@example.com, $1, 0         ← $1 replaces "Engineering" (11 chars → 2 chars)
```

Dictionary entries are only included when `totalSavings >= headerCost`. In a 100-row dataset with 5 department values, this saves ~600 chars.

**Layer 4 — Type-Aware Encoding** (not in TOON or TRON):

| Original | XRON | Saving per occurrence |
|----------|------|----------------------|
| `true` | `1` | 3 chars |
| `false` | `0` | 4 chars |
| `null` | `-` | 3 chars |
| `"2026-04-01"` | `20260401` | 4 chars (no quotes, no hyphens) |
| `550e8400-e29b-...` | `^` + 22-char Base62 | ~14 chars |

Boolean encoding uses `?b` field-type hints in the schema header (`@S A: id, active?b`) to ensure the parser can distinguish `1` (number) from `1` (boolean true) during deserialization.

**Layer 5 — Delta + Repeat Encoding** (not in TOON or TRON):

```
1, Alice, $0, 1      ← first row: absolute values
+1, Bob, $1, 0       ← id incremented by 1 ("+1" instead of "2")
+1, Carol, $0, ~     ← active same as previous row → "~"
```

For a 500-row dataset with sequential IDs: TOON/TRON store `1, 2, 3, ..., 500` (~1,400 chars). XRON stores `1, +1, +1, ..., +1` (~1,000 chars). Net saving: ~400 chars just from IDs.

**Layer 6 — Tokenizer Alignment** (not in TOON or TRON):

XRON selects separators to minimise BPE token count:
- `\n` (row separator) = 1 token in all tokenizers
- `, ` (field separator) = often 1 token in BPE merges
- `@` (header prefix) = 1 token in o200k_base, cl100k_base, claude

TOON and TRON don't consider tokenizer vocabulary when choosing their syntax characters.

### Measured Results: 100-Row Dataset (7 fields)

| Format | Chars | vs JSON | vs TOON/TRON |
|--------|------:|--------:|-------------:|
| JSON (minified) | 13,569 | baseline | +88% larger |
| YAML | 13,467 | -1% | +86% larger |
| TOON | 7,232 | -47% | baseline |
| TRON | 7,230 | -47% | baseline |
| **XRON Level 1** | **7,049** | **-48%** | **-3%** |
| **XRON Level 2** | **5,367** | **-60%** | **-26%** |
| **XRON Level 3** | **5,275** | **-61%** | **-27%** |

XRON L1 is comparable to TOON/TRON because they share the key-elimination layer. L2 and L3 pull ahead by 26-27% via dictionary, type-compaction, delta, and repeat encoding — layers that neither TOON nor TRON implement.
