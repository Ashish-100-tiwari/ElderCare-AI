/**
 * POST /api/wellness — record a wellness concern directly.
 *
 * Same pipeline as /api/chat (report → alert → webhook) without the model reply.
 * Useful for an explicit "how are you feeling?" check-in in the UI, and for
 * demonstrating the alerting path without spending a chat completion.
 *
 * Note what this endpoint does NOT do: accept a category or severity from the
 * caller. Detection runs server-side on the message text, exactly as in chat, so
 * the two paths can never disagree and a client cannot manufacture a HIGH alert.
 */

import { handleRoute, ok, parseJsonBody } from "@/lib/http";
import { wellnessRequestSchema } from "@/lib/validation";
import { getSeniorForAlerting } from "@/services/knowledgeBaseService";
import { detectAndRecord } from "@/services/wellnessService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute("POST /api/wellness", async () => {
    const body = await parseJsonBody(request);
    const { seniorId, message } = wellnessRequestSchema.parse(body);

    // 404 on an unknown senior before writing anything.
    const senior = await getSeniorForAlerting(seniorId);

    const { analysis, event } = await detectAndRecord({ senior, message, allowModel: true });

    return ok(
      {
        seniorId,
        wellnessAlert: Boolean(event),
        category: analysis.isConcern ? analysis.category : null,
        severity: analysis.isConcern ? analysis.severity : null,
        reportId: event?.report.id ?? null,
        alertId: event?.alert.id ?? null,
        webhookStatus: event?.alert.webhookStatus ?? null,
      },
      event ? 201 : 200,
    );
  });
}
