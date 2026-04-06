import { readFileSync, writeFileSync } from 'node:fs';
import { XRON } from 'xron-format';

const USAGE = `xron-cli v0.2.0 — XRON compression for files and pipes

Usage:
  xron compress   [file.json]  [-o <output>]   Compress JSON to XRON
  xron decompress [file.xron]  [-o <output>]   Decompress XRON to JSON
  xron analyze    [file.json]                   Show compression metrics
  xron --help                                   Show this help

When no file is given, reads from stdin. Pipe-friendly:
  echo '{"a":1}' | xron compress
  curl api/data | xron compress -o out.xron
  cat data.xron | xron decompress

Options:
  -o, --output <file>   Write to file instead of stdout
  --exact-tokens        Use tiktoken for exact token counts (analyze only)
  --help                Show help`;

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const command = args[0];
  let file: string | undefined;
  let output: string | undefined;
  let exactTokens = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      output = args[++i];
    } else if (args[i] === '--exact-tokens') {
      exactTokens = true;
    } else if (!args[i].startsWith('-')) {
      file = args[i];
    }
  }

  return { command, file, output, exactTokens };
}

/**
 * Read input from a file argument or stdin.
 * When no file is provided and stdin is piped, reads all of stdin.
 */
async function readInput(file: string | undefined): Promise<string> {
  if (file && file !== '-') {
    return readFileSync(file, 'utf-8');
  }

  // Read from stdin
  if (process.stdin.isTTY) {
    die('No file argument and no data piped to stdin. Run \'xron --help\' for usage.');
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

function emit(text: string, output: string | undefined) {
  if (output) {
    writeFileSync(output, text, 'utf-8');
    console.error(`Written to ${output}`);
  } else {
    process.stdout.write(text);
  }
}

async function compress(file: string | undefined, output: string | undefined) {
  const raw = await readInput(file);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    die(`Failed to parse JSON from ${file ?? 'stdin'}`);
  }
  const compressed = XRON.stringify(data, { level: 'auto' });
  emit(compressed, output);
}

async function decompress(file: string | undefined, output: string | undefined) {
  const raw = await readInput(file);
  const data = XRON.parse(raw);
  const json = JSON.stringify(data, null, 2);
  emit(json, output);
}

async function analyzeFile(file: string | undefined, exactTokens = false) {
  const raw = await readInput(file);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    die(`Failed to parse JSON from ${file ?? 'stdin'}`);
  }

  const stats = await XRON.analyze(data);
  const jsonSize = Buffer.byteLength(raw, 'utf-8');
  const xronSize = Buffer.byteLength(XRON.stringify(data, { level: 'auto' }), 'utf-8');

  // If --exact-tokens requested, try to get exact counts via tiktoken
  let tokenMode = 'estimated';
  if (exactTokens) {
    try {
      const tiktoken = await import('tiktoken');
      tokenMode = 'exact (tiktoken)';
      // Token counts in stats are already the best available from XRON.analyze
    } catch {
      console.error('Warning: tiktoken not installed. Using heuristic estimation.');
      console.error('Install tiktoken for exact counts: npm install tiktoken');
    }
  }

  const label = file && file !== '-' ? file : 'stdin';
  console.log(`File:            ${label}`);
  console.log(`JSON size:       ${jsonSize} bytes`);
  console.log(`XRON size:       ${xronSize} bytes`);
  console.log(`Byte reduction:  ${Math.round((1 - xronSize / jsonSize) * 100)}%`);
  console.log(`Input tokens:    ${stats.inputTokens} (${tokenMode})`);
  console.log(`Output tokens:   ${stats.outputTokens} (${tokenMode})`);
  console.log(`Token reduction: ${stats.reduction}%`);
  console.log(`Schemas:         ${stats.schemas}`);
  console.log(`Dict entries:    ${stats.dictEntries}`);
  console.log(`Delta columns:   ${stats.deltaColumns}`);
  console.log(`Breakdown:       L1=${stats.breakdown.level1Tokens} L2=${stats.breakdown.level2Tokens} L3=${stats.breakdown.level3Tokens}`);
}

async function main() {
  const { command, file, output, exactTokens } = parseArgs(process.argv);

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  switch (command) {
    case 'compress':
      await compress(file, output);
      break;
    case 'decompress':
      await decompress(file, output);
      break;
    case 'analyze':
      await analyzeFile(file, exactTokens);
      break;
    default:
      die(`Unknown command '${command}'. Run 'xron --help' for usage.`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
