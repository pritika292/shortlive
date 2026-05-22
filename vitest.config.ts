import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    // Integration tests share a single Postgres + Redis instance; running
    // them in parallel forks would race on schema setup.
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 10_000,
  },
});
