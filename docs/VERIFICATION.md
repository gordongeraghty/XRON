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
| 0.4.0, own fuzzer | 0 / 72,000 | 0% |
| 0.4.0, independent fuzzer, round 1 | 2,696 / 13,300 | **20.27%** |
| 0.4.0, independent fuzzer, round 2 (after round 1 fixes) | 1,956 / 13,300 | **14.71%** |
| 0.4.0, independent fuzzer, round 3 (after round 2 fixes) | 1,025 / 39,520 | **2.59%** |

Measured across randomised payloads at all four levels (1, 2, 3 and `auto`).
The independent rows are the important ones. Three separate adversarial rounds,
each written without reference to the fixes, each found real corruption the
in-house generator never produced: 4 classes, then 3, then 5. Every round also
confirmed the previous round's fixes held. All twelve are now fixed and in the
corpus. See §7 — it is the section worth reading.

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
| Bare top-level `NaN`/`Infinity`, and nested | the standalone-scalar path differed from the nested one |
| Rows with the same key set in different key orders | a schema carries one field order |
| An object whose key set matches its own nested object's | shape collision in schema matching |
| Dictionary values containing `\n`, `\r`, `\t`, surrounding spaces, or empty | the `@D` header is one comma-separated line |
| Unbalanced brackets in a value, and balanced ones as a control | the splitters track `( [ { ) ] }` as depth |
| `Date` objects bare, as a field, in an array, and in schema rows | compaction is only reversed at Level 2+ |
| Two shapes guessed into the same display name | Level 1 writes that name on the wire |
| Values starting with `^`, and strings shaped like compact dates | collision with the UUID and date markers |
| Strings that *are* header lines — `@v3`, `@S A: x`, `@N5 A`, `@D:`, `@X: 0`, `@P: x` | collision with the document grammar |
| Field names containing `,`, `"`, a trailing `?b`, or a space | the `@S` header is one comma-separated line |
| Year `0000` | the lower bound of the date sanity check |
| Anonymous 2D arrays whose cells hold objects or arrays | a decoder path that skipped structural dispatch |

Everything from "Bare top-level `NaN`" down exists because an independent fuzzer
found it and this corpus had not. That is recorded rather than quietly absorbed
— see §7.

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

Thirty-three silent data-corruption bugs. Every one returned wrong data **without
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
| An empty column-template residual at a row edge, eaten by the decoder's row trim | 3 |
| The checksum verified against a trimmed document, reporting spurious mismatches | all |

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

### Found by independent verification — the twelve that mattered most

None of these were found by this project's own testing. Each came from an
adversarial fuzzer written without reference to the fixes, across three rounds.
See §7 for why that distinction matters more than any number in this document.

**Round 1** — 20.27% failure rate:

| Bug | Levels |
|---|---|
| Bare top-level `NaN`/`Infinity` returned the *string* `"NaN"` instead of `null`, while nested occurrences correctly returned `null` | all |
| Rows sharing a key set but not a key order were merged into one schema, so `[{a:1,b:2},{b:3,a:4}]` came back as `[{a:1,b:2},{a:4,b:3}]` | 1, 2, 3 |
| An object whose key set matched a nested object's had its array field replaced by `Array.prototype.toString()` — `{foo:[{foo:1,bar:2},false],bar:9}` decoded as `{foo:"[object Object],false"}` | 1, 2, 3 |
| A control character inside a `@D` dictionary value ended the header line early and destroyed the rest of the document — a three-row table decoded to `{}` | 2, 3 |

**Round 2** — 14.71%:

| Bug | Levels |
|---|---|
| An unbalanced bracket in a string desynced the splitter — `{baz:'p]',other:1}` decoded as `{baz:"p], other: 1"}`, the next field swallowed. `needsQuoting` checked only for a *leading* `[` or `{`, and never for `)`, `]`, `}` | all |
| `Date` objects were compacted regardless of level, but compaction is only reversed at Level 2+, and a bare top-level scalar is never expanded at all | 1, and all when bare |
| Two unrelated schemas could be guessed into the same display name, which Level 1 writes on the wire; the parser is last-write-wins, so every row came back with the wrong field names *and* values | 1 |

**Round 3** — 2.59%:

| Bug | Levels |
|---|---|
| A leading `^` collided with the compacted-UUID marker: `{x:'^abc'}` decoded to a UUID, and `{x:'^!!!'}` threw. `^` is an ordinary character, so this alone was 714 of that round's 1,025 failures | 3 |
| Field names went raw into the comma-separated `@S` header — a key with a comma split into two columns, a key ending `?b` was read as a type hint and renamed, and a hint on a name containing a space was left glued on | 1, 2, 3 |
| Year `0000` was compacted but `isCompactDate` guarded `year >= 1`, so it was never expanded back | 2, 3 |
| A literal string shaped like the encoder's own compact-date output was expanded into a date | 2, 3 |
| Anonymous 2D-array cells holding objects or arrays were never decoded — `[[{a:1}]]` returned `[["{a: 1}"]]` | 1, 2, 3 |

Several of these destroy data at **Level 2, the default** — reachable by calling
`XRON.stringify(data)` with no options at all.

### The two root causes

These are not thirty-three unrelated defects. They reduce to two:

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
| After whitespace and integer guards | 0.002% |
| After the empty-residual and checksum-trim fixes (§6) | **0%** |

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
introduced. Suite: **314 → 759 tests**.

---

## 6. The last two bugs, and what "zero" means

The final fuzz failure — 1 in 42,000, held open through several rounds — was
root-caused to **two independent bugs**, both now fixed and both covered by
regression tests.

### Bug A — an empty column-template residual at a row edge

```js
[{ f0: 'has space 1', f1: null },
 { f0: 'has space 19', f1: 1 }]   // Level 3 only
```

The template prefix `has space 1` consumes row 0's value entirely, leaving an
empty residual. In the **first or last** column that puts the field separator at
the very edge of the line (`"\t-"`), and the decoder collects rows with
`line.trim()` — which eats it. The row then splits into one cell instead of two,
and every column after it reads the wrong value. An interior empty cell is
flanked by separators, so it was never affected.

Fixed in `detectColumnTemplates`: an empty residual in column 0 or the last
column now disqualifies the template, and that column is written literally.

### Bug B — checksum verified against a trimmed document

`parse()` computed `input.trim()` and passed the *trimmed* string to
`parseDocument`, but the encoder had computed the checksum over the **untrimmed**
payload. Any document legitimately ending in a meaningful field separator — an
empty trailing cell — therefore hashed differently and reported a spurious
`Checksum mismatch`. Fixed by passing the untrimmed `input`; `parseDocument`
already skips blank lines itself.

> **A note on how this was found.** The checksum warning and the corruption
> looked like one bug and were investigated as one for some time. They were not:
> the warning came from a *different* fuzz iteration than the corruption. Chasing
> the assumed connection cost real effort. The lesson is recorded here because
> the same trap is easy to fall into again — two symptoms appearing in the same
> log are not evidence of one cause.

### What zero does and does not establish

**This section was rewritten after being proved right the hard way.**

An earlier version of this document reported *0 failures in 114,000 round-trips*
and added the caveat that this "cannot speak for shapes the generator never
emits." That caveat turned out to be the single most important line in the file.

An independently written fuzzer — same scale, same seed methodology, but a
generator built from scratch to target different shapes — was then run against
the same build. It found a **20.27% failure rate across 13,300 round-trips**, in
four classes, two of which destroyed data at the default compression level.

Both numbers were honest. Both were measured. They differ by four orders of
magnitude because **a generator written by the same person who wrote the fixes
explores the space that person already thought about.** Zero failures against
your own fuzzer measures the imagination of the fuzzer, not the correctness of
the code.

The four classes are fixed and are now in the corpus. But the lesson generalises
past them:

- Treat a self-produced zero as *"no failures in the space I thought to
  generate."* Never as *"correct."*
- The number that carries weight is one produced by a generator you did not
  write, aimed at cases you did not choose.
- If you hit a round-trip failure, it is a bug worth reporting — §2.1 is where
  the regression case belongs. Given the history above, assume the corpus is
  still incomplete rather than assuming your input is exotic.

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

# Full suite (759 tests)
npm test

# The round-trip property alone
npx vitest run packages/format/tests/lossless-property.test.ts

# Token benchmarks
npx vitest run packages/format/tests/benchmarks/token-count.test.ts
```

Compression figures in §7 were produced by encoding each dataset at every level,
taking the smallest output, and counting tokens with `gpt-tokenizer`'s
`o200k_base` encoder — the same package the playground uses.
