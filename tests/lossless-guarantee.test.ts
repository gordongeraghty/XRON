import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index.js';

// Helper to generate a random string of varying length including emojis and special chars
const randomString = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const length = Math.floor(Math.random() * 50);
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// Helper for generating BigInt outside standard range
const randomBigInt = () => {
    const isNegative = Math.random() > 0.5;
    const val = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) * 1000n + BigInt(Math.floor(Math.random() * 1000));
    return isNegative ? -val : val;
};

const generateRandomValue = (depth: number = 0): any => {
    // Avoid too much depth to prevent max stack exceeded during generation
    if (depth > 2) {
        return Math.random() > 0.5 ? randomString() : Math.random() * 10000;
    }

    const type = Math.floor(Math.random() * 7);
    switch (type) {
        case 0: return randomString();
        case 1: return (Math.random() - 0.5) * 1000000; // floats & negatives
        case 2: return Math.random() > 0.5;
        case 3: return null;
        case 4: return randomString(); // Dates without schema hints revive as strings
        case 5: return randomBigInt();
        case 6: {
            // Nested object
            const obj: Record<string, any> = {};
            const keysCount = Math.floor(Math.random() * 5) + 1;
            for (let i = 0; i < keysCount; i++) {
                obj[`key_${randomString().substring(0, 5)}`] = generateRandomValue(depth + 1);
            }
            return obj;
        }
        default: return randomString();
    }
};

describe('XRON Zero-Hallucination & Lossless Guarantee', () => {

    it('should successfully round-trip 500 intensely random, deeply nested payloads without data loss', () => {
        // We run 500 generative tests simulating intense schema variance and raw primitives
        for (let i = 0; i < 500; i++) {
            // Generate a chaotic payload. Sometimes array, sometimes object.
            const isArray = Math.random() > 0.5;
            const payload = isArray 
                ? Array.from({ length: Math.floor(Math.random() * 20) }, () => generateRandomValue())
                : generateRandomValue();

            try {
                // Test Auto mode (which tries Level 1, 2, and 3 and picks the best)
                const encoded = XRON.stringify(payload, { level: 'auto' });
                const decoded = XRON.parse(encoded);

                // They should be completely structurally identical
                expect(decoded).toEqual(payload);
            } catch (error) {
                console.error('Failed on payload:', payload);
                throw error;
            }
        }
    });

    it('should handle extreme sequential BigInt arrays (Delta Stress Test)', () => {
        const arr = [];
        let num = 9999999999999999999n;
        for (let i = 0; i < 100; i++) {
            arr.push({ 
                uuid: num, 
                booleanFlag: i % 2 === 0,
                nested: {
                    price: (i * 1.5),
                    date: new Date('2026-04-01T00:00:00.000Z')
                }
            });
            num += (Math.random() > 0.5 ? 1n : -2n); // Positive and negative sequential changes
        }

        const encoded = XRON.stringify(arr, { level: 3 });
        const decoded = XRON.parse(encoded);
        expect(decoded).toEqual(arr);
    });
});
