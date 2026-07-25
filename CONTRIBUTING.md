# Contributing to XRON

Thanks for your interest in contributing to XRON — the lossless serialisation format that cuts LLM token costs by up to 80%.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9 (ships with Node 18+)

## Local Development Setup

XRON uses **npm workspaces** to manage packages in a monorepo.

```bash
git clone https://github.com/gordongeraghty/XRON.git
cd XRON
npm install
```

This installs dependencies for all packages:

| Package | Path | Purpose |
|---------|------|---------|
| `xron-format` | `packages/format` | Core serialisation library |
| `xron-mcp` | `packages/mcp` | MCP compression proxy |
| `xron-cli` | `packages/cli` | CLI tool |
| `xron-skill` | `packages/skill` | Agent skill |

## Building

```bash
# Build all packages
npm run build

# Build a single package
npm run build --workspace=packages/format
```

## Running Tests

```bash
# Run the full test suite (234+ tests via Vitest)
npm test

# Watch mode for active development
npm run test:watch
```

All tests must pass before submitting a PR. The test suite includes property-based generative tests that verify lossless round-trip behaviour across randomised payloads.

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages (ESM + CJS + types) |
| `npm test` | Run all tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run bench` | Run benchmarks |
| `npm run lint` | Type-check with TypeScript |

## Project Structure

```
packages/
  format/src/
    index.ts              Main entry point, XRON namespace, analyze()
    stringify.ts           Serialisation engine (9-layer pipeline)
    parse.ts               Deserialisation engine
    types.ts               Core type definitions
    pipeline/              Compression layers (L0-L9)
    format/                Header formatting and parsing
    utils/                 Shared utilities
  mcp/                     MCP compression proxy
  cli/                     CLI tool
  skill/                   Agent skill
examples/
  openai-node.ts           OpenAI SDK integration example
  anthropic-sdk.ts         Anthropic SDK integration example
  cookbook/                 Production integration patterns
```

## Pull Request Process

1. **Fork** the repository and create a feature branch from `master`.
2. Make your changes and ensure `npm test` passes.
3. Write clear commit messages describing *why*, not just *what*.
4. Open a PR against `master` with a short description and test plan.
5. Ensure CI checks pass before requesting review.

### Code Guidelines

- All changes must pass `npm test` — lossless round-trip tests are the primary correctness guarantee.
- New compression techniques should be added as new pipeline layers with clear entry/exit contracts.
- The format must remain human-readable at Level 1.
- Performance matters: the serialiser should add minimal overhead beyond `JSON.stringify`.
- Keep PRs focused — one feature or fix per PR where possible.

### What Makes a Good Contribution

- **Bug fixes** with a regression test
- **New compression layers** that demonstrably reduce token counts without breaking losslessness
- **Benchmark improvements** with before/after numbers
- **Integration examples** for popular AI frameworks (add to `examples/cookbook/`)
- **Documentation** fixes and clarifications

## Code of Conduct

Be respectful, constructive, and inclusive. We're building tools to make AI more efficient for everyone.

## Questions?

Open an issue on [GitHub](https://github.com/gordongeraghty/XRON/issues) if anything is unclear.
