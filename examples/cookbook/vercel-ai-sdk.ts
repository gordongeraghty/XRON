/**
 * Cookbook Example: XRON + Vercel AI SDK
 *
 * Compress large data arrays before passing them to generateText
 * or streamText. Reduces token usage by up to 80% on structured payloads.
 *
 * Install:
 *   npm install xron-format ai @ai-sdk/openai
 */

import { XRON } from 'xron-format';
import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// --- Example 1: generateText with compressed context ---

async function generateWithXRON() {
  const users = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    department: ['Sales', 'Engineering', 'Marketing', 'Support'][i % 4],
    active: i % 5 !== 0,
  }));

  const compressed = XRON.stringify(users, { level: 'auto' });
  console.log(`50 users: ${JSON.stringify(users).length} chars JSON → ${compressed.length} chars XRON`);

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: [
      'You analyse employee data provided in XRON format.',
      '@S defines field order, @D is a dictionary ($N), 1/0 = true/false for ?b fields,',
      '+N = delta from previous row, ~ = same as above.',
    ].join(' '),
    prompt: `Data:\n${compressed}\n\nHow many active employees are in Engineering?`,
  });

  console.log('Answer:', text);
}

// --- Example 2: streamText with compressed context ---

async function streamWithXRON() {
  const orders = Array.from({ length: 100 }, (_, i) => ({
    orderId: 5000 + i,
    product: ['Widget A', 'Widget B', 'Gadget C'][i % 3],
    qty: Math.floor(Math.random() * 20) + 1,
    status: ['shipped', 'pending', 'delivered'][i % 3],
  }));

  const compressed = XRON.stringify(orders, { level: 'auto' });

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'Summarise the order data. It is XRON-encoded.',
    prompt: compressed,
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log();
}

generateWithXRON()
  .then(() => streamWithXRON())
  .catch(console.error);
