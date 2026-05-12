## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.

## 2025-02-28 - Prevent Prototype Pollution via 'prototype' Field in Schema Parsing
**Vulnerability:** A prototype pollution bypass was found in `packages/format/src/parse.ts`. The schema decoding paths successfully blocked `__proto__` and `constructor`, but missed the `prototype` field. This allowed nested assignment bypasses when constructing objects from decoded data rows or nested schema instances.
**Learning:** Checking for special properties needs to comprehensively include `prototype`, not just `__proto__` and `constructor`, specifically in schema-driven mapping where fields are mapped dynamically.
**Prevention:** Extend validation filters in object construction loops to strictly ignore `prototype` assignments.
