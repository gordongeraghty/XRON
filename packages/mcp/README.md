# xron-mcp: Model Context Protocol (MCP) Compression Proxy

A lightweight MCP middleware that wraps any existing MCP server and automatically compresses JSON tool responses using XRON before they reach the LLM. This reduces token consumption by 60-80% for data-heavy tool outputs like BigQuery queries or Google Ads API results.

## Features
- **Stateless Proxy:** Intercepts `tools/call` and `tools/list` transparently.
- **Auto-Compression:** Detects JSON text in tool responses and applies XRON's optimal compression.
- **LLM-Friendly:** Adds a format hint to help the model interpret the compressed data.
- **No Configuration:** Wraps standard MCP servers with a simple `--wrap` command.

## Installation

```bash
npm install -g xron-mcp
```

## Usage in `mcp_config.json`

Wrap any existing MCP server using `xron-mcp --wrap`:

```json
{
  "mcpServers": {
    "bigquery-compressed": {
      "command": "xron-mcp",
      "args": ["--wrap", "npx", "-y", "@ergut/mcp-bigquery-server"],
      "env": {
        "GOOGLE_CLOUD_PROJECT": "your-project-id"
      }
    }
  }
}
```

## How It Works

1. **LLM/Agent** calls a tool through `xron-mcp`.
2. `xron-mcp` forwards the call to the **Upstream MCP Server**.
3. The server returns its response.
4. `xron-mcp` scans the response content:
   - If it's **plain text/JSON**, it applies `XRON.stringify(data, { level: 'auto' })`.
   - If it's an **image/binary**, it passes it through unchanged.
5. The compressed response is returned to the LLM, saving 60-80% on the response's context window tax.

## License
MIT
