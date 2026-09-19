import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";

// Next.js reads .env.local automatically; the Prisma CLI does not, so load it here.
// .env is loaded as a fallback so a hosted DATABASE_URL works either way.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

/**
 * The CLI's connection, resolved eagerly rather than with `env()` so the
 * fallback below actually works — `env()` returns a lazy marker, not a string.
 *
 * Migrations must not go through a connection pooler. `prisma migrate` takes a
 * session-level advisory lock, and pgbouncer in transaction mode hands the
 * backend holding it back to the pool — the lock is then stranded on a
 * connection nobody can release it from, and every later migration fails with
 * P1002 "Timed out trying to acquire a postgres advisory lock". Recovering means
 * terminating that backend by hand. DIRECT_DATABASE_URL is the same Neon URL
 * with `-pooler` removed from the host; the app keeps using the pooled one.
 */
const cliUrl = process.env.DIRECT_DATABASE_URL?.trim() || process.env.DATABASE_URL || "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: cliUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
