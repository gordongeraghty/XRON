import { readFileSync, writeFileSync } from 'node:fs';
import { XRON } from 'xron-format';

const USAGE = `xron-cli v0.1.0 — XRON compression for files

Usage:
  xron compress   <file.json>  [-o <output>]   Compress JSON to XRON
  xron decompress <file.xron>  [-o <output>]   Decompress XRON to JSON
  xron analyze    <file.json>                   Show compression metrics
  xron --help                                   Show this help

Options:
  -o, --output <file>   Write to file instead of stdout
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

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      output = args[++i];
    } else if (!args[i].startsWith('-')) {
      file = args[i];
    }
  }

  return { command, file, output };
}

function emit(text: string, output: string | undefined) {
  if (output) {
    writeFileSync(output, text, 'utf-8');
    console.error(`Written to ${output}`);
  } else {
    process.stdout.write(text);
  }
}

function compress(file: string, output: string | undefined) {
  const raw = readFileSync(file, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    die(`Failed to parse JSON from ${file}`);
  }
  const compressed = XRON.stringify(data, { level: 'auto' });
  emit(compressed, output);
}

function decompress(file: string, output: string | undefined) {
  const raw = readFileSync(file, 'utf-8');
  const data = XRON.parse(raw);
  const json = JSON.stringify(data, null, 2);
  emit(json, output);
}

async function analyzeFile(file: string) {
  const raw = readFileSync(file, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    die(`Failed to parse JSON from ${file}`);
  }

  const stats = await XRON.analyze(data);
  const jsonSize = Buffer.byteLength(raw, 'utf-8');
  const xronSize = Buffer.byteLength(XRON.stringify(data, { level: 'auto' }), 'utf-8');

  console.log(`File:            ${file}`);
  console.log(`JSON size:       ${jsonSize} bytes`);
  console.log(`XRON size:       ${xronSize} bytes`);
  console.log(`Byte reduction:  ${Math.round((1 - xronSize / jsonSize) * 100)}%`);
  console.log(`Input tokens:    ${stats.inputTokens}`);
  console.log(`Output tokens:   ${stats.outputTokens}`);
  console.log(`Token reduction: ${stats.reduction}%`);
  console.log(`Schemas:         ${stats.schemas}`);
  console.log(`Dict entries:    ${stats.dictEntries}`);
  console.log(`Delta columns:   ${stats.deltaColumns}`);
  console.log(`Breakdown:       L1=${stats.breakdown.level1Tokens} L2=${stats.breakdown.level2Tokens} L3=${stats.breakdown.level3Tokens}`);
}

async function main() {
  const { command, file, output } = parseArgs(process.argv);

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  if (!file) {
    die(`Missing file argument. Run 'xron --help' for usage.`);
  }

  switch (command) {
    case 'compress':
      compress(file, output);
      break;
    case 'decompress':
      decompress(file, output);
      break;
    case 'analyze':
      await analyzeFile(file);
      break;
    default:
      die(`Unknown command '${command}'. Run 'xron --help' for usage.`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
