/** GET /api/seniors/:id/alerts — family alerts raised for this senior. */

import { handleRoute, ok } from "@/lib/http";
import { alertItem } from "@/lib/serializers";
import { parseLimit, parseRouteId } from "@/lib/validation";
import {
  DEFAULT_ALERT_LIMIT,
  MAX_LIMIT,
  assertSeniorExists,
  getAlerts,
} from "@/services/seniorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute("GET /api/seniors/:id/alerts", async () => {
    const { id } = await ctx.params;
    const seniorId = parseRouteId(id, "senior id");

    const limit = parseLimit(
      new URL(request.url).searchParams.get("limit"),
      DEFAULT_ALERT_LIMIT,
      MAX_LIMIT,
    );

    await assertSeniorExists(seniorId);
    const alerts = await getAlerts(seniorId, limit);

    return ok({ seniorId, alerts: alerts.map(alertItem) });
  });
}
