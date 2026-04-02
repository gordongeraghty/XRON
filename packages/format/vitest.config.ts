import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    benchmark: {
      include: ['tests/**/*.bench.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
