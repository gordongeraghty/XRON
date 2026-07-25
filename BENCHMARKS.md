# XRON Benchmarks & Performance Analysis

XRON is designed to solve the "token tax" of structured data in LLM context windows. This document provides empirical evidence from our benchmark suite comparing JSON (minified) against XRON Levels 1, 2, and 3.

---

## 1. Token Count Comparison (BPE o200k_base)

The following tests were performed using a standard employee dataset (id, name, email, department, active status, salary). Tokens are estimated using a standard LLM BPE tokenizer heuristic.

| Dataset Size | JSON (Tokens) | XRON L1 (Tokens) | XRON L2 (Tokens) | XRON L3 (Tokens) | **L3 % Reduction** |
|--------------|---------------|------------------|------------------|------------------|-------------------|
| **10 rows**  | 569           | 259              | 244              | 217              | **62%**           |
| **50 rows**  | 2,841         | 1,171            | 998              | 856              | **70%**           |
| **100 rows** | 5,681         | 2,311            | 1,928            | 1,646            | **71%**           |
| **500 rows** | 28,401        | 11,431           | 9,368            | 7,966            | **72%**           |

### Key Takeaway
At 500 rows, XRON L3 saves over **20,000 tokens** compared to JSON. In a GPT-4o context, this single optimization can save you Context Window space equivalent to ~15 extra pages of documentation.

---

## 2. Character Count Comparison (Wire Size)

Character counts represent the physical string size. While LLMs bill by tokens, character counts correlate with browser/server memory usage and transmission time.

| Format | 100-Row Dataset | % vs Minified JSON |
|--------|-----------------|--------------------|
| **JSON (Pretty)** | 15,242 chars | +38% |
| **JSON (Minified)** | 11,041 chars | baseline |
| **XRON Level 1** | 5,713 chars | -48% |
| **XRON Level 2** | 2,673 chars | -76% |
| **XRON Level 3** | 2,130 chars | **-81%** |

---

## 3. Layer Impact Analysis

Where do the savings come from?

1.  **L1 (Schema Extraction):** Consistently removes ~50% of the byte size by eliminating repeated property keys (`"id"`, `"name"`, etc.).
2.  **L2 (Dictionary):** Adds another 20-30% on strings that repeat (like `department` names or domain names in emails).
3.  **L3 (Delta/Templates):** Provides the final 5-10% "polish" by compressing sequential IDs and incrementing values (like `salary` steps).

---

## 4. Round-Trip Correctness Evaluation

Compression numbers only mean something if the data survives. This section
measures the property that matters most — `parse(stringify(x)) === x` — rather
than assuming it.

### Method

Each dataset is encoded and then decoded back, at Level 3 and at `auto`, and the
result is compared to the input with `JSON.stringify` on both sides. A dataset
is only "lossless" if the decoded value is byte-identical to the original. The
same datasets are measured against the previously published build to show what
the correctness fixes cost in size.

### Results

| Dataset | Level | Size (prev) | Size (current) | Size change | Round-trip |
|---|---|---|---|---|---|
| Tabular, 120 dictionary entries (360 rows) | 3 | 5,258 | 5,258 | 0.0% | **corrupt → lossless** |
| Hourly timestamps via `toISOString()` (500 rows) | 3 | 5,557 | 6,555 | +18.0% | **corrupt → lossless** |
| Date-only column (500 rows) | 3 | 6,706 | 7,415 | +10.6% | **corrupt → lossless** |
| Timestamps with `-05:00` offset (500 rows) | 3 | 7,126 | 5,300 | −25.6% | **corrupt → lossless** |
| Mixed date-only / datetime column (400 rows) | 3 | 3,711 | 2,913 | −21.5% | **corrupt → lossless** |
| Plain records, no dates (500 rows) | 3 | 6,837 | 6,837 | 0.0% | lossless → lossless |

### What this costs, and what it buys

- **Data without timestamps is unaffected** — identical output, byte for byte.
- **Timestamp columns that compress correctly cost 10–18%** at Level 3. Those
  columns previously produced smaller output by discarding information.
- **Two cases got smaller.** Columns with UTC offsets or mixed date shapes were
  previously producing broken delta output; declining to delta-encode them and
  falling back to dictionary-compressed compact dates is both correct *and*
  20–25% smaller.
- **`auto` mode absorbs most of the cost.** Because `auto` picks the smallest
  correct encoding across all levels, it selects a lower level where Level 3 has
  become more expensive.

### Compression after the fixes

Measured against minified JSON, with `auto`:

| Dataset | JSON | XRON (auto) | Reduction |
|---|---|---|---|
| Tabular, 120 dictionary entries (360 rows) | 15,721 | 5,258 | **66.6%** |
| Hourly timestamps via `toISOString()` (500 rows) | 24,333 | 6,555 | **73.1%** |
| Date-only column (500 rows) | 17,333 | 6,209 | **64.2%** |
| Timestamps with `-05:00` offset (500 rows) | 24,833 | 5,300 | **78.7%** |
| Plain records, no dates (500 rows) | 26,067 | 6,837 | **73.8%** |
| Mixed date-only / datetime column (400 rows) | 13,093 | 2,913 | **77.8%** |

The headline 60–80% reduction holds with the correctness guarantee intact.

---

## 5. Run Benchmarks Locally
You can reproduce these numbers by running the benchmark suite in the monorepo:

```bash
npm install
npx vitest run packages/format/tests/benchmarks/token-count.test.ts
```

Verify the round-trip property separately — this is the suite that guards the
losslessness claim:

```bash
npx vitest run packages/format/tests/lossless-property.test.ts
```

Or run everything (557 tests):

```bash
npm test
```
