import { defineConfig } from '@playwright/test';
import * as path from 'path';

// Answers people gave to the AI's questions (HITL): uploaded files are in
// ./test-data, secret answers arrive as one JSON environment variable.
process.env.TEST_DATA_DIR = process.env.TEST_DATA_DIR || path.join(__dirname, 'test-data');
try { Object.assign(process.env, JSON.parse(process.env.HITL_SECRETS_JSON || '{}')); } catch { /* none */ }

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
