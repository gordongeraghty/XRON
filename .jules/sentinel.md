## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.
## 2024-05-24 - Prototype Pollution Filter Bypass
**Vulnerability:** Missing filter for the `prototype` key in `decodeSchemaRows` and `decodeSchemaInstance`.
**Learning:** Prototype pollution bypasses can occur when objects are instantiated and populated by bypassing `__proto__` and `constructor` but not `prototype` during deep property assignment.
**Prevention:** Always filter out `prototype` along with `__proto__` and `constructor` during object deserialization and assignment.
## 2025-02-20 - Prototype Pollution Bypass via Nested Assignment
**Vulnerability:** The XRON parser filters __proto__ and constructor keys to prevent prototype pollution, but initializes deserialized objects with {} (which inherits from Object.prototype). This allows attackers to bypass filters by providing nested structures like {constructor: {prototype: {polluted: "yes"}}}.
**Learning:** Checking keys at the top-level string parsing phase is insufficient if the constructed objects inherit from Object.prototype, as nested assignments can still traverse the prototype chain.
**Prevention:** Always initialize objects created during parsing/deserialization with Object.create(null) to ensure they have no prototype chain, making prototype pollution impossible regardless of nested payloads.
