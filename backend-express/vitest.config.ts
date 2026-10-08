import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests run against their own database (url_shortener_test, see .env.test)
const testEnv = parse(readFileSync(".env.test"));

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ["tests/setup/global-setup.ts"],
    // Integration tests share one database, so run files one at a time
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});
