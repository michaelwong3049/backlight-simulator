import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  use: { 
    baseURL: 'http://localhost:3000',
    launchOptions: {
      args: [
        "--enable-unsafe-webgpu"
      ]
    }
  },
  webServer: {
    command: "npm start",
    url: "http://localhost:3000",
  }
});
