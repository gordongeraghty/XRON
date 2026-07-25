# Vercel AI SDK PR Submission Guide

## Prerequisites

1. A GitHub account
2. Git installed locally
3. Node.js >= 18
4. pnpm installed (`npm install -g pnpm`)

## Steps

### 1. Fork the Vercel AI SDK Repository

Go to [github.com/vercel/ai](https://github.com/vercel/ai) and click **Fork**.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/ai.git
cd ai
pnpm install
```

### 3. Create a Feature Branch

```bash
git checkout -b feat/xron-compression-utilities
```

### 4. Add the Integration

The Vercel AI SDK uses a packages-based monorepo. Add XRON utilities as a community package or propose inclusion in the core utilities:

**Option A: Community Package (Recommended)**

Create a new package:

```
packages/xron/
├── package.json
├── src/
│   └── index.ts
└── tests/
    └── index.test.ts
```

Copy the files from `packages/integrations/vercel/` in the XRON repository and adapt imports.

**Option B: Propose as Core Utility**

If the maintainers prefer, add to `packages/ai/core/`:

```
packages/ai/core/util/xron-compress.ts
packages/ai/core/util/xron-compress.test.ts
```

### 5. Add `xron-format` as a Dependency

```json
{
  "dependencies": {
    "xron-format": ">=0.2.0"
  }
}
```

### 6. Run Tests

```bash
pnpm test --filter=@ai-sdk/xron
```

### 7. Commit and Push

```bash
git add .
git commit -m "feat: add XRON compression utilities for token reduction"
git push origin feat/xron-compression-utilities
```

### 8. Open the PR

1. Go to your fork on GitHub
2. Click **Compare & pull request**
3. Set the base branch to `main` on `vercel/ai`
4. Paste the contents of `PR_DESCRIPTION.md` into the PR body
5. Add labels: `enhancement`
6. Submit

### 9. Alternative: Publish as Standalone npm Package

If the Vercel team prefers to keep the SDK lean, publish `xron-vercel` as a standalone package on npm:

```bash
cd packages/integrations/vercel
npm publish
```

This allows the community to use XRON with the Vercel AI SDK immediately without waiting for upstream approval.

### 10. Follow Up

- Respond to any review feedback promptly
- The Vercel AI SDK team may suggest adapting to their middleware patterns
- Be prepared to integrate with their `wrapLanguageModel` or `LanguageModelV2Middleware` APIs if requested
