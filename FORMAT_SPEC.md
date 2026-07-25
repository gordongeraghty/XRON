# XRON Format Specification (v0.4.0)

**Extensible Reduced Object Notation (XRON)** is a lossless, BPE-aligned data serialization format designed specifically for the Model Context Protocol (MCP) and LLM context window optimization. It eliminates redundancy across nine compression layers, reducing token count by roughly 50% on typical business records and up to 80% on wide tables with repeated values — see [BENCHMARKS.md](BENCHMARKS.md) for measured figures by data shape, and [docs/VERIFICATION.md](docs/VERIFICATION.md) for how the lossless guarantee is tested.

**0.4.0 changes the wire format.** New in this version: the `@X` delta-column header (§2.8), the BigInt `n` marker, date-only values no longer compacted, boolean `1`/`0` restricted to hint-backed fields, and extended quoting rules (§3, Layer 4). A 0.3.x document containing a compacted date-only value decodes as an integer under 0.4.0 — re-encode rather than mixing versions.

---

## 1. Document Structure

An XRON document consists of two main sections:
1.  **Metadata Section (Headers):** All lines prefixed with `@`. Defines versions, schemas, dictionaries, and templates.
2.  **Data Section:** Positional or structural data lines following the meta definitions.

### 1.1 Row & Field Separators
XRON is designed to be tokenizer-aware. It swaps separators based on compression level:
- **Level 1 & 2:** Field separator is `, ` (comma-space). Row separator is `\n` (newline).
- **Level 3:** Field separator is `\t` (tab). Row separator is `\n`.

*Rationale: Tabs at Level 3 minimize token count in o200k_base and cl100k_base by grouping field boundaries more effectively.*

---

## 2. Metadata Headers (`@`)

### 2.1 `@v` — Version Header
Specifies the compression level used in the document.
- `@v1`: Level 1 (Human-readable, schema only)
- `@v2`: Level 2 (Compact, dictionary + type-encoding)
- `@v3`: Level 3 (Maximum, delta + templates + tab-separated)

### 2.2 `@S` — Schema Definition
Defines a repeatable object shape.
- **Format:** `@S <Name>: <field1>, <field2>, <field3>?<type>`
- **Type Hints:**
    - `?b`: Boolean (Enables `1`/`0` encoding)
    - `?n`: Number (Optional hint)
    - `?s`: String (Optional hint)

*Example:* `@S A: id, name, email?s, active?b`

### 2.3 `@D` — Dictionary (Value-level)
A lookup table for repeated string values.
- **Format:** `@D: <val1>, <val2>, <val3>`
- **Reference:** `$0`, `$1`, `$2`... in data rows.

### 2.4 `@P` — Substring Dictionary (Fragment-level)
Used at Level 3 to compress common substrings within unique values.
- **Reference:** `%0;`, `%1;`... in data rows.

### 2.5 `@T` — Column Template
Captures identical prefix/suffix patterns in a column.
- **Format:** `@T <ColumnIndex>: <prefix>{}<suffix>`
- **Usage:** Data rows contain only the variable portion corresponding to `{}`.

### 2.6 `@N` — Cardinality Guard
Declares the number of rows following for a specific schema.
- **Format:** `@N<Count> <SchemaName>`

### 2.7 `@C` — Integrity Checksum
CRC32 checksum of the full XRON payload (excluding the `@C` line itself). Detects truncation, corruption, or copy-paste errors — the most common failure mode in LLM context windows.
- **Format:** `@C <8-char lowercase hex>`
- **Position:** Immediately after the `@v` line.
- **Verification:** On parse, if `@C` is present, the payload is re-checksummed and compared. Mismatch triggers a warning (or throws with `strictValidation: true`).
- **Backwards compatible:** Data without `@C` parses normally.

*Example:* `@C 6975b6f8`

### 2.8 `@X` — Delta Column Declaration
Records which column indices the encoder delta-encoded in the block that follows.
- **Format:** `@X: <index>, <index>` — or `@X:` with an empty list, meaning "no delta columns"
- **Position:** Within a schema-array block, before the `@N` cardinality line.
- **Emitted at:** Level 3 only, on every block, including when no column qualified.

The empty form is load-bearing: it distinguishes *this encoder decided none* from
*this document predates the header*. Without `@X`, a decoder has to infer delta
columns from cell text — a leading `+` or `-` — and that inference cannot tell a
delta apart from a literal negative number. A plain `-5` in a column the encoder
deliberately left alone was being accumulated onto the previous row.

- **Backwards compatible:** a document without `@X` falls back to the old
  inference, and an older decoder skips the unrecognised line.

*Example:* `@X: 0, 2`

### 2.9 `@A` — Anonymous 2D Array
Declares a uniform array-of-arrays (all inner arrays have the same length). Enables positional streaming without named schema fields — just column indices.
- **Format:** `@A <rowCount> <colCount>`
- **Usage:** Each subsequent line contains `colCount` values in positional order.
- **Repeat encoding:** At Level 3, repeated values across rows are replaced with `~`.

*Example:*
```
@A 3 2
1, hello
2, world
3, hello
```

### 2.10 Dictionary Reference Encoding (Base-62)
Dictionary references use base-62 encoding for compact representation beyond 62 entries:
- **Indices 0–61:** Single character — `$0`–`$9`, `$a`–`$z`, `$A`–`$Z`
- **Indices 62–3905:** Two characters — `$00`–`$ZZ`
- **Maximum:** 3906 dictionary entries.
- **Backwards compatible:** `$0`–`$9` are identical to legacy numeric encoding.

### 2.11 Temporal Delta Encoding
Sequential date columns (ISO 8601 strings) are delta-encoded using seconds notation:
- **Format:** `+<N>s` or `-<N>s` (seconds delta from previous row)
- **First row:** Keeps the original date value (the anchor).
- **Detection:** Columns where every value shares one shape that can be rebuilt
  exactly from `(epoch seconds + that shape)`.

**Eligibility is deliberately narrow.** Epoch seconds do not carry the following,
so a column containing any of them is left un-delta-encoded and falls back to
plain encoding:

| Refused | Why |
|---|---|
| UTC offsets (`-05:00`) | reconstruction always emits `Z`, changing the text |
| No timezone | parsed as local time, re-emitted as UTC |
| No seconds field | reconstruction always emits seconds |
| Non-zero fractional seconds | sub-second precision is not in the delta |
| Mixed date-only and datetime in one column | one column, two shapes |

Bytes are traded for exactness here: a refused column is larger but survives the
round-trip.

*Example:*
```
2026-01-01, 10
+86400s, 20
+86400s, 30
```

---

## 3. The 9-Layer Compression Pipeline

### Layer 1: Schema extraction (L1)
Eliminates repeated JSON keys. Objects matching a schema are streamed as flat value rows.

### Layer 2: Positional streaming (L2)
Ensures data follows the exact order defined in `@S`. All metadata for the row is shifted to the document header.

### Layer 3: Dictionary encoding (L3)
Maps frequent string values (e.g., `"Engineering"`) to short pointers (`$0`).

### Layer 4: Type-aware compacting (L4)
- **Booleans:** `true` → `1`, `false` → `0` — **only** where the field carries a
  `?b` schema hint. Nothing else can decode `1` back to a boolean, so mixed
  columns, anonymous `@A` arrays and inline objects keep `true`/`false`.
- **Nulls:** `null` → `-` (Level 2+).
- **Datetimes:** ISO strings → compact form (e.g. `20260403T103000Z`).
- **Date-only values are NOT compacted.** `2026-04-03` stays as written. A bare
  `20260403` is indistinguishable from the integer `20260403`, and no heuristic
  can separate them — that ambiguity made plain integers decode as date strings.
  The uncompacted form already round-trips, since it fails the number test on its
  dashes.
- **UTC offsets must carry their colon** to be compacted. `+05:30` and `+0530`
  compact to identical bytes and expansion always re-inserts the colon, so the
  colon-less form is passed through untouched.
- **BigInt:** written with a trailing `n`, as a JavaScript BigInt literal
  (`42n`). Without the marker a BigInt and a Number are the same bytes, and the
  decoder was guessing by digit count — `BigInt(42)` returned as the number `42`,
  while the number `1e20` returned as a BigInt.
- **UUIDs:** 36-char strings → 22-char Base62 headers (`^`).

### Layer 4b: Quoting rules
A value is quoted when leaving it bare would let the parser mis-read the
document. Beyond the obvious separators and leading sigils:
- **any value containing `"`** — an interior quote otherwise flips the parser's
  quote-tracking state and desynchronises every later field in the row;
- **object keys and bare top-level strings containing `:`** — in those two
  positions the colon *is* the delimiter. Elsewhere a colon is inert and is left
  unquoted, so URLs and timestamps in ordinary value positions cost nothing;
- **strings that look like a BigInt literal** (`5n`), so they do not decode as
  one.

### Layer 5: Column templates (L5)
Eliminates repeated suffixes like `@company.com` from email columns.

### Layer 6: Substring dictionary (L6)
Compresses shared fragments across unique strings (e.g., `/api/v1/` in URLs).

### Layer 7: Delta + repeat compression (L7)
- **Numeric delta:** Sequential numbers (IDs, timestamps) stored as increments (`+1`, `+10`).
- **Temporal delta:** Sequential ISO date columns stored as `+Ns` seconds deltas (e.g., `+86400s` = 1 day).
- **Repeat:** Identical values in consecutive rows replaced with `~` (same-as-above).
- **2D arrays:** Uniform arrays-of-arrays encoded via `@A` header with positional streaming.

### Layer 8: Separator reduction (L8)
Swaps `, ` for `\t` at Level 3 to save 1 character per field boundary.

### Layer 9: Tokenizer alignment (L9)
Adjusts output layout to ensure boundaries align with BPE token patterns for OpenAI (o200k/cl100k) and Claude tokenizers.

### Layer 10: Integrity checksum (L10)
CRC32 checksum (`@C`) appended after the version header. Detects truncation and corruption during LLM context window transfer.

---

## 4. Complexity & Constraints

- **Circular References:** XRON throws if circular objects are detected.
- **Max Depth:** Default recursion limit is 100 levels.
- **Ambiguity:** Non-schema data (mixed arrays) falls back to structural unquoted notation (TOON style).

---

## 5. Security Considerations

XRON is a **non-executable** format. It does not support arbitrary code execution or object prototype injection during parsing. It is strictly a data deserialization logic.
