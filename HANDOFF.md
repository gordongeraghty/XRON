<!-- STATUS: complete -->

## Task
Three deliverables in one handoff:
1. **Build xron-mcp** — Ensure `packages/mcp` has a working build step so `dist/index.js` exists for the live MCP config.
2. **Build xron-cli** — A new CLI package for compressing/decompressing files from the command line.
3. **Build xron-skill** — A Claude Code / Antigravity skill that teaches agents to prefer XRON for structured data.

After all three, run `npm test` across all workspaces. Then run `Help me test this project with TestSprite` to validate via TestSprite MCP.

## Instructions

### Part 1: Build xron-mcp dist

The MCP config now points at `packages/mcp/dist/index.js`. Add a build script and produce the dist:

1. Ensure `packages/mcp/package.json` has:
   ```json
   "scripts": {
     "build": "tsup src/index.ts --format esm --clean --banner.js \"#!/usr/bin/env node\""
   }
   ```
2. Create `packages/mcp/tsconfig.json` if it doesn't exist.
3. Run `npm run build` in `packages/mcp` to produce `dist/index.js`.

### Part 2: Build xron-cli

Create `packages/cli/` — a command-line tool for compressing and decompressing files.

1. Create `packages/cli/package.json`:
   ```json
   {
     "name": "xron-cli",
     "version": "0.1.0",
     "type": "module",
     "bin": {
       "xron": "./dist/index.js"
     },
     "scripts": {
       "build": "tsup src/index.ts --format esm --clean --banner.js \"#!/usr/bin/env node\""
     },
     "dependencies": {
       "xron-format": "*"
     },
     "devDependencies": {
       "tsup": "^8.0.0",
       "typescript": "^5.4.0"
     }
   }
   ```

2. Create `packages/cli/src/index.ts` implementing these commands:
   - `xron compress <file.json>` — Reads a JSON file, compresses to XRON, outputs to stdout or `<file>.xron`.
   - `xron decompress <file.xron>` — Reads an XRON file, decompresses to JSON, outputs to stdout or `<file>.json`.
   - `xron analyze <file.json>` — Shows compression metrics (token counts, reduction %).
   - `xron --help` — Prints usage info.
   - Use `process.argv` for argument parsing (no external deps like commander).
   - Read files with `fs.readFileSync`, write with `fs.writeFileSync`.
   - Output format: by default print to stdout. With `--output <file>` or `-o <file>`, write to a file.

3. Create `packages/cli/tests/cli.test.ts`:
   - Test compress: JSON input → XRON output starts with `@v`.
   - Test decompress: XRON input → JSON output matches original.
   - Test analyze: returns valid metrics object.
   - Test round-trip: compress then decompress equals original.
   - At least 8 test cases.

### Part 3: Build xron-skill

Create `packages/skill/` — a skill definition for Claude Code and Antigravity.

1. Create `packages/skill/SKILL.md`:
   ```markdown
   ---
   name: xron
   description: Compress structured data with XRON to reduce LLM token usage by 60-80%. Use when handling large JSON datasets, API responses, or database results in agent conversations.
   ---

   # XRON Compression Skill

   When you encounter large structured JSON data (arrays of objects, API responses, database query results), compress it with XRON to save tokens.

   ## When to Use
   - Receiving large JSON responses from MCP tools (BigQuery, APIs, etc.)
   - Storing structured data in context or memory
   - Passing data between agents
   - Any JSON array with 3+ objects sharing the same schema

   ## How to Compress
   ```typescript
   import { XRON } from 'xron-format';
   const compressed = XRON.stringify(data, { level: 'auto' });
   ```

   ## How to Decompress
   ```typescript
   const original = XRON.parse(compressed);
   ```

   ## Reading XRON Format
   XRON is human-readable. Key patterns:
   - `@v2` — version header
   - `@S Name: field1, field2` — schema definition
   - `@D: val1, val2` — dictionary (repeated values)
   - `$0`, `$1` — dictionary references
   - `+1`, `+5` — delta values (sequential numbers)
   - `*3` — repeat previous value 3 times

   ## Rules
   - Always use `level: 'auto'` unless you have a specific reason not to.
   - XRON is lossless: `XRON.parse(XRON.stringify(data))` deep-equals the original.
   - Do NOT compress data smaller than 500 bytes — the overhead isn't worth it.
   - For files, use the CLI: `npx xron-cli compress data.json`
   ```

2. Also copy this skill to `C:\Users\Gordon Geraghty\OneDrive\Documents\GitHub\.agents\skills\xron\SKILL.md` so it's globally available to Antigravity.

### Part 4: Install, Test, Validate

1. Run `npm install` at the workspace root.
2. Run `npm test` — all tests across format, mcp, and cli must pass.
3. Run `Help me test this project with TestSprite` in the same terminal session to invoke TestSprite MCP validation.

## Constraints
- Do NOT modify any code in `packages/format/`. The core library is frozen.
- Keep `xron-cli` under 150 lines. No external CLI framework deps.
- The skill file is documentation only — no executable code.

## Files to Touch
- `packages/mcp/package.json` (add build script)
- `packages/mcp/tsconfig.json`
- `packages/cli/package.json`
- `packages/cli/src/index.ts`
- `packages/cli/tests/cli.test.ts`
- `packages/cli/tsconfig.json`
- `packages/skill/SKILL.md`
- `HANDOFF.md` (Update STATUS to `review` when complete)
