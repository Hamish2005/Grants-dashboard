import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/demo",
  timeout: 120000,
  expect: { timeout: 30000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3014",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  outputDir: "test-results/demo",
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3014",
    url: "http://127.0.0.1:3014/demo",
    env: {
      NEXT_DIST_DIR: ".next",
      AUTH_MODE: "proxy",
      AUTH_JWT_SECRET: "",
      DATABASE_URL:
        "postgresql://unconfigured:unconfigured@127.0.0.1:1/missing",
      STORAGE_DRIVER: "netlify",
    },
    reuseExistingServer: false,
  },
});
