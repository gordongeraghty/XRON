import { describe, it, expect } from "vitest";
import { XRON } from "xron-format";

const FORMAT_HINT =
  "[XRON compressed — tabular format, $ = dictionary ref, + = delta]";

/**
 * Mirrors the compression logic from the proxy's tool-call handler.
 * Extracted here so we can test it without spinning up MCP transports.
 */
function compressContent(
  items: Array<{ type: string; text?: string; [k: string]: unknown }>,
) {
  return items.map((item) => {
    if (item.type === "text" && item.text) {
      const trimmed = item.text.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          const compressed = XRON.stringify(parsed, { level: "auto" });
          return { type: "text", text: `${FORMAT_HINT}\n${compressed}` };
        } catch {
          return item;
        }
      }
    }
    return item;
  });
}

describe("xron-mcp compression", () => {
  it("compresses JSON array content to XRON", () => {
    const data = [
      { id: 1, name: "Alice", dept: "Sales" },
      { id: 2, name: "Bob", dept: "Sales" },
      { id: 3, name: "Carol", dept: "Engineering" },
    ];
    const input = [{ type: "text", text: JSON.stringify(data) }];
    const [result] = compressContent(input);

    expect(result.text).toContain(FORMAT_HINT);
    // XRON output should be lossless — parse it back
    const xronBody = result.text!.slice(FORMAT_HINT.length + 1);
    const restored = XRON.parse(xronBody);
    expect(restored).toEqual(data);
  });

  it("compresses JSON object content to XRON", () => {
    const data = { status: "ok", count: 42, items: ["a", "b", "c"] };
    const input = [{ type: "text", text: JSON.stringify(data) }];
    const [result] = compressContent(input);

    expect(result.text).toContain(FORMAT_HINT);
    const xronBody = result.text!.slice(FORMAT_HINT.length + 1);
    const restored = XRON.parse(xronBody);
    expect(restored).toEqual(data);
  });

  it("passes through non-JSON text unchanged", () => {
    const input = [{ type: "text", text: "Hello, this is plain text." }];
    const [result] = compressContent(input);
    expect(result.text).toBe("Hello, this is plain text.");
  });

  it("passes through invalid JSON unchanged", () => {
    const input = [{ type: "text", text: "{not valid json: ]}" }];
    const [result] = compressContent(input);
    expect(result.text).toBe("{not valid json: ]}");
  });

  it("passes through image content unchanged", () => {
    const input = [
      { type: "image", data: "base64data==", mimeType: "image/png" },
    ];
    const [result] = compressContent(input);
    expect(result).toEqual(input[0]);
  });

  it("prepends the format hint line", () => {
    const input = [{ type: "text", text: '{"a":1}' }];
    const [result] = compressContent(input);
    const firstLine = result.text!.split("\n")[0];
    expect(firstLine).toBe(FORMAT_HINT);
  });

  it("handles empty array response gracefully", () => {
    const input = [{ type: "text", text: "[]" }];
    const [result] = compressContent(input);
    expect(result.text).toContain(FORMAT_HINT);
    const xronBody = result.text!.slice(FORMAT_HINT.length + 1);
    const restored = XRON.parse(xronBody);
    expect(restored).toEqual([]);
  });

  it("handles empty object response gracefully", () => {
    const input = [{ type: "text", text: "{}" }];
    const [result] = compressContent(input);
    expect(result.text).toContain(FORMAT_HINT);
    const xronBody = result.text!.slice(FORMAT_HINT.length + 1);
    const restored = XRON.parse(xronBody);
    expect(restored).toEqual({});
  });

  it("handles empty content array", () => {
    const result = compressContent([]);
    expect(result).toEqual([]);
  });

  it("handles mixed content types", () => {
    const input = [
      { type: "text", text: '{"key":"value"}' },
      { type: "text", text: "plain text" },
      { type: "image", data: "abc", mimeType: "image/jpeg" },
    ];
    const results = compressContent(input);

    // First item: compressed
    expect(results[0].text).toContain(FORMAT_HINT);
    // Second item: unchanged
    expect(results[1].text).toBe("plain text");
    // Third item: unchanged
    expect(results[2]).toEqual(input[2]);
  });
});
