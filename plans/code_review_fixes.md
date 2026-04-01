# Implementation Plan: Code Review Fixes

- [x] Modify `src/stringify.ts` line ~62-90 (Auto mode)
  - Remove `assessData` execution inside `isAuto`.
  - Use `JSON.stringify(value)` length vs `opts.minCompressSize`.
- [x] Implement `splitKeyValue` helper in `src/parse.ts`
  - Find the first `:` correctly taking quoted strings into account.
  - Update `parseKeyValueBlock` and `parseInlineBracketObject` to use this robust split function.
- [x] Escape object keys in `encodeInlineValue` (`src/stringify.ts`)
  - Use `escapeValue(k)` for object properties (around line 355).
- [x] Decode keys in `src/parse.ts`
  - Ensure decoded keys handle unquoting properly if they were escaped during stringify.
- [x] Fix escaped backslash logic
  - Fix `splitRow` in `src/pipeline/positional.ts` using `isEscaped` state.
  - Fix `splitTopLevel` in `src/parse.ts` using same logic.
- [x] Update README.md
  - Replace "brutal overhead" with "substantial token overhead".
  - Replace "wastes thousands of tokens" with "consumes thousands of additional tokens".
- [x] Run `npm run test` to verify changes.

<!-- STATUS: review -->
