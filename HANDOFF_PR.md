<!-- STATUS: review -->

# Handoff: XRON PR Preparation & Hosting

## Phase 1: Missing Integration (LlamaIndex.TS)
- **New Package `packages/integrations/llamaindex`**:
    - **Implementation**:
        - Create `packages/integrations/llamaindex/src/index.ts`.
        - Implement `XRONOutputParser` (extends `BaseOutputParser`).
        - Implement `XRONDocumentCompressor` (consistent with `@langchain/core` implementation).
    - **Code Snippet (Reference)**:
        ```typescript
        import { XRON } from 'xron-format';
        import { BaseOutputParser } from "llamaindex";
        
        export class XRONOutputParser extends BaseOutputParser<any> {
          parse(output: string): any {
            // Strip code fences and parse
            const cleaned = output.replace(/^```(?:xron)?\s*|\s*```$/g, '').trim();
            return XRON.parse(cleaned);
          }
          format(prompt: string): string {
            return `${prompt}\n\nReturn output in XRON format.`;
          }
        }
        ```
    - **Tests**: Add unit tests in `packages/integrations/llamaindex/tests/index.test.ts`.

## Phase 2: PR Kits (`docs/pr-kits/`)
- Create three directories: `docs/pr-kits/langchain`, `docs/pr-kits/llamaindex`, `docs/pr-kits/vercel`.
- For each directory, provide:
    - **`PR_DESCRIPTION.md`**: Professional, data-driven summary highlighting XRON's 80% token reduction and lossless guarantee. Include the comparison chart.
    - **`SUBMISSION_GUIDE.md`**: Step-by-step instructions for Gordon to submit the PR.
- **Goal**: Make it effortless for Gordon to submit these PRs.

## Phase 3: Hosting (Vercel)
- **Deployment**:
    - Navigate to `site/`.
    - Run `vercel --prod` to deploy the playground.
    - Capture the deployment URL and update `README.md` (Live Playground section).

## Files to Touch
- `packages/integrations/llamaindex/*`
- `docs/pr-kits/**/*`
- `README.md`
- `site/**/*`

## Constraints
- **Branding**: Strictly use **XRON Orange (#ff6600)** for all UI highlights and PR description callouts.
- **No side-effects**: Do not change core serialization logic.
- **Verified**: All new code must pass `npm test`.

## Trigger Instructions
Read this file and execute the PR preparation and hosting. Set STATUS to review when done.
