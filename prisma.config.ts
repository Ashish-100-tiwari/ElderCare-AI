import { defineConfig, env } from "prisma/config";
import { config as loadEnv } from "dotenv";

// Next.js reads .env.local automatically; the Prisma CLI does not, so load it here.
// .env is loaded as a fallback so a hosted DATABASE_URL works either way.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
