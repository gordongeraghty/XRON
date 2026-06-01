## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.

## 2026-06-01 - Fix Incomplete Prototype Pollution Prevention Bypass via Schema Fields
**Vulnerability:** A prototype pollution bypass was possible via the `prototype` field when using custom schema object instantiations like `SchemaName(val)`. The prior prototype pollution checks in `decodeSchemaRows` and `decodeSchemaInstance` only blocked `__proto__` and `constructor`, but failed to filter out the `prototype` key.
**Learning:** Incomplete property filtering allows bypasses, specifically through nested path assignments involving `constructor.prototype` if `prototype` is left unfiltered.
**Prevention:** Always block all dangerous keys (`__proto__`, `constructor`, `prototype`) comprehensively across every single property assignment and object-building path during data deserialization.
