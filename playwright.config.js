'use strict';
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './testler',
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8124',
    serviceWorkers: 'block',
    locale: 'tr-TR'
  },
  webServer: {
    command: 'node testler/sunucu.js',
    url: 'http://127.0.0.1:8124/index.html',
    reuseExistingServer: true,
    timeout: 30000
  }
});
