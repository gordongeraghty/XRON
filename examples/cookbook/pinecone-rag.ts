/**
 * Cookbook Example: XRON + Pinecone (RAG Context Compression)
 *
 * After retrieving documents from Pinecone, compress the metadata
 * payload with XRON before injecting it into the LLM prompt.
 * This lets you fit 3-5x more context per query.
 *
 * Install:
 *   npm install xron-format @pinecone-database/pinecone openai
 */

import { XRON } from 'xron-format';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pc = new Pinecone();
const openai = new OpenAI();

async function ragQuery(question: string) {
  const index = pc.index('knowledge-base');

  // 1. Embed the question (using OpenAI for brevity)
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });
  const vector = embeddingRes.data[0].embedding;

  // 2. Retrieve top-K documents from Pinecone
  const results = await index.query({
    vector,
    topK: 20,
    includeMetadata: true,
  });

  // 3. Compress the retrieval payload with XRON
  const docs = results.matches.map((m) => ({
    id: m.id,
    score: Math.round((m.score ?? 0) * 1000) / 1000,
    title: (m.metadata as Record<string, string>)?.title ?? '',
    content: (m.metadata as Record<string, string>)?.content ?? '',
  }));

  const compressed = XRON.stringify(docs, { level: 'auto' });

  console.log(`Retrieved ${docs.length} docs — compressed to ${compressed.length} chars`);

  // 4. Pass compressed context to the LLM
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: [
          'You answer questions using the provided context.',
          'Context is XRON-encoded: @S defines field order, @D is a value dictionary ($N refs),',
          '+N means delta from previous row, ~ means same as above.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Context:\n${compressed}\n\nQuestion: ${question}`,
      },
    ],
  });

  return response.choices[0].message.content;
}

ragQuery('What are the key findings from the Q1 report?')
  .then((answer) => console.log('\nAnswer:', answer))
  .catch(console.error);
