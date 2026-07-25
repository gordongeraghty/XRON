import { describe, it, expect } from 'vitest';
import { XRON } from 'xron-format';
import { XRONOutputParser, XRONDocumentCompressor } from '../src/index.js';

describe('XRONOutputParser', () => {
  const parser = new XRONOutputParser();

  const sampleData = [
    { id: 1, name: 'Alice', dept: 'Sales' },
    { id: 2, name: 'Bob', dept: 'Engineering' },
    { id: 3, name: 'Carol', dept: 'Sales' },
  ];

  it('correctly parses XRON strings back to objects', () => {
    const xronString = XRON.stringify(sampleData);
    const result = parser.parse(xronString);
    expect(result).toEqual(sampleData);
  });

  it('strips markdown code fences before parsing', () => {
    const xronString = XRON.stringify(sampleData);
    const fenced = '```xron\n' + xronString + '\n```';
    const result = parser.parse(fenced);
    expect(result).toEqual(sampleData);
  });

  it('strips plain code fences (no language tag)', () => {
    const xronString = XRON.stringify(sampleData);
    const fenced = '```\n' + xronString + '\n```';
    const result = parser.parse(fenced);
    expect(result).toEqual(sampleData);
  });

  it('provides format instructions via format()', () => {
    const formatted = parser.format('Analyse the data');
    expect(formatted).toContain('XRON');
    expect(formatted).toContain('Analyse the data');
  });
});

describe('XRONDocumentCompressor', () => {
  const compressor = new XRONDocumentCompressor();

  it('compresses document arrays into a single XRON document', () => {
    const docs = [
      { text: 'Alice works in Sales', metadata: { id: 1 } },
      { text: 'Bob works in Engineering', metadata: { id: 2 } },
    ];

    const result = compressor.compressDocuments(docs);

    expect(result.metadata.format).toBe('xron');
    expect(result.metadata.originalCount).toBe(2);

    // The compressed content should be valid XRON that round-trips
    const parsed = XRON.parse(result.text) as any[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0].text).toBe('Alice works in Sales');
    expect(parsed[1].text).toBe('Bob works in Engineering');
  });

  it('handles documents without metadata', () => {
    const docs = [
      { text: 'Hello world' },
      { text: 'Goodbye world' },
    ];

    const result = compressor.compressDocuments(docs);

    expect(result.metadata.originalCount).toBe(2);
    const parsed = XRON.parse(result.text) as any[];
    expect(parsed).toHaveLength(2);
    expect(parsed[0].text).toBe('Hello world');
  });
});
