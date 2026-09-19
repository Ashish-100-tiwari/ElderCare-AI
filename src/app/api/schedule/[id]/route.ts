/**
 * PATCH /api/schedule/:id — update an activity's status.
 *
 * The UI's own mock-backed version of this lives at /api/bff/schedule/:id; this
 * is the database-backed REST endpoint.
 */

import { ApiError, handleRoute, ok, parseJsonBody } from "@/lib/http";
import { scheduleItem } from "@/lib/serializers";
import { parseRouteId, scheduleUpdateSchema } from "@/lib/validation";
import { updateScheduleStatus } from "@/services/seniorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute("PATCH /api/schedule/:id", async () => {
    const { id } = await ctx.params;
    const scheduleId = parseRouteId(id, "schedule id");

    const body = await parseJsonBody(request);
    // Strict schema: only `status`, and only one of the four valid values.
    const { status } = scheduleUpdateSchema.parse(body);

    const updated = await updateScheduleStatus(scheduleId, status);

    return ok({ schedule: scheduleItem(updated) });
  });
}

/** Naming the mistake beats Next's HTML 404 for an API client. */
export async function GET() {
  return handleRoute("GET /api/schedule/:id", async () => {
    throw new ApiError(405, "VALIDATION_ERROR", "Use PATCH to update a schedule item.");
  });
}
