import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { verifySessionFromCookieHeader } from "@/lib/auth/token";

/**
 * Shared plumbing for the `/api/bff/*` route handlers.
 *
 * Three jobs: require a session, return a consistent error body, and parse a
 * JSON body forgivingly. Talking to the live backend is `lib/server/live.ts`;
 * falling back to demo data is `lib/server/store.ts`. Keeping the three apart is
 * what lets the app run with a database, without one, or with the backend
 * deployed elsewhere, without a single component knowing which.
 */

/** Uniform JSON error body — `lib/api.ts` reads `error` for its retry states. */
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Wraps a handler so every route returns a consistent error shape — and requires
 * a signed-in session.
 *
 * The check lives here rather than in each of the fifteen BFF routes because a
 * per-file check is one someone can forget to add to the sixteenth. These routes
 * take no senior id from the client (they serve `SENIOR_ID` from the
 * environment), so "is there a valid session" is the whole authorisation
 * question at this layer; the backend routes behind them check the id as well.
 *
 * The cookie is read off the Request rather than through `next/headers`: Next
 * always passes the Request as the first argument, and doing it this way keeps
 * these handlers callable from a test without a request-scoped store.
 */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const request = args[0];
      const cookieHeader = request instanceof Request ? request.headers.get("cookie") : null;

      if (!(await verifySessionFromCookieHeader(cookieHeader, SESSION_COOKIE))) {
        // `code` so the client can send the user to /signin rather than showing
        // a retry button for something retrying will never fix.
        return NextResponse.json(
          { error: "Sign in to continue.", code: "UNAUTHORIZED" },
          { status: 401 },
        );
      }

      return await fn(...args);
    } catch (error) {
      console.error("[eldercare] route failed:", error);
      return errorResponse(error);
    }
  };
}

/** Parses a JSON request body, tolerating an empty one. */
export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}
