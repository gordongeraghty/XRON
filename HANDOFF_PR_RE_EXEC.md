<!-- STATUS: review -->

# Handoff: XRON PR Redo & Bundling

Gordon couldn't see the previous version, so we are re-executing this bundling and deployment with higher visibility.

## Phase 1: Bundle all PR Kits (`pr-submission/`)
- Create a `pr-submission/` directory at the project root.
- Copy/Create the following for **LangChain**, **LlamaIndex**, and **Vercel AI SDK**:
    - **`PR_DESCRIPTION.md`**: Custom markdown description (Title, Summary, Why XRON, Benchmarks, Usage).
    - **`integration-code/`**: A bundle of the corresponding `packages/integrations/` source and tests.
    - **`SUBMISSION_GUIDE.md`**: Step-by-step "Gordon-Proof" guide to submitting the PR (link to the specific branch and files).

## Phase 2: Missing Integration (LlamaIndex.TS)
- Ensure `packages/integrations/llamaindex` is fully implemented and tested.
- If not yet done, implement `XRONOutputParser` and `XRONDocumentCompressor` for LlamaIndex.TS.

## Phase 3: Hosting (Vercel)
- Navigate to `site/`.
- Run `vercel --prod` to deploy the playground.
- **IMPORTANT**: Once deployed, update the `README.md` at the project root with the **Live Production URL**.

## Files to Touch
- `pr-submission/**/*` [NEW]
- `packages/integrations/llamaindex/*`
- `README.md`
- `site/**/*`

## Constraints
- **#ff6600 Branding**: Ensure all PR descriptions and guides use the XRON Orange styling.
- **Zero Hallucination**: Emphasize this in all PR copy.
- **Verified**: All new code must pass `npm test`.

## Trigger Instructions
Read this file, bundle the kits, and redeploy. Set STATUS to review when done.
