#!/usr/bin/env node

/**
 * xron-mcp — A lightweight MCP proxy that wraps any upstream MCP server
 * and compresses JSON tool responses using XRON before they reach the LLM.
 *
 * Usage: xron-mcp --wrap <command> [args...]
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { XRON } from "xron-format";

const FORMAT_HINT =
  "[XRON compressed — tabular format, $ = dictionary ref (base-62), + = delta, +Ns = temporal delta, @C = checksum, @A = 2D array, ~ = repeat]";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const wrapIdx = process.argv.indexOf("--wrap");
if (wrapIdx === -1 || wrapIdx + 1 >= process.argv.length) {
  console.error("Usage: xron-mcp --wrap <command> [args...]");
  process.exit(1);
}

const upstreamCommand = process.argv[wrapIdx + 1];
const upstreamArgs = process.argv.slice(wrapIdx + 2);

// ---------------------------------------------------------------------------
// Connect to the upstream MCP server
// ---------------------------------------------------------------------------

const clientTransport = new StdioClientTransport({
  command: upstreamCommand,
  args: upstreamArgs,
});

const client = new Client(
  { name: "xron-mcp-proxy", version: "0.1.0" },
  { capabilities: {} },
);

await client.connect(clientTransport);

// ---------------------------------------------------------------------------
// Create the proxy MCP server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "xron-mcp-proxy", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// Forward tools/list — expose the same tools as upstream
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const { tools } = await client.listTools();
  return { tools };
});

// Forward tools/call — intercept and compress JSON responses
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const result = await client.callTool({
    name,
    arguments: args ?? {},
  });

  const content = (result.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>)
    .map((item) => {
      // Only compress text content that looks like JSON
      if (item.type === "text" && item.text) {
        const trimmed = item.text.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed);
            const compressed = XRON.stringify(parsed, { level: "auto" });
            return {
              type: "text" as const,
              text: `${FORMAT_HINT}\n${compressed}`,
            };
          } catch {
            // Not valid JSON — pass through unchanged
            return item;
          }
        }
      }
      // Non-JSON text, images, resources — pass through unchanged
      return item;
    });

  return {
    content,
    isError: result.isError,
  };
});

// ---------------------------------------------------------------------------
// Start the proxy server on stdio
// ---------------------------------------------------------------------------

const serverTransport = new StdioServerTransport();
await server.connect(serverTransport);
