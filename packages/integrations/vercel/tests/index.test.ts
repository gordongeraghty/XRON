import { describe, it, expect } from 'vitest';
import { XRON } from 'xron-format';
import {
  compressDataForPrompt,
  createXRONMessage,
  xronMiddleware,
} from '../src/index.js';

const sampleData = [
  { id: 1, name: 'Alice', dept: 'Sales' },
  { id: 2, name: 'Bob', dept: 'Engineering' },
  { id: 3, name: 'Carol', dept: 'Sales' },
];

describe('compressDataForPrompt', () => {
  it('compresses data into a valid XRON string', () => {
    const result = compressDataForPrompt(sampleData);
    const parsed = XRON.parse(result);
    expect(parsed).toEqual(sampleData);
  });

  it('respects explicit level option', () => {
    const result = compressDataForPrompt(sampleData, { level: 1 });
    expect(result).toContain('@v1');
    const parsed = XRON.parse(result);
    expect(parsed).toEqual(sampleData);
  });

  it('defaults to auto level', () => {
    const result = compressDataForPrompt(sampleData);
    // Auto selects the shortest output — just verify it round-trips
    const parsed = XRON.parse(result);
    expect(parsed).toEqual(sampleData);
  });
});

describe('createXRONMessage', () => {
  it('creates a message object with compressed content', () => {
    const msg = createXRONMessage('system', sampleData);
    expect(msg.role).toBe('system');
    expect(typeof msg.content).toBe('string');
    const parsed = XRON.parse(msg.content);
    expect(parsed).toEqual(sampleData);
  });

  it('supports all role types', () => {
    for (const role of ['system', 'user', 'assistant'] as const) {
      const msg = createXRONMessage(role, sampleData);
      expect(msg.role).toBe(role);
    }
  });
});

describe('xronMiddleware', () => {
  it('compresses JSON array content in messages', () => {
    const messages = [
      { role: 'system' as const, content: JSON.stringify(sampleData) },
      { role: 'user' as const, content: 'Analyse this data' },
    ];

    const result = xronMiddleware(messages);

    expect(result).toHaveLength(2);
    // First message should be compressed
    const parsed = XRON.parse(result[0].content);
    expect(parsed).toEqual(sampleData);
    // Second message should be unchanged
    expect(result[1].content).toBe('Analyse this data');
  });

  it('leaves non-JSON messages untouched', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello world' },
    ];

    const result = xronMiddleware(messages);
    expect(result[0].content).toBe('Hello world');
  });

  it('leaves non-array JSON messages untouched', () => {
    const messages = [
      { role: 'user' as const, content: JSON.stringify({ key: 'value' }) },
    ];

    const result = xronMiddleware(messages);
    expect(result[0].content).toBe('{"key":"value"}');
  });
});
