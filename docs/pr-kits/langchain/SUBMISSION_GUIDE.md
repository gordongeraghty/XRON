# LangChain PR Submission Guide

## Prerequisites

1. A GitHub account
2. Git installed locally
3. Node.js >= 18

## Steps

### 1. Fork the LangChain.js Repository

Go to [github.com/langchain-ai/langchainjs](https://github.com/langchain-ai/langchainjs) and click **Fork**.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/langchainjs.git
cd langchainjs
```

### 3. Create a Feature Branch

```bash
git checkout -b feat/xron-output-parser
```

### 4. Add the Integration

Copy the files from `packages/integrations/langchain/` in the XRON repository into the appropriate location in the LangChain.js monorepo. The typical structure is:

```
libs/langchain-community/src/output_parsers/xron.ts
libs/langchain-community/src/retrievers/document_compressors/xron.ts
libs/langchain-community/src/tests/xron.test.ts
```

Adapt imports to match LangChain's internal module structure.

### 5. Add `xron-format` as a Peer Dependency

In `libs/langchain-community/package.json`, add:

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

### 6. Run Tests

```bash
cd libs/langchain-community
yarn test xron
```

### 7. Commit and Push

```bash
git add .
git commit -m "feat(community): add XRON output parser and document compressor"
git push origin feat/xron-output-parser
```

### 8. Open the PR

1. Go to your fork on GitHub
2. Click **Compare & pull request**
3. Set the base branch to `main` on `langchain-ai/langchainjs`
4. Paste the contents of `PR_DESCRIPTION.md` into the PR body
5. Add labels: `enhancement`, `community`
6. Submit

### 9. Follow Up

- Respond to any review feedback promptly
- The LangChain team typically reviews community PRs within 1-2 weeks
- Be prepared to adjust import paths or add entrypoint exports per their conventions
