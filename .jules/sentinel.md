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

## 2024-05-24 - Missing Prototype Pollution Protection in Positional Parser
**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/pipeline/positional.ts` where `decodePositionalRows` lacked filtering for the special keys `__proto__`, `constructor`, and `prototype`. When parsing nested schemas, this allowed malicious payloads to assign attributes to the object prototype.
**Learning:** Even if the top-level keys in a schema do not pollute the prototype natively, if the schema configuration includes `__proto__`, `constructor` or `prototype` as valid fields, property assignment loop will assign properties to those special keys. All dynamic property assignments from user-controlled object structures need explicit blocklists for prototype pollution keys.
**Prevention:** Filter out `__proto__`, `constructor`, and `prototype` in `decodePositionalRows` object-building paths.
