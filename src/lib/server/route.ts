import { NextResponse } from "next/server";

/**
 * Shared plumbing for the `/api/bff/*` route handlers.
 *
 * Two jobs only: a consistent error body, and a forgiving JSON body parser.
 * Talking to the live backend is `lib/server/live.ts`; falling back to demo data
 * is `lib/server/store.ts`. Keeping the three apart is what lets the app run
 * with a database, without one, or with the backend deployed elsewhere, without
 * a single component knowing which.
 */

/** Uniform JSON error body — `lib/api.ts` reads `error` for its retry states. */
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Wraps a handler so every route returns a consistent error shape. */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
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
