<!-- STATUS: review -->

# Handoff: XRON Ecosystem Infiltration (The 3 Missions)

Refine the 3 ecosystem PR kits into hyper-specific, "Gordon-proof" Mission briefings. Refactor the integration code for each platform to use their native abstractions.

## Tasks

### 1. LangChain Mission: The Community Expansion
- **Target**: `langchain-community/libs/langchain-community`
- **Refactor `integration-code/src/index.ts`**:
    - Support `BaseOutputParser` and `BaseTransformOutputParser` (streaming).
- **Update `SUBMISSION_GUIDE.md`**:
    - Provide exact `yarn` commands for the monorepo structure.
    - Title it "MISSION: LANGCHAIN.js".

### 2. LlamaIndex Mission: The Postprocessor Protocol
- **Target**: `packages/llamaindex`
- **Refactor `integration-code/src/index.ts`**:
    - **Implement `XRONPostprocessor`**: Extends `BaseNodePostprocessor` to compress `TextNode` objects.
    - **Implement `XRONParser`**: Extends `BaseOutputParser`.
- **Update `SUBMISSION_GUIDE.md`**:
    - Provide exact `pnpm` commands for forking and testing.
    - Title it "MISSION: LLAMAINDEX.TS".

### 3. Vercel AI SDK Mission: The Middleware Masterclass
- **Target**: `@ai-sdk/core` or community wrapper.
- **Refactor `integration-code/src/index.ts`**:
    - **Implement `xronMiddleware`**: A `LanguageModelV2Middleware` (AI SDK 3.x) for automatic compression.
    - Support `experimental_wrapLanguageModel` for easy integration.
- **Update `SUBMISSION_GUIDE.md`**:
    - Focus on the middleware and manual-drop procedures.
    - Title it "MISSION: VERCEL AI SDK".

## Files to Touch
- `pr-submission/langchain/integration-code/src/index.ts`
- `pr-submission/langchain/SUBMISSION_GUIDE.md`
- `pr-submission/llamaindex/integration-code/src/index.ts`
- `pr-submission/llamaindex/SUBMISSION_GUIDE.md`
- `pr-submission/vercel-ai-sdk/integration-code/src/index.ts`
- `pr-submission/vercel-ai-sdk/SUBMISSION_GUIDE.md`

## Constraints
- **Branding**: Use #ff6600 for all badges and UI accents.
- **Zero-Hallucination**: Emphasize $N$ and checksum logic for integrity.
- **Gordon-Proof**: Commands must be copy-pasteable without modification.

## Trigger Instructions
Read this file and execute the implementation plan. Run `npm test` locally to ensure no regressions in core format. Set STATUS to review when done.
