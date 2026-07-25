/**
 * Example: Using XRON with the Anthropic SDK (Claude)
 *
 * Compresses tool output or context data before passing it to Claude,
 * reducing token consumption by up to 80%.
 *
 * Install dependencies:
 *   npm install xron-format @anthropic-ai/sdk
 *
 * Set your API key:
 *   export ANTHROPIC_API_KEY="sk-ant-..."
 */

import { XRON } from 'xron-format';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Simulated tool output — e.g. a CRM lookup or database query result
const toolOutput = [
  { id: 101, customer: 'Acme Corp', revenue: 52000, region: 'APAC', status: 'active' },
  { id: 102, customer: 'Globex Inc', revenue: 34000, region: 'EMEA', status: 'active' },
  { id: 103, customer: 'Initech', revenue: 18000, region: 'APAC', status: 'churned' },
  { id: 104, customer: 'Umbrella Ltd', revenue: 67000, region: 'AMER', status: 'active' },
  { id: 105, customer: 'Stark Industries', revenue: 91000, region: 'AMER', status: 'active' },
];

async function main() {
  // Compress the tool output with XRON
  const compressed = XRON.stringify(toolOutput, { level: 'auto' });

  console.log('--- XRON Compressed Tool Output ---');
  console.log(compressed);
  console.log('-----------------------------------\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 1024,
    system: [
      'You are a business analyst. When you receive data in XRON format, parse it using these rules:',
      '@S defines a schema (field order), @D defines a dictionary ($0 = first entry, $1 = second, etc.),',
      '1/0 in boolean columns mean true/false, +N means delta from previous row.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: [
          'Here is the latest customer data from our CRM (XRON-encoded):',
          '',
          compressed,
          '',
          'What is the total revenue from AMER customers?',
        ].join('\n'),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  console.log('Response:', textBlock?.text);
}

main().catch(console.error);
