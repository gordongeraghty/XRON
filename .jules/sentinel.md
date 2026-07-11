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


## 2026-07-11 - Prototype Pollution in Positional Decoding
**Vulnerability:** Found prototype pollution vulnerability in `packages/format/src/pipeline/positional.ts` during positional and nested object parsing.
**Learning:** When parsing schemas and positional data dynamically using bracket notation, special keys like `__proto__`, `constructor`, and `prototype` must be filtered to avoid overwriting Object prototype methods.
**Prevention:** Always explicitly check for and block special keys when dynamically assigning properties to objects during deserialization.
