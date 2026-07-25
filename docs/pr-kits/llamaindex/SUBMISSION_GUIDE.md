# LlamaIndex.TS PR Submission Guide

## Prerequisites

1. A GitHub account
2. Git installed locally
3. Node.js >= 18

## Steps

### 1. Fork the LlamaIndex.TS Repository

Go to [github.com/run-llama/LlamaIndexTS](https://github.com/run-llama/LlamaIndexTS) and click **Fork**.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/LlamaIndexTS.git
cd LlamaIndexTS
```

### 3. Create a Feature Branch

```bash
git checkout -b feat/xron-output-parser
```

### 4. Add the Integration

Copy the files from `packages/integrations/llamaindex/` in the XRON repository into the appropriate location. The typical structure is:

```
packages/llamaindex/src/output_parsers/xron.ts
packages/llamaindex/src/postprocessors/xron_compressor.ts
packages/llamaindex/tests/xron.test.ts
```

Adapt imports to match LlamaIndex.TS's internal module structure. Key differences from the standalone package:

- Use LlamaIndex's `BaseOutputParser` base class instead of the standalone class
- Adapt the document compressor to implement LlamaIndex's `BaseNodePostprocessor` interface
- Use `TextNode` instead of plain objects for document representation

### 5. Add `xron-format` as a Dependency

In `packages/llamaindex/package.json`, add:

```json
{
  "dependencies": {
    "xron-format": ">=0.2.0"
  }
}
```

### 6. Export from the Package Entry Point

Add exports in `packages/llamaindex/src/index.ts`:

```typescript
export { XRONOutputParser } from './output_parsers/xron.js';
export { XRONDocumentCompressor } from './postprocessors/xron_compressor.js';
```

### 7. Run Tests

```bash
pnpm test -- --filter=llamaindex
```

### 8. Commit and Push

```bash
git add .
git commit -m "feat: add XRON output parser and document compressor"
git push origin feat/xron-output-parser
```

### 9. Open the PR

1. Go to your fork on GitHub
2. Click **Compare & pull request**
3. Set the base branch to `main` on `run-llama/LlamaIndexTS`
4. Paste the contents of `PR_DESCRIPTION.md` into the PR body
5. Add labels: `enhancement`
6. Submit

### 10. Follow Up

- Respond to any review feedback promptly
- The LlamaIndex team may request adaptations to match their node/document abstractions
- Be prepared to refactor to use `TextNode` and `BaseNodePostprocessor` if required
