# Changelog

## xron-format 0.4.0

Fixes fourteen silent data-corruption bugs. Every one returned wrong data
without throwing. Anything encoded with 0.3.0 or earlier should be re-encoded
and re-verified.

This is a **breaking wire-format change** — see *Format changes* below. It is a
minor version rather than a patch for that reason: `^0.3.x` consumers will not
pick it up automatically, and should upgrade deliberately.

Contrary to earlier belief, **Level 1 was also affected** (see the colon and
BigInt entries).

### Verification

Round-trip identity `parse(stringify(x)) === x` measured over randomised
payloads across all four levels:

| | Failures |
|---|---|
| 0.3.0 | 2,673 / 4,800 (55.7%) |
| 0.4.0 | 1 / 42,000 across 7 seeds (0.002%) |

The single remaining failure is described under *Known issues*.

### Fixed — temporal

- **Dictionary references past 62 entries were misread as decimal.**
  `resolveDictRef()` tried decimal before base-62, so a two-character base-62
  reference made only of digits (`$00`, `$10`) resolved to `0`, `10` instead of
  `62`, `72`. Any dataset with more than 62 distinct repeated strings returned
  the wrong string. *Levels 2, 3.*
- **`toISOString()` output decoded to the literal string `"NaNs"`.** The
  compact-date pattern made no provision for fractional seconds, so the most
  common timestamp format in JavaScript parsed to `NaN`. *Level 3.*
- **Fractional seconds of any width other than three digits were lost**, via a
  fixed-width `.replace(/\.\d{3}/, '')` in the decoder. *Level 3.*
- **UTC offsets were destroyed.** `compactDate()` stripped every `-`, including
  the offset sign. *Levels 2, 3.*
- **Offsets written without a colon were rewritten with one.** `+05:30` and
  `+0530` compact identically, so colon-less offsets are no longer compacted.
  *Levels 2, 3.*
- **Date-only columns came back as full ISO datetimes.** Dictionary substitution
  runs before temporal delta, so the delta layer anchored on `$0`. *Level 3.*
- **A column mixing date-only and datetime values silently dropped the time.**
  *Level 3.*
- **`XRON.parse()` could throw `RangeError: Invalid time value`** — one bad
  column took down the whole document. It now degrades instead.

### Fixed — structural

- **A string containing `"` broke row splitting.** `needsQuoting` only matched
  an already-fully-quoted value, so an interior quote went out raw and flipped
  the parser's quote state machine, desynchronising every later field in the
  row. This was the single largest source of corruption, and the cause of the
  `Cannot read properties of undefined` crash. *All levels.*
- **A bare top-level string containing a colon parsed as a key/value pair.**
  `XRON.stringify("a:b")` returned `{"a":"b"}`. *All levels, including 1.*
- **An object key containing a colon split at that colon.** *Levels 1–3.*
- **Column templates stripped the delimiters the row splitter depends on**, and
  could leave a residual with significant leading whitespace that the splitter
  then trimmed away (`"has space 17"` → `"has space17"`). *Level 2.*
- **The substring dictionary lifted unbalanced brackets out of cells**, hiding
  them from the splitter, and stored values whose leading/trailing spaces its
  own comma-separated header could not represent. *Level 3.*

### Fixed — type fidelity

- **A literal negative number was accumulated onto the previous row.** The
  decoder inferred delta columns from cell text, independently of what the
  encoder decided, so a plain `-5` in a non-delta column was treated as a delta.
  Needed no dates at all. *Levels 3, auto.*
- **Booleans decoded as the numbers 1 and 0** wherever no `?b` schema hint was
  available — mixed columns, anonymous `@A` arrays, nested objects.
- **BigInt and Number were indistinguishable.** `BigInt(42)` came back as the
  number `42`; the number `1e20` came back as a BigInt, because the decoder
  guessed by digit count.
- **A plain 8-digit integer decoded as a date string.** `{n: 20260101}` returned
  `{n: "2026-01-01"}`.
- **Dates outside 1900–2100 were never expanded back**, due to a hardcoded range.
- **Type hints were promoted too eagerly on mixed columns**: `boolean + number`
  was hinted boolean (so `385.005` became `true`), and `bigint + array` was
  hinted bigint (so the decoder ran `BigInt("[1]")` and threw).

### Format changes

All are on the wire and intentional. There is no format-version field — `@v`
encodes the compression level, not a version — so these are signalled by the
package version only.

- **BigInt values carry a trailing `n`**, matching the JS literal spelling
  (`42n`). Without it a BigInt and a Number are the same bytes.
- **Date-only values are no longer compacted.** `2026-04-01` stays as written; a
  bare `20260401` is indistinguishable from an integer. Datetimes still compact.
- **A new `@X` header records which columns are delta-encoded**, so the decoder
  never infers it. `@X:` with an empty list means "none", distinguishing an
  encoder decision from an absent header.
- **Booleans are only written as `1`/`0` where a `?b` hint will exist** to decode
  them; elsewhere they stay `true`/`false`.
- **Strings containing `"`, and keys or bare strings containing `:`, are
  quoted.** Byte-identical for values that contain neither.

**Reading old documents:** a 0.3.x document containing a compacted date-only
value (`20260401`) will decode as the integer `20260401` under 0.4.0. The
information to distinguish them was never in the bytes. Re-encode rather than
mixing versions.

### Compression impact

Measured against 0.3.0 on 500-row payloads (see [BENCHMARKS.md](BENCHMARKS.md)):

- Data without timestamps: within 0.2%.
- Timestamp columns that now compress correctly: +10% to +18% at Level 3.
- Columns with UTC offsets or mixed date shapes: **20–25% smaller**, because the
  previous delta output for them was both broken and bloated.
- Reduction against JSON with `auto` still measures 64–79%.

### Added

- `packages/format/tests/lossless-property.test.ts` — the round-trip identity run
  over a boundary-focused corpus at levels 1, 2, 3 and `auto`: dictionaries
  either side of 62 entries, fractional seconds of 0/1/2/3/6 digits, offsets of
  both signs, DST crossings, mixed date/datetime columns, nulls, non-monotonic
  and pre-1970 dates, epoch crossings, leap days, values colliding with the
  encoder's own notation (`$0`, `+5s`, `~`), literal negatives, BigInt/Number
  boundaries, nested objects and 2D boolean arrays. Suite total: 314 → 557.
- `LICENSE` in the `xron-format` package directory. It was listed in `files` but
  did not exist, so published tarballs shipped without licence text.

### Known issues

- **One failure in 42,000 randomised round-trips remains, not yet root-caused.**
  Signature: a cell merges with the following cell (`"has space 1"` absorbing an
  adjacent inline object), accompanied by a checksum mismatch warning — which
  suggests an encoder-side inconsistency rather than a decode bug. Reproduces
  only under fuzz seed 8675309; no minimal reproduction yet, so it is not
  covered by a test.

## xron-cli 0.3.0

- Requires `xron-format@^0.4.0` (was `*`, which allowed any future major).

## xron-mcp 0.2.0

- Requires `xron-format@^0.4.0` (was `*`, which allowed any future major).
