import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@rabbehni\/database$/,
        replacement: resolve(appDirectory, "../../packages/database/src/index.ts"),
      },
      {
        find: /^@rabbehni\/database\/nest$/,
        replacement: resolve(appDirectory, "../../packages/database/src/nest/index.ts"),
      },
    ],
  },
});
