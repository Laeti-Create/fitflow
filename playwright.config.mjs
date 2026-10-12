import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',workers:1,timeout:45000,
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},headless:true,
    // Only for the test runner's managed HTTPS inspection proxy, never the app.
    ...(process.env.HTTPS_PROXY ? {ignoreHTTPSErrors:true,proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}} : {})},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
});
