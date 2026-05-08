import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"
const webServerCommand = process.platform === "win32" ? "cmd /c npm.cmd run dev" : "npm run dev"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,
  outputDir: "test-results/e2e/artifacts",
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/e2e/junit.xml" }],
    ["html", { outputFolder: "test-results/e2e/html", open: "never" }],
  ],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
})
