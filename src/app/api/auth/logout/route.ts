/**
 * POST /api/auth/logout — clear the session cookie.
 *
 * POST, not GET: a GET would let a prefetch, an <img> tag, or a link preview
 * sign the user out. Succeeds even with no session, so the client can call it
 * without first checking — signing out is idempotent.
 */

import { handleRoute, ok } from "@/lib/http";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return handleRoute("POST /api/auth/logout", async () => {
    const session = await getSession();
    await clearSessionCookie();

    if (session) log.info("auth.signed_out", { seniorId: session.seniorId });

    return ok({ signedOut: true });
  });
}
