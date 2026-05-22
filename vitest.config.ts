import { defineConfig } from "vitest/config";

// Per-project config lives in vitest.workspace.ts. This file only carries
// settings shared across both projects.
export default defineConfig({
  test: {
    testTimeout: 10_000,
  },
});
