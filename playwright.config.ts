import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/generated',
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    browserName: 'chromium',
    headless: true,
    // Captured for every test, not just failures -- same reasoning as local
    // headed execution's own config: this runs on a GitHub-hosted runner
    // with no one watching live, so the screenshot/video/trace in the
    // report is the only way to actually see what a passed run did too.
    screenshot: 'on',
    trace: 'on',
    video: 'on',
  },
});
