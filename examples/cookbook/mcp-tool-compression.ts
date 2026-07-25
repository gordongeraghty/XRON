/**
 * Cookbook Example: MCP Tool Response Compression
 *
 * Demonstrates how xron-mcp automatically compresses JSON tool
 * responses before they reach the LLM, saving tokens on every
 * tool call without changing your server code.
 *
 * This example shows the manual equivalent — useful when you want
 * fine-grained control over compression in a custom MCP server.
 *
 * Install:
 *   npm install xron-format @modelcontextprotocol/sdk
 */

import { XRON } from 'xron-format';

// Simulated MCP tool handler that returns database results
function handleDatabaseQuery(sql: string): unknown[] {
  // In a real server, this would execute the SQL query
  return Array.from({ length: 200 }, (_, i) => ({
    id: i + 1,
    timestamp: new Date(2026, 0, 1, 0, i).toISOString(),
    metric: 'cpu_usage',
    value: 45 + Math.sin(i / 10) * 20,
    host: `server-${(i % 5) + 1}.internal`,
    region: ['us-east-1', 'eu-west-1', 'ap-southeast-2'][i % 3],
  }));
}

// Compress the tool response before returning it to the LLM
function compressToolResponse(data: unknown): string {
  const json = JSON.stringify(data);
  const xron = XRON.stringify(data, { level: 'auto' });

  // XRON.stringify with auto mode guarantees the result is never
  // larger than JSON, so this is always safe
  const savings = ((1 - xron.length / json.length) * 100).toFixed(1);
  console.log(`Compressed: ${json.length} → ${xron.length} chars (${savings}% reduction)`);

  return xron;
}

// Example usage
const results = handleDatabaseQuery('SELECT * FROM metrics LIMIT 200');
const compressed = compressToolResponse(results);

console.log('\nFirst 500 chars of XRON output:');
console.log(compressed.slice(0, 500));
