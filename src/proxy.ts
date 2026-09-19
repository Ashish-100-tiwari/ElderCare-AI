/**
 * Route protection, first pass.
 *
 * `middleware.ts` is deprecated in this version of Next and renamed to `proxy`;
 * this file sits next to `app/` for that reason. It runs on the Node.js runtime.
 *
 * What this is: an optimistic check that keeps a signed-out visitor from loading
 * a dashboard shell, and remembers where they were going.
 *
 * What this is NOT: the security boundary. It only verifies the cookie's
 * signature — it never reads the database, and a proxy can be skipped in ways a
 * route handler cannot. Every route that returns real data calls
 * `requireSession()` / `requireSeniorAccess()` for itself. The Next auth guide
 * is explicit that proxy and layout checks alone are not enough.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { verifySessionToken } from "@/lib/auth/token";

export async function proxy(request: NextRequest) {
  // NextRequest.cookies has already parsed the header for us here.
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const signIn = new URL("/signin", request.url);
  // Carry the search string too, so a link like /senior/schedule?day=tomorrow
  // still lands on the right view after signing in.
  signIn.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(signIn);
}

export const config = {
  // Only the two signed-in areas. Everything else — the landing page, /signin,
  // the API routes (which answer 401 themselves rather than redirect), static
  // assets — is deliberately left alone.
  matcher: ["/senior", "/senior/:path*", "/caregiver", "/caregiver/:path*"],
};
