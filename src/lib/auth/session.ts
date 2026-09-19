/**
 * The session cookie.
 *
 * Server-only, and the only place that touches `cookies()`. Route handlers and
 * server components go through `getSession()` / `requireSession()` rather than
 * reading the cookie themselves, so the "is this token actually valid" check can
 * never be skipped by accident.
 *
 * `proxy.ts` also checks the cookie, but that check is an optimisation: it keeps
 * a signed-out visitor from loading a dashboard shell. It is not the security
 * boundary. Every route that returns real data verifies the session itself —
 * see the Next auth guide's warning about relying on layouts or proxy alone.
 */

import "server-only";

import { cookies } from "next/headers";
import { ApiError } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import {
  SESSION_MAX_AGE_SECONDS,
  type SessionPayload,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/token";

export { SESSION_COOKIE };

/** Reads and verifies the cookie. Null when absent, expired, or tampered with. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Same, but throws a 401 `ApiError` — the form route handlers expect. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized();
  return session;
}

/**
 * Throws 401 without a session and 403 when the session belongs to a different
 * senior. Without the second check, any signed-in user could read another
 * senior's conversations by editing the id in the URL.
 */
export async function requireSeniorAccess(seniorId: string): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.seniorId !== seniorId) throw ApiError.forbidden();
  return session;
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    // Unreadable from document.cookie, so an XSS bug cannot exfiltrate the token.
    httpOnly: true,
    // HTTPS only in production; http://localhost would drop the cookie otherwise.
    secure: process.env.NODE_ENV === "production",
    // "lax" still sends the cookie on a top-level navigation into the app, which
    // is what makes a bookmarked /senior link work while blocking cross-site POSTs.
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  // Overwrite with an immediately-expiring value rather than only delete(), so
  // any intermediate cache is told the cookie is gone too.
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
