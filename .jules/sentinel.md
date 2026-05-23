## 2024-05-24 - [Prototype Pollution via Schema Def]
**Vulnerability:** The XRON parser's schema decoding logic filtered `__proto__` and `constructor` to prevent prototype pollution but failed to filter `prototype`. This allowed an attacker to bypass the blocklist when parsing schema instances where fields were named `prototype`, potentially polluting the nested prototype object.
**Learning:** Object instantiation routines must comprehensively filter all reserved prototype keywords (including `prototype`), not just `__proto__` and `constructor`, to ensure defense-in-depth against nested prototype injection.
**Prevention:** Include `prototype` alongside `__proto__` and `constructor` consistently across all deserialization blocklists.
