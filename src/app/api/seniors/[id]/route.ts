/** GET /api/seniors/:id — the senior's profile. */

import { handleRoute, ok } from "@/lib/http";
import { publicSenior } from "@/lib/serializers";
import { parseRouteId } from "@/lib/validation";
import { getSeniorProfile } from "@/services/seniorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute("GET /api/seniors/:id", async () => {
    const { id } = await ctx.params;
    const seniorId = parseRouteId(id, "senior id");

    const senior = await getSeniorProfile(seniorId);

    // publicSenior omits the family phone number and webhook URL.
    return ok({ senior: publicSenior(senior) });
  });
}
