/** GET /api/seniors/:id/conversations — recent exchanges, newest first. */

import { handleRoute, ok } from "@/lib/http";
import { conversationItem } from "@/lib/serializers";
import { parseLimit, parseRouteId } from "@/lib/validation";
import {
  DEFAULT_CONVERSATION_LIMIT,
  MAX_LIMIT,
  assertSeniorExists,
  getRecentConversations,
} from "@/services/seniorService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute("GET /api/seniors/:id/conversations", async () => {
    const { id } = await ctx.params;
    const seniorId = parseRouteId(id, "senior id");

    const limit = parseLimit(
      new URL(request.url).searchParams.get("limit"),
      DEFAULT_CONVERSATION_LIMIT,
      MAX_LIMIT,
    );

    await assertSeniorExists(seniorId);
    const conversations = await getRecentConversations(seniorId, limit);

    return ok({ seniorId, conversations: conversations.map(conversationItem) });
  });
}
