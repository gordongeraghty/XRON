# How XRON's Lossless Guarantee Is Verified

This document exists so the claim can be checked rather than believed. Every
number below is reproducible with a command given here.

XRON's central claim is a round-trip identity:

```
JSON.stringify(XRON.parse(XRON.stringify(data, { level }))) === JSON.stringify(data)
```

That is one property, so it is tested as one property — not as a collection of
examples that happen to pass.

---

## 1. Headline result

| | Round-trip failures | Rate |
|---|---|---|
| 0.3.0 (published) | 2,673 / 4,800 | **55.7%** |
| 0.4.0 | 1 / 42,000 | **0.002%** |

Measured across randomised payloads at all four levels (1, 2, 3 and `auto`),
over seven independent seeds.

The single remaining failure is documented in §6. It is not hidden.

---

## 2. The three layers of verification

### 2.1 Property corpus — `packages/format/tests/lossless-property.test.ts`

The round-trip identity run over a corpus placed deliberately on the boundaries
where encoders break. A point test per known bug only ever catches the bug you
already knew about; these cases were chosen to catch the *next* one.

```bash
npx vitest run packages/format/tests/lossless-property.test.ts
```

| Corpus area | Why this boundary |
|---|---|
| Dictionaries of 61, 62, 63, 120, 200, 300 entries | 62 is where refs become two-character base-62 |
| Fractional seconds of 0, 1, 2, 3, 6 digits | `toISOString()` emits 3; other producers emit other widths |
| UTC offsets of both signs, `+14:00`, `-12:00`, and colon-less `+0530` | the offset sign is a `-` sitting beside date separators |
| A DST crossing | the offset changes mid-column |
| Columns mixing date-only with datetime | one column, two textual shapes |
| Date columns at 30, 31 and 60 rows | crossing the delta-encoding threshold |
| Nulls, non-monotonic dates, pre-1970 dates, epoch crossings, leap days | negative and non-increasing epochs |
| Dates outside 1900–2100 | the old hardcoded sanity range |
| Literal negative numbers in non-delta columns | indistinguishable from delta notation |
| BigInt/Number boundaries, including `1e20` and `-5n` | identical text without a type marker |
| 8-digit integers in a date-like range | indistinguishable from a compacted date |
| Values equal to the encoder's own notation — `$0`, `+5s`, `~` | collision with dictionary, delta and repeat markers |
| Strings and keys containing `:`, `,` and `"` | collision with the parser's delimiters |
| Varying nested objects, 2D boolean arrays | layers that rewrite cells |

Each case runs at **all four levels**, so a bug that only manifests at Level 2
cannot hide behind a passing Level 3.

### 2.2 Randomised fuzzing

A seeded generator builds arbitrary nested payloads — mixed scalars, nested
objects and arrays, BigInts, nulls, dates in several formats, and strings that
collide with XRON's own syntax — then round-trips each at every level.

Failures are attributed to the **first field that actually differs**, not to a
heuristic guess about the payload. That distinction mattered: an earlier
classifier attributed failures by scanning the whole payload for a trigger
substring, which reported "1,140 colon failures" when the true cause was
unbalanced quotes. Precise attribution changed the entire fix order.

### 2.3 Packaged-artefact verification

The library is packed with `npm pack`, installed into a clean directory from the
tarball, and exercised through **both** its ESM and CommonJS entry points —
because `dist/index.js` passing does not prove `dist/index.cjs` does.

```bash
cd packages/format && npm pack
# install the tarball into an empty project and round-trip through both entry points
```

---

## 3. What was found

Fourteen silent data-corruption bugs. Every one returned wrong data **without
throwing** — no exception, no warning, just different data.

### Temporal
| Bug | Levels |
|---|---|
| Dictionary refs past 62 entries read as decimal instead of base-62 | 2, 3 |
| `toISOString()` output decoding to the literal string `"NaNs"` | 3 |
| Fractional seconds of any width but three, lost | 3 |
| `compactDate()` stripping the sign off UTC offsets | 2, 3 |
| Colon-less offsets rewritten with a colon | 2, 3 |
| Date-only columns returning as full ISO datetimes | 3 |
| Columns mixing date-only and datetime dropping the time | 3 |
| `parse()` throwing `RangeError` over a single bad column | 3 |

### Structural
| Bug | Levels |
|---|---|
| A string containing `"` emitted unquoted, desynchronising the row | all |
| A bare top-level string containing `:` parsed as a key/value pair | all, incl. 1 |
| An object key containing `:` split at that colon | 1–3 |
| Column templates stripping delimiters the row splitter needs | 2 |
| The substring dictionary lifting unbalanced brackets out of cells | 3 |

The quote bug was the single largest source of corruption — fixing that one line
took the fuzz failure rate from 51.1% to 29.3% and eliminated an entire crash
class (`Cannot read properties of undefined`).

### Type fidelity
| Bug | Levels |
|---|---|
| Literal negative numbers accumulated onto the previous row | 3, auto |
| Booleans decoding as the numbers `1` and `0` | 2, 3 |
| BigInt and Number indistinguishable, in both directions | all |
| 8-digit integers decoding as date strings | 2, 3 |
| Dates outside 1900–2100 never expanded back | 2, 3 |
| Type hints promoted so eagerly that `385.005` became `true` | 2, 3 |

### The two root causes

These are not fourteen unrelated defects. They reduce to two:

1. **The decoder re-derived decisions the encoder had already made** — inferring
   delta columns from a leading `+`/`-`, and date-ness from an 8-digit
   heuristic. Fixed by recording the decision (`@X` header) and by marking
   types explicitly (the BigInt `n` suffix).
2. **The encoder did not guarantee a cell was free of structural characters** —
   quotes, colons and separators leaked into positions where the parser treats
   them as syntax. Fixed by completing the quoting contract and by forbidding
   the template and substring layers from hiding delimiters.

---

## 4. Fix-by-fix evidence

Each fix was verified the same way: reproduce the corruption, apply the change,
re-measure. The fuzz rate after each stage:

| Stage | Fuzz failure rate |
|---|---|
| Baseline (0.3.0) | 55.7% |
| After colon-quoting + date/integer disambiguation | 51.1% |
| After quoting values containing `"` | 29.3% |
| After boolean hint-gating and nested-object fixes | 21.3% |
| After substring-dictionary balance fix | 19.4% |
| After the `@X` delta-column header | 6.4% |
| After BigInt `n` marker and type-hint narrowing | 3.7% |
| After whitespace and integer guards | **0.002%** |

---

## 5. Tests changed, and why

Four pre-existing tests were changed. None was weakened — each asserted data
corruption *as expected behaviour*, and the spec's losslessness guarantee
outranks a test that pins a violation.

The clearest example, from `tests/integration/2d-array.test.ts`:

```js
// BEFORE — fed in booleans, asserted numbers came back
const expected = [[1, 0, 1], [0, 1, 0]];
expect(result).toEqual(expected);

// AFTER
expect(result).toEqual(bools);
```

The others: `compactDate('2026-04-01') === '20260401'` (the compaction that made
integers decode as dates), and two asserting `BigInt(42)` encodes as `'42'`
(indistinguishable from the number 42 on the way back).

Every changed test carries its justification inline in the file. No test was
skipped, no assertion loosened, no tolerance widened, no `.only` or `.skip`
introduced. Suite: **314 → 569 tests**.

---

## 6. Known limitation

One failure in 42,000 randomised round-trips is open and not yet root-caused.

- **Signature:** a cell merges with the one following it, accompanied by a
  checksum-mismatch warning — which points at the encoder emitting an
  inconsistent document rather than at a decode bug.
- **Reproducibility:** one fuzz seed only; no minimal reproduction yet, so it is
  not covered by a test.

It is recorded here rather than rounded away.

---

## 7. Compression: what is actually claimed

Compression figures are measured with `gpt-tokenizer`'s `o200k_base` — the
tokenizer GPT-4o uses — not estimated.

> An earlier version of BENCHMARKS.md reported 62–72% for the employee dataset.
> Those figures came from the library's own character-based estimator, which is
> not accurate for BPE. The corrected figures are lower.

| Shape | Reduction |
|---|---|
| Identical repeated rows, long string values | **up to 91%** |
| 30 columns, 4-value vocabulary, 500 rows | **79.8%** |
| Long column names, small values, 500×20 | **78.7%** |
| Booleans only, 500×20 | **71.2%** |
| Wide + repetitive, 500×12 | **59.8%** |
| Employee records, 500 rows | **47.8%** |
| Unique UUIDs, 500 rows | **21.4%** |

**Reduction is a property of your data, not only of the encoder.** XRON deletes
repeated keys and repeated values, so the ratio measures how much of the payload
was structure rather than information.

### The floor

For the employee dataset, the values alone — no keys, no punctuation, no
structure — cost **6,999 tokens, 48% of the JSON total**. That places the
theoretical ceiling near **52%** for *any* lossless format. XRON reaches 47.8%.
No amount of engineering takes that dataset to 80%; the information is
irreducible.

Wide tables of categorical values are mostly structure, so they genuinely reach
80%. That is the shape the headline refers to.

### Known headroom

Two layers are currently net-negative under real BPE tokenization:

- **Delta encoding:** `+1000` is 3 tokens; the absolute `51000` is 2.
- **Dictionary refs:** `Sales` is 1 token; `$0` is 2.

Both decide using a `ceil(length / 4)` character heuristic rather than real
token cost. Making those decisions token-aware measures **60.7%** on the
employee dataset, up from 47.8%. That work is not in this release: a
first attempt broke five legitimate behaviour tests, and doing it properly
requires wiring in the real tokenizer rather than a better guess.

---

## 8. Reproducing every number

```bash
npm install
npm run build

# Full suite (569 tests)
npm test

# The round-trip property alone
npx vitest run packages/format/tests/lossless-property.test.ts

# Token benchmarks
npx vitest run packages/format/tests/benchmarks/token-count.test.ts
```

Compression figures in §7 were produced by encoding each dataset at every level,
taking the smallest output, and counting tokens with `gpt-tokenizer`'s
`o200k_base` encoder — the same package the playground uses.
