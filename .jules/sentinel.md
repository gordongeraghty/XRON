## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.

## 2025-03-08 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** A prototype pollution bypass was possible in the XRON parser because the `prototype` property was not filtered when decoding schema instances and schema rows, whereas `__proto__` and `constructor` were properly protected.
**Learning:** Checking for `__proto__` and `constructor` is insufficient when objects nested inside property paths or dynamically generated schemas allow direct assignment to `.prototype`.
**Prevention:** Ensure complete filtering of all prototype manipulation keys (`__proto__`, `constructor`, `prototype`) in any custom deserialization or mapping logic.
