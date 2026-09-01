import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/helpers/setupEnv.ts'],
    globalSetup: ['tests/helpers/globalSetup.ts'],
    // SQLite has a single writer; keep test files from racing on the shared db.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
});
