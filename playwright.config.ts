import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Prefer a system-provided Chromium (e.g. sandboxed CI images) over a
// Playwright-managed download when one exists.
const systemChromium = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: existsSync(systemChromium)
      ? { executablePath: systemChromium }
      : {},
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
