import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    globalSetup: './test/setup/global.js',
    exclude: ['**/node_modules/**', '**/test/web/**', '**/test/tui/**', '**/web/e2e/**'],
  },
});
