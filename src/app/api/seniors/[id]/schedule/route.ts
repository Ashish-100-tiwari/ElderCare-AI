/** GET /api/seniors/:id/schedule — today's schedule, chronological. */

import { requireSeniorAccess } from "@/lib/auth/session";
import { handleRoute, ok } from "@/lib/http";
import { scheduleItem } from "@/lib/serializers";
import { istDateKey } from "@/lib/timezone";
import { parseRouteId } from "@/lib/validation";
import { assertSeniorExists, getTodaySchedule } from "@/services/seniorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute("GET /api/seniors/:id/schedule", async () => {
    const { id } = await ctx.params;
    const seniorId = parseRouteId(id, "senior id");

    // 403 rather than 404 when the id is someone else's: the row exists, the
    // caller just has no business reading it.
    await requireSeniorAccess(seniorId);

    // 404 for an unknown senior, rather than an empty list that looks like a
    // senior with nothing planned.
    await assertSeniorExists(seniorId);
    const schedule = await getTodaySchedule(seniorId);

    return ok({
      seniorId,
      // The India calendar day, matching the window `getTodaySchedule` queried.
      // A UTC date key would name the previous day until 05:30 IST.
      date: istDateKey(new Date()),
      schedule: schedule.map(scheduleItem),
    });
  });
}
