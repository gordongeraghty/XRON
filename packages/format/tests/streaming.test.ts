import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index';

describe('XRON Streaming', () => {
  it('should stringify and parse asynchronously', async () => {
    const data = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    
    // Test stringifyStream
    const stream = XRON.stringifyStream(data, { level: 2 });
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    
    const syncOutput = XRON.stringify(data, { level: 2 });
    expect(output).toEqual(syncOutput);

    // Test parseStream
    async function* asyncGenerator() {
      yield syncOutput;
    }
    
    const parsed = [];
    for await (const item of XRON.parseStream(asyncGenerator())) {
      parsed.push(item);
    }
    
    expect(parsed).toEqual(data);
  });
});
