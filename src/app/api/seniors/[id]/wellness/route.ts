/** GET /api/seniors/:id/wellness — reported wellness concerns, newest first. */

import { requireSeniorAccess } from "@/lib/auth/session";
import { handleRoute, ok } from "@/lib/http";
import { wellnessItem } from "@/lib/serializers";
import { parseLimit, parseRouteId } from "@/lib/validation";
import {
  DEFAULT_WELLNESS_LIMIT,
  MAX_LIMIT,
  assertSeniorExists,
  getWellnessReports,
} from "@/services/seniorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute("GET /api/seniors/:id/wellness", async () => {
    const { id } = await ctx.params;
    const seniorId = parseRouteId(id, "senior id");

    // 403 rather than 404 when the id is someone else's: the row exists, the
    // caller just has no business reading it.
    await requireSeniorAccess(seniorId);

    const limit = parseLimit(
      new URL(request.url).searchParams.get("limit"),
      DEFAULT_WELLNESS_LIMIT,
      MAX_LIMIT,
    );

    await assertSeniorExists(seniorId);
    const reports = await getWellnessReports(seniorId, limit);

    return ok({ seniorId, wellnessReports: reports.map(wellnessItem) });
  });
}
