/**
 * PrismaClient singleton.
 *
 * Prisma 7 takes the connection through a driver adapter rather than a URL in
 * schema.prisma. The client is cached on globalThis so Next's dev-mode module
 * reloading doesn't open a new connection pool on every edit.
 */

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.databaseUrl(),
    // The dashboards poll several /api/bff/* routes at once and each fans out to
    // more than one backend route, so a handful of page views can hold far more
    // than pg's default of 10 connections. Starving the pool surfaces as
    // "Unable to start a transaction in the given time" on an unrelated request.
    // Safe to raise against a Neon pooled URL: pgbouncer, not Postgres, is the
    // thing counting these.
    max: 20,
    // Rather than queue forever behind a saturated pool.
    connectionTimeoutMillis: 10_000,
    // Neon suspends idle compute; a connection held past that is already dead.
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({
    adapter,
    transactionOptions: {
      // A cold Neon compute can take a few seconds to accept the first
      // connection. The default 2s wait gives up while it is still waking.
      maxWait: 10_000,
      timeout: 15_000,
    },
    // Surface slow/failed queries in dev without leaking anything in production.
    log: env.isProduction() ? ["error"] : ["error", "warn"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProduction()) {
  globalForPrisma.prisma = prisma;
}
