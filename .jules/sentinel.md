## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.

## 2024-05-24 - Fix missing prototype pollution check
**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `prototype` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred because the `__proto__` and `constructor` properties were blocked from object assignment in XRON schemas, but `prototype` was missing. By supplying `prototype` with a nested payload, it could pollute the prototype structure.
**Prevention:** Filter out `prototype` alongside `__proto__` and `constructor` before property assignment in all object construction paths within parsers.
