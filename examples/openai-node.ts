/**
 * Example: Using XRON with the OpenAI Node SDK
 *
 * Compresses structured data before injecting it into a chat completion,
 * reducing token consumption by up to 80%.
 *
 * Install dependencies:
 *   npm install xron-format openai
 *
 * Set your API key:
 *   export OPENAI_API_KEY="sk-..."
 */

import { XRON } from 'xron-format';
import OpenAI from 'openai';

const client = new OpenAI();

// Sample dataset — imagine this comes from a database or API
const employees = [
  { id: 1, name: 'Alice Johnson', department: 'Sales', active: true },
  { id: 2, name: 'Bob Smith', department: 'Engineering', active: true },
  { id: 3, name: 'Carol Williams', department: 'Sales', active: false },
  { id: 4, name: 'Dave Brown', department: 'Engineering', active: true },
  { id: 5, name: 'Eve Davis', department: 'Marketing', active: true },
];

async function main() {
  // Compress the data with XRON — auto mode picks the best level
  const compressed = XRON.stringify(employees, { level: 'auto' });

  console.log('--- XRON Compressed Payload ---');
  console.log(compressed);
  console.log('-------------------------------\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: [
          'You are a data analyst. The user will provide employee data in XRON format.',
          'XRON is a compressed notation — schemas define field order, $N references are dictionary lookups,',
          '1/0 in boolean fields mean true/false. Parse accordingly.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Here is the employee data:\n\n${compressed}\n\nHow many employees are in Sales?`,
      },
    ],
  });

  console.log('Response:', response.choices[0].message.content);
}

main().catch(console.error);
