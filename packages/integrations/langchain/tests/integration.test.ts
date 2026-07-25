import { describe, it, expect } from 'vitest';
import { XRON } from 'xron-format';
import { XRONOutputParser, XRONDocumentCompressor } from '../src/index.js';

// We avoid importing Document from @langchain/core to keep test deps light.
// Instead we use plain objects that match the Document interface.

describe('XRONOutputParser', () => {
  const parser = new XRONOutputParser();

  const sampleData = [
    { id: 1, name: 'Alice', dept: 'Sales' },
    { id: 2, name: 'Bob', dept: 'Engineering' },
    { id: 3, name: 'Carol', dept: 'Sales' },
  ];

  it('correctly parses XRON strings back to objects', async () => {
    const xronString = XRON.stringify(sampleData);
    const result = await parser.parse(xronString);
    expect(result).toEqual(sampleData);
  });

  it('strips markdown code fences before parsing', async () => {
    const xronString = XRON.stringify(sampleData);
    const fenced = '```xron\n' + xronString + '\n```';
    const result = await parser.parse(fenced);
    expect(result).toEqual(sampleData);
  });

  it('strips plain code fences (no language tag)', async () => {
    const xronString = XRON.stringify(sampleData);
    const fenced = '```\n' + xronString + '\n```';
    const result = await parser.parse(fenced);
    expect(result).toEqual(sampleData);
  });

  it('provides format instructions', () => {
    const instructions = parser.getFormatInstructions();
    expect(instructions).toContain('XRON');
  });
});

describe('XRONDocumentCompressor', () => {
  const compressor = new XRONDocumentCompressor();

  it('compresses document arrays into a single XRON document', async () => {
    const docs = [
      { pageContent: 'Alice works in Sales', metadata: { id: 1 } },
      { pageContent: 'Bob works in Engineering', metadata: { id: 2 } },
    ];

    const result = await compressor.compressDocuments(docs as any, 'team');

    expect(result).toHaveLength(1);
    expect(result[0].metadata.format).toBe('xron');
    expect(result[0].metadata.originalCount).toBe(2);

    // The compressed content should be valid XRON that round-trips
    const parsed = XRON.parse(result[0].pageContent) as any[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0].pageContent).toBe('Alice works in Sales');
    expect(parsed[1].pageContent).toBe('Bob works in Engineering');
  });
});
