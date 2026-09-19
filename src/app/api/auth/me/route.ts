/**
 * GET /api/auth/me — who the caller is signed in as.
 *
 * Answers 200 with `{ user: null }` rather than 401 when there is no session:
 * "nobody is signed in" is a successful answer to this question, and it saves
 * the client from treating a normal signed-out state as an error.
 */

import { handleRoute, ok } from "@/lib/http";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute("GET /api/auth/me", async () => {
    const session = await getSession();

    return ok({
      user: session
        ? {
            seniorId: session.seniorId,
            name: session.name,
            email: session.email,
            role: session.role,
          }
        : null,
    });
  });
}
