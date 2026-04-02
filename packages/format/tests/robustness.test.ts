import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index';

describe('XRON Robustness', () => {
  it('should block overly deep recursive objects on stringification', () => {
    let deepObject: any = {};
    for (let i = 0; i < 70; i++) {
      deepObject = { inner: deepObject };
    }
    
    expect(() => XRON.stringify(deepObject, { maxDepth: 64 }))
      .toThrowError('Maximum serialization depth exceeded');
  });

  it('should block overly deep payload strings on parse', () => {
    let deepString = '{'.repeat(100) + '}'.repeat(100);
    expect(() => XRON.parse(deepString, { maxDepth: 64 }))
      .toThrowError('Maximum parsing depth exceeded');
  });

  it('should parse appropriately balanced items under the depth limit', () => {
    let okayObject: any = {};
    for (let i = 0; i < 10; i++) {
        okayObject = { inner: okayObject };
    }
    const stringified = XRON.stringify(okayObject, { maxDepth: 64 });
    expect(XRON.parse(stringified, { maxDepth: 64 })).toEqual(okayObject);
  });
});
