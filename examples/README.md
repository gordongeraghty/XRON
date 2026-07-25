# XRON Examples

Runnable examples showing how to integrate XRON into real-world AI workflows. Each example is a self-contained TypeScript file you can run with `tsx`.

## Quick Start

```bash
npm install xron-format
```

## SDK Examples

Drop-in integration with every major AI provider:

| File | Stack | What It Shows |
|------|-------|---------------|
| [`openai-node.ts`](openai-node.ts) | OpenAI Node SDK | Compress structured data before a chat completion |
| [`anthropic-sdk.ts`](anthropic-sdk.ts) | Anthropic SDK | Compress tool output before passing to Claude |
| [`google-gemini.ts`](google-gemini.ts) | Google Gemini SDK | Compress inventory data for Gemini analysis |

## Cookbook

Production integration patterns for popular AI stacks:

| File | Stack | What It Shows |
|------|-------|---------------|
| [`cookbook/vercel-ai-sdk.ts`](cookbook/vercel-ai-sdk.ts) | Vercel AI SDK | `generateText` and `streamText` with XRON-compressed context |
| [`cookbook/langchain-parser.ts`](cookbook/langchain-parser.ts) | LangChain | Custom `XRONOutputParser` for chain pipelines |
| [`cookbook/pinecone-rag.ts`](cookbook/pinecone-rag.ts) | Pinecone + OpenAI | Compress RAG retrieval payloads before prompt injection |
| [`cookbook/mcp-tool-compression.ts`](cookbook/mcp-tool-compression.ts) | MCP | Manual tool response compression in a custom MCP server |
| [`cookbook/batch-cost-analysis.ts`](cookbook/batch-cost-analysis.ts) | CLI utility | Measure token savings and cost projections across JSON files |

## Running Examples

All examples are TypeScript and can be run with `tsx`:

```bash
npx tsx examples/openai-node.ts
npx tsx examples/google-gemini.ts
npx tsx examples/cookbook/batch-cost-analysis.ts data/*.json
```

Set the relevant API key before running SDK examples:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

## Token Savings Preview

Run the batch cost analysis tool against your own data to see exact savings:

```bash
npx tsx examples/cookbook/batch-cost-analysis.ts your-data.json
```

Output:
```
JSON:           45,230 chars
XRON (auto):    12,150 chars
Reduction:      73%
Tokens saved:   ~8,940 per request
Cost saved:     ~$22.35 per 1,000 requests (GPT-4o input)
```
