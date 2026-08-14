const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:8000',
    headless: true
  },
  webServer: {
    command: 'npx --yes http-server -p 8000 -c-1',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: true,
    timeout: 30000
  }
});
