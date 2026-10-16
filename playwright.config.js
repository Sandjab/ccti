// playwright.config.js
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:8765/', timezoneId: 'Europe/Paris', locale: 'fr-FR', colorScheme: 'light' },
  webServer: { command: 'node scripts/serve.mjs 8765', url: 'http://127.0.0.1:8765/', reuseExistingServer: false, timeout: 15_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
