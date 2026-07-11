import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // Live-network specs are opt-in: npx playwright test --grep @network
  grepInvert: process.env.PLAYWRIGHT_NETWORK ? undefined : /@network/,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
