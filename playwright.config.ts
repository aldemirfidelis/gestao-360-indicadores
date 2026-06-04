import { defineConfig, devices } from '@playwright/test';

const webBaseURL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const apiBaseURL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: webBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @g360/api dev',
      url: `${apiBaseURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        API_CORS_ORIGIN: webBaseURL,
      },
    },
    {
      command: 'pnpm --filter @g360/web dev',
      url: webBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: apiBaseURL,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
