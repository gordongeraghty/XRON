/**
 * Cookbook Example: Batch Cost Analysis
 *
 * Measure exactly how much XRON saves across your real datasets.
 * Run this against your own JSON files to get per-file and aggregate
 * cost projections at current API pricing.
 *
 * Install:
 *   npm install xron-format
 *
 * Usage:
 *   npx tsx examples/cookbook/batch-cost-analysis.ts data/*.json
 */

import { XRON } from 'xron-format';
import { readFileSync } from 'node:fs';

const GPT4O_INPUT_PRICE = 2.50; // USD per 1M tokens (as of 2026)
const CHARS_PER_TOKEN = 3.7; // approximate for o200k_base

interface FileReport {
  file: string;
  jsonChars: number;
  xronChars: number;
  reductionPct: number;
  estimatedTokensSaved: number;
}

function analyseFile(filePath: string): FileReport | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    const jsonStr = JSON.stringify(data);
    const xronStr = XRON.stringify(data, { level: 'auto' });

    const jsonTokens = Math.ceil(jsonStr.length / CHARS_PER_TOKEN);
    const xronTokens = Math.ceil(xronStr.length / CHARS_PER_TOKEN);

    return {
      file: filePath,
      jsonChars: jsonStr.length,
      xronChars: xronStr.length,
      reductionPct: Math.round((1 - xronStr.length / jsonStr.length) * 100),
      estimatedTokensSaved: jsonTokens - xronTokens,
    };
  } catch {
    console.warn(`Skipping ${filePath}: could not parse as JSON`);
    return null;
  }
}

// Main
const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('Usage: npx tsx examples/cookbook/batch-cost-analysis.ts file1.json file2.json ...');
  console.log('\nRunning demo with sample data...\n');

  // Demo with inline data
  const sample = Array.from({ length: 500 }, (_, i) => ({
    id: i + 1,
    name: `Employee ${i + 1}`,
    email: `emp${i + 1}@company.com`,
    department: ['Sales', 'Engineering', 'Marketing', 'Support', 'HR'][i % 5],
    salary: 50000 + i * 100,
    active: i % 7 !== 0,
  }));

  const json = JSON.stringify(sample);
  const xron = XRON.stringify(sample, { level: 'auto' });
  const tokensSaved = Math.ceil(json.length / CHARS_PER_TOKEN) - Math.ceil(xron.length / CHARS_PER_TOKEN);
  const costPer1k = (tokensSaved * 1000 * GPT4O_INPUT_PRICE) / 1_000_000;

  console.log(`JSON:           ${json.length.toLocaleString()} chars`);
  console.log(`XRON (auto):    ${xron.length.toLocaleString()} chars`);
  console.log(`Reduction:      ${Math.round((1 - xron.length / json.length) * 100)}%`);
  console.log(`Tokens saved:   ~${tokensSaved.toLocaleString()} per request`);
  console.log(`Cost saved:     ~$${costPer1k.toFixed(2)} per 1,000 requests (GPT-4o input)`);
  process.exit(0);
}

const reports = files.map(analyseFile).filter(Boolean) as FileReport[];
const totalSaved = reports.reduce((sum, r) => sum + r.estimatedTokensSaved, 0);
const costPer1k = (totalSaved * 1000 * GPT4O_INPUT_PRICE) / 1_000_000;

console.log('File                          | JSON     | XRON     | Reduction | Tokens Saved');
console.log('-'.repeat(85));
for (const r of reports) {
  console.log(
    `${r.file.padEnd(30)}| ${String(r.jsonChars).padStart(8)} | ${String(r.xronChars).padStart(8)} | ${String(r.reductionPct + '%').padStart(9)} | ${String(r.estimatedTokensSaved).padStart(12)}`
  );
}
console.log('-'.repeat(85));
console.log(`Total tokens saved per batch: ~${totalSaved.toLocaleString()}`);
console.log(`Estimated saving per 1,000 batches: ~$${costPer1k.toFixed(2)} (GPT-4o input pricing)`);
