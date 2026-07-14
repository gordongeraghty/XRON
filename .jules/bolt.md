
## 2024-05-30 - Replaced regex string replace and split iterators with manual charCodeAt substring scanning
**Learning:** In hot string parsing loops (`parse.ts` and `substring-dict.ts`), utilizing generic string parsing functions like `String.prototype.replace()` with regular expressions, and 1-character string allocations (e.g. `const ch = str[i]`) causes enormous memory overhead and repeated allocations, stalling the V8 garbage collector.
**Action:** Avoid 1-character string assignments and regex replaces inside hot loops. Use `charCodeAt` evaluation instead, and manually scan for the delimiters in `packages/format` functions like `splitTopLevel`, `splitKeyValue`, and `expandSubstringRefs` to drastically improve performance (speedup observed to be up to 5x faster).
