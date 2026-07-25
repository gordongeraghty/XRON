# xron-format

Extensible Reduced Object Notation — a lossless, drop-in replacement for
`JSON.stringify`/`JSON.parse` that cuts LLM token usage by removing the
structural overhead JSON pays on every request: repeated keys, repeated
values, and punctuation a tokeniser has to spend tokens on.

`XRON.parse(XRON.stringify(data))` deep-equals `data`. Nothing is dropped,
summarised, or approximated — it's an algorithmic encoder, not an LLM.

[![npm version](https://img.shields.io/npm/v/xron-format.svg?style=flat-square)](https://www.npmjs.com/package/xron-format)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](https://github.com/gordongeraghty/XRON/blob/master/LICENSE)

## Install

```bash
npm install xron-format
```

## Usage

```typescript
import { XRON } from 'xron-format';

const data = [
  { id: 1, name: 'Alice', dept: 'Sales' },
  { id: 2, name: 'Bob', dept: 'Engineering' },
  { id: 3, name: 'Carol', dept: 'Sales' },
];

const xron = XRON.stringify(data);
// @v2
// @S A: id, name, dept
// @D: Sales
// @N3 A
// 1, Alice, $0
// 2, Bob, Engineering
// 3, Carol, $0

const restored = XRON.parse(xron);
// restored deep-equals data
```

## How much smaller is it?

Depends on how much of your payload is structure versus information — XRON
removes repeated keys and repeated values, so it can't shrink data that's
already unique. Measured with the real `o200k_base` tokenizer:

| Your data looks like | Token reduction |
|---|---:|
| Identical repeated rows, long string values | **up to 91%** |
| Wide tables, small vocabulary (30 cols) | **~80%** |
| Boolean/flag matrices (20 cols) | **~71%** |
| Typical business records (6 fields) | **~48%** |
| Unique UUIDs or unique prose | **~21%** |

Full methodology and per-shape figures: [BENCHMARKS.md](https://github.com/gordongeraghty/XRON/blob/master/BENCHMARKS.md).

## API

### `XRON.stringify(value, options?): string`

| Option | Type | Default | Description |
|---|---|---|---|
| `level` | `1 \| 2 \| 3 \| 'auto'` | `2` | Compression level. `'auto'` picks whichever level produces the smallest output. |
| `minCompressSize` | `number` | `0` | Below this JSON byte size, `'auto'` returns plain JSON rather than attempting compression. |
| `tokenizer` | `'o200k_base' \| 'cl100k_base' \| 'claude'` | `'o200k_base'` | BPE tokeniser profile used by Level 3's optimisation pass. |

Guarantees in `auto` mode: output always round-trips losslessly, and is never larger than `JSON.stringify(value)`.

Throws `TypeError` on circular references.

### `XRON.parse(input): any`

Parses an XRON string back to the original value.

## Verification

Round-trip identity (`parse(stringify(x)) === x`) is tested against a
boundary-focused fuzzing corpus across all four levels, plus three rounds of
independently-written adversarial fuzzers. Full bug list, test counts, and
methodology: [docs/VERIFICATION.md](https://github.com/gordongeraghty/XRON/blob/master/docs/VERIFICATION.md).

## License

MIT — see [LICENSE](https://github.com/gordongeraghty/XRON/blob/master/LICENSE).
