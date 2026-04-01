# Spec: Code Review Corrections for XRON

## Overview
This specification details bug fixes and improvements discovered during the pre-commit code review of the XRON project. The fixes target parsing edge cases, performance regressions, and README formatting.

## Requirements

### 1. Performance Regression in Auto Mode (`src/stringify.ts`)
**Context**: The `stringify` function invokes `assessData(value, opts)` when `opts.level === 'auto'` just to check `rec.willCompress`. `assessData` performs a full pass (schema extraction, dict building, etc.). Then 'auto' mode actually serializes the data 3 more times.
**Requirement**: Remove the costly `assessData` call from `stringify.ts` inside the `isAuto` block. Instead, check the data size directly: evaluate `const jsonStr = JSON.stringify(value);` and if `jsonStr.length < (opts.minCompressSize || 0)`, return `jsonStr`. Let the fallback logic (`candidate.length < bestOutput.length`) handle the rest natively without double-computing everything.

### 2. Key Parsing Fails with Colons (`src/parse.ts`)
**Context**: In `parseKeyValueBlock` and `parseInlineBracketObject`, keys are separated from values using `line.indexOf(':')`. This blindly grabs the first colon, breaking on object keys that contain colons (e.g. `{"my:key": 1}`).
**Requirement**: Create a helper function `splitKeyValue(str)` that iterates through the characters and finds the first colon that sits *outside* of quotes (respecting `inQuotes`), then splits into `[key, value]`.

### 3. Structural Characters in Inline Keys Break Parser (`src/stringify.ts` & `src/parse.ts`)
**Context**: `encodeInlineValue` constructs objects as `${k}: ${encodeInlineValue(v)}`. It does not escape or encode `k`. If an object key contains a comma, quote, or bracket (e.g. `{ "a,b": 1 }`), the inline encoder outputs `{ a,b: 1 }`. `parse.ts` will then split that at the comma, creating invalid chunks.
**Requirement**:
- In `src/stringify.ts`, wrap or escape inline keys when constructing pairs. Use `escapeValue(k)` to ensure structural characters don't leak.
- In `src/parse.ts`, ensure `parseKeyValueBlock` and `parseInlineBracketObject` appropriately decode/unquote the extracted key string before assigning it to the JS object. (e.g., using a helper to trim and unquote if it starts/ends with `"`).

### 4. Backslash Escaping Flaw in `splitRow` and `splitTopLevel` (`src/pipeline/positional.ts`, `src/parse.ts`)
**Context**: Checking `input[i - 1] !== '\\'` to determine if a quote is escaped fails for inputs like `\\"`. The backslash itself is escaped, so the quote is active.
**Requirement**: Track a state variable like `isEscaped`. Set `isEscaped = true` when encountering a backslash and reset it on the next character. Only toggle `inQuotes` if `ch === '"' && !isEscaped`.

### 5. Neutralize README.md Language
**Context**: The README uses emotional language ("brutal overhead", "wastes thousands of tokens").
**Requirement**: Replace emotional phrasing with professional, factual equivalents.
- Change "brutal overhead" to "substantial token overhead".
- Change "wastes thousands of tokens" to "consumes thousands of additional tokens".

## Acceptance Criteria
- All tests in Vitest test suite pass.
- Lossless round-trip works for objects with colons in keys, commas in keys, and backslash-escaped quotes.
- Auto mode no longer computes `assessData`.

## Architecture Context
Follow the established codebase style. Ensure modifications strictly happen in the identified files (`stringify.ts`, `parse.ts`, `positional.ts`, and `README.md`).

<!-- STATUS: approved -->
