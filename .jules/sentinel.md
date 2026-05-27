## 2026-05-01 - Prevent prototype pollution during parser construction

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` where properties like `__proto__` and `constructor` were blindly set on constructed objects if supplied in the serialized payloads.
**Learning:** This occurred due to the custom parsing logic taking untrusted external strings and assigning them verbatim to dynamically created objects via bracket notation.
**Prevention:** Filter out `__proto__` and `constructor` keys before property assignment in all object construction paths within parsers.

## 2024-05-24 - Fix Prototype Pollution in XRON Parser
**Vulnerability:** Prototype pollution was possible via `__proto__`, `constructor`, or `prototype` keys in XRON payloads — both inline and via JSON.parse fallback.
**Learning:** Custom parsers need explicit key blocklists, and JSON.parse needs a reviver to strip dangerous keys from nested objects.
**Prevention:** Block `__proto__`, `constructor`, `prototype` in all object-building paths; add JSON.parse reviver for the JSON fallback path.

## 2024-05-30 - Prevent nested prototype pollution bypass

**Vulnerability:** A prototype pollution vulnerability existed in `packages/format/src/parse.ts` because the parsing logic explicitly filtered `__proto__` and `constructor` but missed `prototype`, enabling bypass via nested assignments (e.g., `constructor.prototype`).
**Learning:** Security blocklists for object parsers must comprehensively cover all prototype manipulation vectors. Neglecting `prototype` leaves a loophole when combined with other special keys or nested structures.
**Prevention:** Ensure `__proto__`, `constructor`, and `prototype` are consistently blocked in all dynamic property assignment paths within parsers.
