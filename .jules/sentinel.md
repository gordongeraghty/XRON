## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.
## 2025-02-14 - Prevent Prototype Pollution via prototype field
**Vulnerability:** The 'prototype' key was not being filtered out in object parsing/deserialization logic inside schema fields.
**Learning:** Even if '__proto__' and 'constructor' are filtered, failing to filter 'prototype' allows prototype pollution bypasses through nested object assignments (e.g., constructor.prototype).
**Prevention:** Always filter out 'prototype' alongside '__proto__' and 'constructor' in any object parsing or deserialization logic.
