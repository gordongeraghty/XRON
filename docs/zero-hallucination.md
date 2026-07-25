# Why LLMs Hallucinate Large JSON Data (And How We Fixed It)

Large language models are remarkable at reasoning, summarising, and generating text. But when you feed them large structured datasets — hundreds of rows of JSON from a database query, API response, or analytics pipeline — they start making mistakes. Not small mistakes. Fabricated numbers. Merged rows. Invented fields. Silent data loss.

This isn't a bug in any particular model. It's a fundamental consequence of how LLMs process structured data.

## The Problem: LLM Summarisation Is Lossy

When a large JSON payload enters a context window, the model doesn't "read" it the way a database engine does. It tokenises the text, processes it through attention layers, and builds a probabilistic representation. The larger and more repetitive the data, the more likely the model is to:

- **Drop rows silently** — a 500-row dataset might be treated as if it had 480 rows, with no indication that anything is missing.
- **Hallucinate values** — the model "fills in" plausible-looking data that doesn't exist in the source. Revenue figures get rounded. Dates shift. IDs collide.
- **Merge similar records** — two customers named "Smith" in different regions might collapse into one in the model's internal representation.
- **Lose type fidelity** — `BigInt` values lose precision, `null` becomes `"null"` or `0`, booleans become strings.

These failures are particularly dangerous because they're invisible. The model doesn't warn you. It presents hallucinated results with the same confidence as accurate ones.

If you're building RAG pipelines, agent workflows, or analytics dashboards that depend on exact data — this is a serious problem.

## The Root Cause: Token Overhead

JSON is extraordinarily wasteful in a token context. Every row repeats every key name. Every string is wrapped in quotes. Every object gets braces and commas. In a 500-row dataset with 7 fields, the structural overhead — keys, quotes, braces, brackets — can account for over 60% of the total token count.

This overhead doesn't carry information. It's redundant. But it consumes context window capacity that could be used for actual data or reasoning. When the context fills up, the model either truncates silently or degrades in comprehension quality.

## The Fix: Algorithmic Encoding, Not LLM Summarisation

XRON takes a fundamentally different approach. Instead of asking an LLM to "understand" or "summarise" the data (a lossy, probabilistic process), XRON applies deterministic algorithmic compression before the data ever reaches the model.

The compression pipeline extracts schemas, builds dictionaries for repeated values, applies delta encoding for sequential columns, and eliminates structural redundancy — all without touching the actual data values.

The result: **60–80% fewer tokens** with a strict lossless guarantee. `XRON.parse(XRON.stringify(data))` returns the exact original data, every time. Not approximately. Not "close enough." Exactly.

This means:

- **Zero hallucination risk** — the data is encoded, not summarised. No probabilistic interpretation occurs.
- **Exact type preservation** — `BigInt`, `Date`, `null`, nested objects, and mixed arrays survive the round trip with full fidelity.
- **More data per query** — the same context window that held 100 rows of JSON can hold 300–500 rows of XRON. More data means better LLM reasoning.
- **Lower API costs** — 80% fewer input tokens translates directly to 80% lower costs on token-priced APIs.

## Compression vs. Summarisation

| Approach | Lossless | Deterministic | Preserves Types | Hallucination Risk |
|----------|----------|---------------|-----------------|-------------------|
| LLM summarisation | No | No | No | High |
| Truncation | No | Yes | Partial | Medium (missing data) |
| XRON encoding | **Yes** | **Yes** | **Yes** | **None** |

The distinction matters. Summarisation is useful when you want a human-readable digest. But when your application depends on exact data — when a wrong number means a wrong decision — you need lossless compression for LLMs, not lossy summarisation.

XRON preserves exact data types, compresses Native BigInt for AI context windows, and delivers lossless JSON compression for LLMs at every scale. That's not a feature. It's the entire point.
