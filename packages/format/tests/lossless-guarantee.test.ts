import { describe, it, expect } from 'vitest';
import { XRON } from '../src/index.js';

// Seeded PRNG (mulberry32) for deterministic random tests across CI runs
function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42); // fixed seed for reproducibility

// Helper to generate a random string of varying length
const randomString = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const length = Math.floor(rand() * 50);
    return Array.from({ length }, () => chars[Math.floor(rand() * chars.length)]).join('');
};

// Helper for generating BigInt outside standard range
const randomBigInt = () => {
    const isNegative = rand() > 0.5;
    const val = BigInt(Math.floor(rand() * Number.MAX_SAFE_INTEGER)) * 1000n + BigInt(Math.floor(rand() * 1000));
    return isNegative ? -val : val;
};

const generateRandomValue = (depth: number = 0): any => {
    // Avoid too much depth to prevent max stack exceeded during generation
    if (depth > 2) {
        return rand() > 0.5 ? randomString() : rand() * 10000;
    }

    const type = Math.floor(rand() * 7);
    switch (type) {
        case 0: return randomString();
        case 1: return (rand() - 0.5) * 1000000; // floats & negatives
        case 2: return rand() > 0.5;
        case 3: return null;
        case 4: return randomString(); // Dates without schema hints revive as strings
        case 5: return randomBigInt();
        case 6: {
            // Nested object
            const obj: Record<string, any> = {};
            const keysCount = Math.floor(rand() * 5) + 1;
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
            const isArray = rand() > 0.5;
            const payload = isArray 
                ? Array.from({ length: Math.floor(rand() * 20) }, () => generateRandomValue())
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
            num += (rand() > 0.5 ? 1n : -2n); // Positive and negative sequential changes
        }

        const encoded = XRON.stringify(arr, { level: 3 });
        const decoded = XRON.parse(encoded);
        expect(decoded).toEqual(arr);
    });
});
