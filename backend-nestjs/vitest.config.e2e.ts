import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';

// e2e tests run the whole app against its own database (see .env.test)
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: parse(readFileSync('.env.test')),
    globalSetup: ['test/setup/global-setup.ts'],
    // The suites share one database, so run files one at a time
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
