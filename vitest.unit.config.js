import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: true,
    mockReset: true,
    exclude: [
      '**/node_modules/**',
      '**/test/web/**',
      '**/test/tui/**',
      '**/web/e2e/**',
      '**/test/integration/**',
      '**/test/e2e/**',
      '**/test/worker/server.test.ts',
    ],
  },
});
