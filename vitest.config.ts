import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.ts"],
    globals: true,
    css: true,
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}", "tests/shared/**/*.test.{ts,tsx}"],
    reporters: ["default", "junit", "json"],
    outputFile: {
      junit: "test-results/unit/junit.xml",
      json: "test-results/unit/results.json",
    },
  },
})
