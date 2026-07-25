# XRON Benchmarks & Performance Analysis

XRON is designed to solve the "token tax" of structured data in LLM context windows. This document provides empirical evidence from our benchmark suite comparing JSON (minified) against XRON Levels 1, 2, and 3.

---

## 1. Token Count Comparison (BPE o200k_base)

Measured by encoding with the real `gpt-tokenizer` implementation of
`o200k_base` — the tokenizer GPT-4o actually uses — not by estimating.

**Important:** an earlier version of this table reported 62–72% for this
dataset. Those figures came from the library's internal character-based
estimator (`estimateTokens`), which is not accurate for BPE. The numbers below
are what a real tokenizer returns. They are lower, and they are correct.

Standard employee dataset (id, name, email, department, active, salary):

| Dataset Size | JSON | XRON L1 | XRON L2 | XRON L3 | **Best % Reduction** |
|---|---|---|---|---|---|
| **10 rows**  | 292    | 215   | 238   | 219   | **26.4%** |
| **50 rows**  | 1,452  | 934   | 963   | 822   | **43.4%** |
| **100 rows** | 2,902  | 1,834 | 1,863 | 1,574 | **45.8%** |
| **500 rows** | 14,502 | 9,034 | 9,064 | 7,571 | **47.8%** |

### Why this dataset caps out near 48%

There is a hard floor. The values themselves must still appear in the output,
and for this dataset the values alone — no keys, no punctuation, no structure —
cost **6,999 tokens, or 48% of the JSON total**. That puts the theoretical
ceiling at roughly 52% for *any* lossless format. XRON reaches 47.8% of that
available 52%.

Reduction is therefore a property of your data, not only of the encoder: it
measures how much of your payload was structure rather than information.

## 1b. Reduction by Data Shape

| Shape | JSON | XRON | Reduction |
|---|---:|---:|---:|
| Identical repeated rows, long string values | — | — | **up to 91%** |
| 30 columns, 4-value vocabulary, 500 rows | 150,003 | 30,261 | **79.8%** |
| Long column names, small values, 500×20 | 140,002 | 29,760 | **78.7%** |
| 60 columns, 2-value vocabulary, 500 rows | 315,003 | 90,390 | **71.3%** |
| Booleans only, 500×20 | 70,002 | 20,161 | **71.2%** |
| Wide + repetitive, 500×12 | 30,003 | 12,057 | **59.8%** |
| Employee records, 500 rows | 14,502 | 7,571 | **47.8%** |
| Unique UUIDs, 500 rows | 11,502 | 9,035 | **21.4%** |

The 80% headline is real and reproducible — on wide tables with repeated
values. Narrow tables of unique strings are near their information floor and
cannot go much further.

### Known headroom

A token-attribution study of the 500-row employee output found that two
compression layers are currently *net-negative* under real BPE tokenization:

- **Delta encoding**: `+1000` is 3 tokens; the absolute value `51000` is 2.
- **Dictionary refs**: `Sales` is 1 token; `$0` is 2.

Both layers decide using a `ceil(length / 4)` character heuristic rather than
real token cost. Making those two decisions token-aware measures at **60.7%**
reduction on the same dataset, up from 47.8%. That work is not in this release.

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

Or run everything (569 tests):

```bash
npm test
```
