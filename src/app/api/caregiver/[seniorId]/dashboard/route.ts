/**
 * GET /api/caregiver/:seniorId/dashboard
 *
 * Everything the family dashboard needs in one aggregated response, so the UI
 * renders from a single fetch instead of five.
 */

import { handleRoute, ok } from "@/lib/http";
import { parseRouteId } from "@/lib/validation";
import { getCaregiverDashboard } from "@/services/caregiverService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ seniorId: string }> }) {
  return handleRoute("GET /api/caregiver/:seniorId/dashboard", async () => {
    const { seniorId: rawId } = await ctx.params;
    const seniorId = parseRouteId(rawId, "senior id");

    const dashboard = await getCaregiverDashboard(seniorId);

    return ok(dashboard);
  });
}
