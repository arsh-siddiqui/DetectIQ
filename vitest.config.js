import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    setupFiles: ['./server/tests/setup.js'],
    include: ['server/tests/**/*.test.js'],
  },
});
