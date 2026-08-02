import { config as loadEnvironment } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../.env"),
  quiet: true,
});

const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(directDatabaseUrl
    ? {
        datasource: {
          url: directDatabaseUrl,
        },
      }
    : {}),
});
