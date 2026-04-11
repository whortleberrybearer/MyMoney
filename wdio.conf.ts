// wdio.conf.ts
import { defineConfig } from "@wdio/config";

export const config = defineConfig({
  runner: "local",
  specs: ["./tests/e2e/**/*.test.ts"],
  capabilities: [
    {
      "tauri:options": {
        application: ".",
      },
    },
  ],
  services: [
    [
      "@wdio/tauri-service",
      {
        commandTimeout: 30000,
        debug: true,
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    timeout: 60000,
  },
});
