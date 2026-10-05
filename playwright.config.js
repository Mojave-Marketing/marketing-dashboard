const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Deterministic test state. These override anything in .env.local *only*
    // when playwright is the one starting the dev server. If a dev server is
    // already running (reuseExistingServer), the local env wins.
    env: {
      SESSION_SECRET: "e2e-session-secret-do-not-use-in-prod",
      DASHBOARD_PASSWORD: "e2e-password",
      WEBHOOK_SECRET: "e2e-webhook-secret",
    },
  },
});
