# MISSION: VERCEL AI SDK

> **Target**: `vercel/ai` → community wrapper or `@ai-sdk/xron`
> **Badge colour**: #ff6600

---

## What You're Submitting

| Component | Type | Purpose |
|-----------|------|---------|
| `xronMiddleware()` | `LanguageModelV2Middleware` | Auto-compress JSON arrays in messages before they hit the model |
| `compressDataForPrompt()` | Utility function | Manual XRON compression for prompt injection |
| `createXRONMessage()` | Utility function | Create AI SDK message with XRON-compressed content |

The middleware uses `experimental_wrapLanguageModel` for drop-in integration — wrap any model and all JSON array content in system/user messages is automatically compressed. Zero-hallucination guarantee: `XRON.parse(XRON.stringify(data))` deep-equals the original — verified by $N$ cardinality headers and round-trip checksum.

---

## Prerequisites

- GitHub account (logged in)
- Git installed locally
- Node.js >= 18
- pnpm installed (`npm install -g pnpm`)

---

## Step 1: Fork & Clone

```bash
# Fork github.com/vercel/ai via the GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/ai.git
cd ai
pnpm install
```

## Step 2: Create Feature Branch

```bash
git checkout -b feat/xron-middleware
```

## Step 3: Copy Integration Code

```bash
# Create the package directory
mkdir -p packages/xron/src packages/xron/tests

# Copy source
cp /path/to/xron/pr-submission/vercel-ai-sdk/integration-code/src/index.ts \
  packages/xron/src/index.ts

# Copy tests
cp /path/to/xron/pr-submission/vercel-ai-sdk/integration-code/tests/index.test.ts \
  packages/xron/tests/index.test.ts
```

**Important**: Inside the AI SDK monorepo, replace the standalone type declarations with real imports:

```typescript
import type { LanguageModelV2Middleware } from 'ai';
```

## Step 4: Create Package Config

Create `packages/xron/package.json`:

```json
{
  "name": "@ai-sdk/xron",
  "version": "0.1.0",
  "description": "XRON compression middleware for Vercel AI SDK — 60-80% token reduction",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "xron-format": ">=0.2.0"
  },
  "peerDependencies": {
    "ai": ">=3.0.0"
  }
}
```

## Step 5: Build & Test

```bash
pnpm run build --filter=@ai-sdk/xron
pnpm run test --filter=@ai-sdk/xron
```

## Step 6: Commit & Push

```bash
git add .
git commit -m "feat: add XRON compression middleware for automatic token reduction"
git push origin feat/xron-middleware
```

## Step 7: Open the PR

1. Go to your fork on GitHub
2. Click **Compare & pull request**
3. Base branch: `main` on `vercel/ai`
4. Paste the contents of `PR_DESCRIPTION.md` into the PR body
5. Labels: `enhancement`
6. Submit

---

## Usage: Middleware (Recommended)

Drop-in automatic compression via `experimental_wrapLanguageModel`:

```typescript
import { xronMiddleware } from '@ai-sdk/xron';
import { experimental_wrapLanguageModel, generateText } from 'ai';

const model = experimental_wrapLanguageModel({
  model: yourModel,
  middleware: xronMiddleware({ level: 'auto' }),
});

const { text } = await generateText({
  model,
  messages: [
    { role: 'system', content: JSON.stringify(largeDataset) },
    { role: 'user', content: 'Analyse this data' },
  ],
});
```

## Usage: Manual Drop

For fine-grained control, compress explicitly:

```typescript
import { compressDataForPrompt, createXRONMessage } from '@ai-sdk/xron';
import { generateText } from 'ai';

// Option A: compress into a prompt string
const compressed = compressDataForPrompt(users, { level: 2 });
const { text } = await generateText({
  model: yourModel,
  prompt: `Data:\n${compressed}\n\nHow many users are active?`,
});

// Option B: create a pre-compressed message
const msg = createXRONMessage('system', products);
const { text: text2 } = await generateText({
  model: yourModel,
  messages: [msg, { role: 'user', content: 'Summarise the catalogue' }],
});
```

---

## Alternative: Publish as Standalone npm Package

If the Vercel team prefers to keep the SDK lean:

```bash
cd packages/integrations/vercel
npm publish
```

This lets the community use XRON with the AI SDK immediately without waiting for upstream approval.

## Follow Up

- The Vercel AI SDK team may ask you to adapt to their latest middleware API
- The `LanguageModelV2Middleware` pattern is the idiomatic approach for AI SDK 3.x+
- Be prepared to update type imports if they rename or restructure middleware types

---

## Files You're Submitting

| File | Purpose |
|------|---------|
| `PR_DESCRIPTION.md` | Copy-paste into the PR body |
| `integration-code/src/index.ts` | Middleware + utility functions source |
| `integration-code/tests/index.test.ts` | Test suite |
