/**
 * Token count benchmark: Compare JSON vs XRON at each level.
 * Run with: npx vitest bench
 */

import { describe, it, expect } from 'vitest';
import { XRON } from '../../src/index.js';
import { estimateTokenCount } from '../../src/utils/token-counter.js';

// Generate test datasets
const departments = ['Sales', 'Engineering', 'Marketing', 'Support', 'HR'];

function generateUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Employee${i + 1}`,
    email: `emp${i + 1}@company.com`,
    department: departments[i % departments.length],
    active: i % 3 !== 0,
    salary: 50000 + (i * 1000),
  }));
}

describe('Token Count Comparison', () => {
  const datasets = [
    { name: '10 rows', data: generateUsers(10) },
    { name: '50 rows', data: generateUsers(50) },
    { name: '100 rows', data: generateUsers(100) },
    { name: '500 rows', data: generateUsers(500) },
  ];

  for (const { name, data } of datasets) {
    it(`${name}: XRON achieves significant reduction vs JSON`, () => {
      const jsonStr = JSON.stringify(data);
      const xronL1 = XRON.stringify(data, { level: 1 });
      const xronL2 = XRON.stringify(data, { level: 2 });
      const xronL3 = XRON.stringify(data, { level: 3 });

      const jsonTokens = estimateTokenCount(jsonStr);
      const l1Tokens = estimateTokenCount(xronL1);
      const l2Tokens = estimateTokenCount(xronL2);
      const l3Tokens = estimateTokenCount(xronL3);

      const l1Reduction = Math.round((1 - l1Tokens / jsonTokens) * 100);
      const l2Reduction = Math.round((1 - l2Tokens / jsonTokens) * 100);
      const l3Reduction = Math.round((1 - l3Tokens / jsonTokens) * 100);

      console.log(`\n  ${name}:`);
      console.log(`    JSON:     ${jsonTokens} tokens (${jsonStr.length} chars)`);
      console.log(`    XRON L1:  ${l1Tokens} tokens (${xronL1.length} chars) → ${l1Reduction}% reduction`);
      console.log(`    XRON L2:  ${l2Tokens} tokens (${xronL2.length} chars) → ${l2Reduction}% reduction`);
      console.log(`    XRON L3:  ${l3Tokens} tokens (${xronL3.length} chars) → ${l3Reduction}% reduction`);

      // Assert meaningful reductions
      expect(l1Reduction).toBeGreaterThan(20);
      expect(l2Reduction).toBeGreaterThan(l1Reduction - 5); // L2 >= L1
      expect(l3Reduction).toBeGreaterThanOrEqual(l2Reduction - 5); // L3 >= L2
    });
  }

  it('character count comparison (concrete numbers)', () => {
    const data = generateUsers(100);
    const jsonStr = JSON.stringify(data);
    const jsonPretty = JSON.stringify(data, null, 2);
    const xronL1 = XRON.stringify(data, { level: 1 });
    const xronL2 = XRON.stringify(data, { level: 2 });
    const xronL3 = XRON.stringify(data, { level: 3 });

    console.log('\n  === 100-Row Character Count Comparison ===');
    console.log(`    JSON (pretty):  ${jsonPretty.length} chars`);
    console.log(`    JSON (minified): ${jsonStr.length} chars`);
    console.log(`    XRON Level 1:   ${xronL1.length} chars (${Math.round((1 - xronL1.length / jsonStr.length) * 100)}% smaller than minified JSON)`);
    console.log(`    XRON Level 2:   ${xronL2.length} chars (${Math.round((1 - xronL2.length / jsonStr.length) * 100)}% smaller than minified JSON)`);
    console.log(`    XRON Level 3:   ${xronL3.length} chars (${Math.round((1 - xronL3.length / jsonStr.length) * 100)}% smaller than minified JSON)`);

    // XRON should be significantly smaller than JSON
    expect(xronL1.length).toBeLessThan(jsonStr.length);
    expect(xronL2.length).toBeLessThan(xronL1.length);
  });
});
