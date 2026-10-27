import { defineConfig } from "@playwright/test";
// For read-only checks against an already-running app, select the regression
// test explicitly and set PLAYWRIGHT_BASE_URL. The default suite stays isolated.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  outputDir: "test-results/browser",
  use: {
    baseURL: externalBaseURL || "http://localhost:3012",
    headless: true,
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "node --import tsx scripts/e2e-server.ts",
        url: "http://localhost:3012",
        reuseExistingServer: false,
        timeout: 120000,
      },
});
