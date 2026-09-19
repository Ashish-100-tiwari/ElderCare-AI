/**
 * GET /api/health — readiness check for the demo.
 *
 * Reports whether each dependency is *configured and reachable* as a boolean.
 * It never returns a URL, a key, a key prefix, or a driver error message, so it
 * is safe to hit from anywhere.
 */

import { prisma } from "@/lib/prisma";
import { handleRoute, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute("GET /api/health", async () => {
    let database = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      // Swallowed deliberately: the boolean is the whole answer.
      database = false;
    }

    return ok(
      {
        status: database ? "ok" : "degraded",
        checks: {
          database,
          openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
          // False here simply means alerts will be recorded as SIMULATED.
          familyWebhookConfigured: Boolean(process.env.FAMILY_WEBHOOK_URL?.trim()),
        },
        at: new Date().toISOString(),
      },
      database ? 200 : 503,
    );
  });
}
