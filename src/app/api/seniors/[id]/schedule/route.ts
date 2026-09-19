/** GET /api/seniors/:id/schedule — today's schedule, chronological. */

import { handleRoute, ok } from "@/lib/http";
import { scheduleItem } from "@/lib/serializers";
import { parseRouteId } from "@/lib/validation";
import { assertSeniorExists, getTodaySchedule } from "@/services/seniorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute("GET /api/seniors/:id/schedule", async () => {
    const { id } = await ctx.params;
    const seniorId = parseRouteId(id, "senior id");

    // 404 for an unknown senior, rather than an empty list that looks like a
    // senior with nothing planned.
    await assertSeniorExists(seniorId);
    const schedule = await getTodaySchedule(seniorId);

    return ok({
      seniorId,
      date: new Date().toISOString().slice(0, 10),
      schedule: schedule.map(scheduleItem),
    });
  });
}
