## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.

## 2024-05-18 - Fix Prototype Pollution bypass in XRON Parser
**Vulnerability:** A bypass to the existing prototype pollution protection existed. Even though `__proto__` and `constructor` were blocked, `prototype` was not blocked in the object construction paths when resolving nested schemas. This allowed `constructor: { prototype: { polluted: true } }` payloads to pollute prototypes.
**Learning:** Preventing prototype pollution via constructor bypassing requires strictly blocking `prototype` properties in addition to `__proto__` and `constructor`, ensuring objects that are nested don't traverse property paths.
**Prevention:** Always block `__proto__`, `constructor`, AND `prototype` uniformly across all object construction paths during data parsing.
