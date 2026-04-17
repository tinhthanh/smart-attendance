import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    screenshot: 'off',
    trace: 'off',
    launchOptions: { slowMo: 400 },
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'portal-demo',
      use: {
        viewport: { width: 1280, height: 800 },
        video: { mode: 'on', size: { width: 1280, height: 800 } },
      },
      testMatch: 'portal-demo.spec.ts',
    },
    {
      name: 'mobile-demo',
      use: {
        baseURL: 'http://localhost:8100',
        viewport: { width: 390, height: 844 },
        video: { mode: 'on', size: { width: 390, height: 844 } },
        geolocation: { latitude: 10.7769, longitude: 106.7009 },
        permissions: ['geolocation'],
      },
      testMatch: 'mobile-demo.spec.ts',
    },
  ],
  outputDir: './videos/test-results',
});
