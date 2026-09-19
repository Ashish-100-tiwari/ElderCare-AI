/**
 * The cookie's name, on its own.
 *
 * Split out of `session.ts` because that file imports `next/headers`, which is
 * unavailable in `proxy.ts` — the proxy reads cookies off the NextRequest
 * instead. Keeping the name in one place stops the two readers from drifting
 * apart, which would fail silently as "always signed out".
 */

export const SESSION_COOKIE = "eldercare_session";
