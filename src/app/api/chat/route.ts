/**
 * POST /api/chat — the companion conversation.
 *
 * The route stays thin on purpose: validate, delegate, respond. The twelve-step
 * flow lives in chatService so it can be read in one place.
 */

import { ApiError, handleRoute, ok, parseJsonBody } from "@/lib/http";
import { chatRequestSchema } from "@/lib/validation";
import { handleChat } from "@/services/chatService";
import { AiUnavailableError } from "@/services/openaiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute("POST /api/chat", async () => {
    const body = await parseJsonBody(request);

    /**
     * Strict schema: `seniorId` and `message` only. A client cannot smuggle in
     * `wellnessAlert`, `severity` or `category` — the backend decides those.
     */
    const { seniorId, message } = chatRequestSchema.parse(body);

    try {
      const result = await handleChat({ seniorId, message });
      return ok(result);
    } catch (error) {
      if (error instanceof AiUnavailableError) {
        // 503, not 500: the request was fine, the upstream model was not.
        // Any wellness alert raised for this message has already been sent.
        throw new ApiError(
          503,
          "SERVICE_UNAVAILABLE",
          "The companion is unavailable right now. Please try again in a moment.",
        );
      }
      throw error;
    }
  });
}
