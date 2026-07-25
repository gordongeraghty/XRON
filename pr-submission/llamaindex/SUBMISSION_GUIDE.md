# MISSION: LLAMAINDEX.TS

> **Target**: `run-llama/LlamaIndexTS` → `packages/llamaindex/`
> **Badge colour**: #ff6600

---

## What You're Submitting

| Component | Base Class / Interface | Purpose |
|-----------|----------------------|---------|
| `XRONParser` | `BaseOutputParser` | Parse XRON LLM output → JS objects |
| `XRONPostprocessor` | `BaseNodePostprocessor` | Compress `TextNode` arrays → XRON in retrieval pipeline |

Both use the `xron-format` npm package. Zero-hallucination guarantee: `XRON.parse(XRON.stringify(data))` deep-equals the original — verified by $N$ cardinality headers and round-trip checksum.

---

## Prerequisites

- GitHub account (logged in)
- Git installed locally
- Node.js >= 18
- pnpm installed (`npm install -g pnpm`)

---

## Step 1: Fork & Clone

```bash
# Fork github.com/run-llama/LlamaIndexTS via the GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/LlamaIndexTS.git
cd LlamaIndexTS
pnpm install
```

## Step 2: Create Feature Branch

```bash
git checkout -b feat/xron-postprocessor
```

## Step 3: Copy Integration Code

```bash
# Parser + postprocessor (single file)
cp /path/to/xron/pr-submission/llamaindex/integration-code/src/index.ts \
  packages/llamaindex/src/postprocessors/xron.ts

# Tests
cp /path/to/xron/pr-submission/llamaindex/integration-code/tests/index.test.ts \
  packages/llamaindex/tests/xron.test.ts
```

**Important**: Inside the LlamaIndex monorepo, replace the standalone interface declarations at the top of `xron.ts` with real imports:

```typescript
import { BaseOutputParser } from 'llamaindex';
import { BaseNodePostprocessor, TextNode, NodeWithScore, QueryBundle } from 'llamaindex';
```

## Step 4: Register the Exports

In `packages/llamaindex/src/index.ts`, add:

```typescript
export { XRONParser, XRONPostprocessor } from './postprocessors/xron.js';
```

## Step 5: Add Dependency

In `packages/llamaindex/package.json`:

```json
{
  "dependencies": {
    "xron-format": ">=0.2.0"
  }
}
```

Then reinstall:

```bash
pnpm install
```

## Step 6: Build & Test

```bash
pnpm run build --filter=llamaindex
pnpm run test --filter=llamaindex
```

## Step 7: Commit & Push

```bash
git add .
git commit -m "feat: add XRON parser and node postprocessor for token compression"
git push origin feat/xron-postprocessor
```

## Step 8: Open the PR

1. Go to your fork on GitHub
2. Click **Compare & pull request**
3. Base branch: `main` on `run-llama/LlamaIndexTS`
4. Paste the contents of `PR_DESCRIPTION.md` into the PR body
5. Labels: `enhancement`
6. Submit

## Step 9: Follow Up

- LlamaIndex reviews community PRs within 1-2 weeks
- They may ask you to use their exact `TextNode` constructor signature
- The postprocessor pattern is idiomatic — this should be a smooth merge

---

## Files You're Submitting

| File | Purpose |
|------|---------|
| `PR_DESCRIPTION.md` | Copy-paste into the PR body |
| `integration-code/src/index.ts` | Parser + postprocessor source |
| `integration-code/tests/index.test.ts` | Test suite |
