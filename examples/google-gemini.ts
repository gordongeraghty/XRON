/**
 * Example: Using XRON with the Google Gemini SDK
 *
 * Compresses structured data before passing it to Gemini,
 * reducing token consumption by up to 80%.
 *
 * Install dependencies:
 *   npm install xron-format @google/genai
 *
 * Set your API key:
 *   export GOOGLE_API_KEY="..."
 */

import { XRON } from 'xron-format';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

// Sample dataset — product inventory from a warehouse API
const inventory = [
  { sku: 'WDG-001', name: 'Widget Alpha', category: 'Widgets', stock: 142, price: 29.99, active: true },
  { sku: 'WDG-002', name: 'Widget Beta', category: 'Widgets', stock: 87, price: 34.99, active: true },
  { sku: 'GDG-001', name: 'Gadget Pro', category: 'Gadgets', stock: 0, price: 149.99, active: false },
  { sku: 'GDG-002', name: 'Gadget Lite', category: 'Gadgets', stock: 203, price: 79.99, active: true },
  { sku: 'ACC-001', name: 'Power Adapter', category: 'Accessories', stock: 412, price: 14.99, active: true },
];

async function main() {
  // Compress the data with XRON — auto mode picks the best level
  const compressed = XRON.stringify(inventory, { level: 'auto' });

  console.log('--- XRON Compressed Payload ---');
  console.log(compressed);
  console.log('-------------------------------\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              'You are an inventory analyst. The data below is XRON-encoded.',
              'XRON is a compressed notation: @S defines field order, $N references are dictionary lookups,',
              '1/0 in boolean fields mean true/false, +N means delta from previous row.',
              '',
              compressed,
              '',
              'Which products are out of stock and what category are they in?',
            ].join('\n'),
          },
        ],
      },
    ],
  });

  console.log('Response:', response.text);
}

main().catch(console.error);
