// wdio.conf.ts
import { defineConfig } from "@wdio/config";
import { randomUUID } from "crypto";
import { rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Create a single run id in the launcher process and propagate it to workers.
// Workers inherit env vars, so they will reuse this exact value.
const E2E_RUN_ID = process.env.MY_MONEY_E2E_RUN_ID ?? randomUUID();
process.env.MY_MONEY_E2E_RUN_ID = E2E_RUN_ID;
const E2E_RUN_DIR =
  process.env.MY_MONEY_E2E_RUN_DIR ??
  join(tmpdir(), "my-money-e2e", E2E_RUN_ID);
process.env.MY_MONEY_E2E_RUN_DIR = E2E_RUN_DIR;

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
  onComplete: () => {
    // Clean up temp DB files created by *this* e2e run.
    // Do this here (after workers/sessions end) to avoid Windows file-lock issues.
    try {
      rmSync(E2E_RUN_DIR, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; don't fail the test run for temp file issues.
    }
  },
});
