/**
 * POST /api/auth/login — exchange email + password for a session cookie.
 *
 * The token never appears in the response body. It is set as an httpOnly cookie
 * and nothing else, so no client code can read it, log it, or stash it in
 * localStorage where an XSS bug would find it.
 *
 * Every rejection is the same 401 with the same message. See authService for why.
 */

import { ApiError, handleRoute, ok, parseJsonBody } from "@/lib/http";
import { signInSchema } from "@/lib/validation";
import { createSessionCookie } from "@/lib/auth/session";
import { authenticate } from "@/services/authService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute("POST /api/auth/login", async () => {
    const body = await parseJsonBody(request);
    const { email, password } = signInSchema.parse(body);

    const session = await authenticate(email, password);
    if (!session) {
      throw ApiError.unauthorized("Email or password is incorrect.");
    }

    await createSessionCookie(session);

    return ok({
      seniorId: session.seniorId,
      name: session.name,
      email: session.email,
      role: session.role,
    });
  });
}
