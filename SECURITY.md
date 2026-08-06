# Security Policy

## Supported Versions

Security fixes are applied to the latest release of each package.

| Package | Current Version | Supported |
|---------|----------------|-----------|
| `xron-format` | 0.4.x | Yes |
| `xron-mcp` | 0.2.x | Yes |
| `xron-cli` | 0.3.x | Yes |
| Older releases | — | No |

The agent skill in `packages/skill` is distributed with this repository, not as an npm package; it is covered by this policy at whatever commit you install it from.

## Reporting a Vulnerability

If you discover a security vulnerability in XRON, please report it responsibly.

**Do not open a public issue.** Instead, please report it privately via the GitHub Security tab.

### What to Include

- A description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested fix (optional)
- Which package(s) are affected

## Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Acknowledgement | Within 48 hours of receipt |
| Assessment | Within 7 days — we will confirm whether the report is accepted |
| Fix | Accepted vulnerabilities are patched promptly and disclosed after the fix is released |

## Scope

This policy covers the following npm packages and their source code in this repository:

- `xron-format` — core serialisation library
- `xron-mcp` — MCP compression proxy
- `xron-cli` — command-line tool

It also covers the agent skill in `packages/skill` (repository-distributed, not on npm).

## Security Design

XRON is a **non-executable** data format. Key security properties:

- **No code execution**: XRON documents cannot contain or trigger executable code
- **No prototype pollution**: The parser does not assign to `__proto__`, `constructor`, or `prototype`
- **No eval**: Parsing uses deterministic string operations only
- **Bounded recursion**: Default maximum depth of 100 levels prevents stack overflow attacks
- **Circular reference detection**: `XRON.stringify` throws on circular objects rather than entering infinite loops

### Parsing untrusted input

`XRON.parse` is a decompressor: a document's decoded form can be substantially larger than its encoded form (dictionary and repeat encoding make expansion factors in the hundreds achievable by construction). When parsing XRON from an untrusted source, enforce a byte limit on the encoded input before calling `parse`, and pass `strictValidation: true` so checksum and cardinality mismatches throw instead of logging a warning. The default `maxDepth` of 100 applies in both modes.

## Dependency Policy

XRON's core library (`xron-format`) has **zero runtime dependencies**. The only optional peer dependency is `tiktoken` for exact token counting. This minimises supply-chain attack surface.
