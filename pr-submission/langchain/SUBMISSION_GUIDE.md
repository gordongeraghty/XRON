# MISSION: LANGCHAIN.js

> **Target**: `langchain-ai/langchainjs` → `libs/langchain-community/`
> **Badge colour**: #ff6600

---

## What You're Submitting

| Component | Base Class | Purpose |
|-----------|-----------|---------|
| `XRONOutputParser` | `BaseOutputParser` | Parse XRON LLM output → JS objects |
| `XRONTransformOutputParser` | `BaseTransformOutputParser` | Streaming-compatible XRON parser |
| `XRONDocumentCompressor` | `BaseDocumentCompressor` | Compress RAG docs → XRON for prompt injection |

All three use the `xron-format` npm package. Zero-hallucination guarantee: `XRON.parse(XRON.stringify(data))` deep-equals the original — verified by $N$ cardinality headers and round-trip checksum.

---

## Prerequisites

- GitHub account (logged in)
- Git installed locally
- Node.js >= 18
- Yarn (the LangChain.js monorepo uses Yarn)

---

## Step 1: Fork & Clone

```bash
# Fork github.com/langchain-ai/langchainjs via the GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/langchainjs.git
cd langchainjs
yarn install
```

## Step 2: Create Feature Branch

```bash
git checkout -b feat/xron-output-parser
```

## Step 3: Copy Integration Code

```bash
# Parser + transform parser + document compressor (single file)
cp /path/to/xron/pr-submission/langchain/integration-code/src/index.ts \
  libs/langchain-community/src/output_parsers/xron.ts

# Tests
cp /path/to/xron/pr-submission/langchain/integration-code/tests/integration.test.ts \
  libs/langchain-community/src/output_parsers/tests/xron.test.ts
```

> **Imports stay as-is**: `@langchain/core/output_parsers` is a LangChain package; `xron-format` is external.

## Step 4: Register the Exports

In `libs/langchain-community/src/output_parsers/index.ts`, add:

```typescript
export { XRONOutputParser, XRONTransformOutputParser } from './xron.js';
```

In `libs/langchain-community/src/retrievers/document_compressors/index.ts`, add:

```typescript
export { XRONDocumentCompressor } from '../../output_parsers/xron.js';
```

## Step 5: Add Peer Dependency

In `libs/langchain-community/package.json`:

```json
{
  "peerDependencies": {
    "xron-format": ">=0.2.0"
  },
  "peerDependenciesMeta": {
    "xron-format": { "optional": true }
  }
}
```

## Step 6: Build & Test

```bash
cd libs/langchain-community
yarn build
yarn test xron
```

## Step 7: Commit & Push

```bash
git add .
git commit -m "feat(community): add XRON output parser, transform parser, and document compressor"
git push origin feat/xron-output-parser
```

## Step 8: Open the PR

1. Go to your fork on GitHub
2. Click **Compare & pull request**
3. Base branch: `main` on `langchain-ai/langchainjs`
4. Paste the contents of `PR_DESCRIPTION.md` into the PR body
5. Labels: `enhancement`, `community`
6. Submit

## Step 9: Follow Up

- LangChain reviews community PRs within 1-2 weeks
- They may ask you to add entrypoint exports in `langchain-community/src/load/import_map.ts`
- Be prepared to adapt the `lc_namespace` if they have a preferred convention

---

## Files You're Submitting

| File | Purpose |
|------|---------|
| `PR_DESCRIPTION.md` | Copy-paste into the PR body |
| `integration-code/src/index.ts` | Parser + transform parser + compressor source |
| `integration-code/tests/integration.test.ts` | Test suite |
