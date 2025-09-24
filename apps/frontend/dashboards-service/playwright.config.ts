import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:8081";
const BASE_PATH = process.env.BASE_PATH || ""; // e.g. "/dashboard"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 45_000,
  use: {
    baseURL: BASE_URL + BASE_PATH,
    actionTimeout: 10_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
