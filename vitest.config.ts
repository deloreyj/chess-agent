import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/server/index.ts",
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    pool: "@cloudflare/vitest-pool-workers",
    passWithNoTests: true,
  },
});
