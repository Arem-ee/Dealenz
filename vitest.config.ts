import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    pool: "forks",
    testTimeout: 15000,
    hookTimeout: 10000,
    // Sharding: `vitest run --shard=1/3` splits files across CI jobs.
    // Targeted runs: `npm run test:lib|app|ui` (positional path filters).
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
