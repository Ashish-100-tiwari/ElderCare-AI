/**
 * HTTP helpers shared by every route handler.
 *
 * The contract: handlers throw `ApiError` for anything expected, and
 * `handleRoute` turns whatever escapes into a clean JSON body with a correct
 * status code. Unexpected errors always collapse to a generic 500 — no stack
 * traces, no driver messages, no prompt text ever reaches the client.
 */

import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { MissingEnvError } from "@/lib/env";
import { log } from "@/lib/logger";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    /** Safe-to-expose field errors, e.g. from Zod. */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "VALIDATION_ERROR", message, details);
  }

  static notFound(message: string) {
    return new ApiError(404, "NOT_FOUND", message);
  }

  /** No usable session. The client's cue to send the user to /signin. */
  static unauthorized(message = "Sign in to continue.") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  /** Signed in, but not as someone allowed to touch this resource. */
  static forbidden(message = "You do not have access to this resource.") {
    return new ApiError(403, "FORBIDDEN", message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(status: number, code: ErrorCode, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/**
 * Parses a JSON body, rejecting malformed payloads and non-object roots with a
 * 400 rather than letting a TypeError bubble up as a 500.
 */
export async function parseJsonBody(request: Request): Promise<unknown> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body could not be read.");
  }

  if (!raw.trim()) {
    throw new ApiError(400, "INVALID_JSON", "Request body is required.");
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
}

/** Flattens a ZodError into `{ field: [messages] }` — safe to return to a client. */
function zodDetails(error: ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** True for connection-level Prisma/pg failures, which we report as 503. */
function isDatabaseConnectionError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (typeof code !== "string") return false;
  // P1000-P1017 are Prisma connection/auth/timeout errors; ECONNREFUSED is pg.
  return /^P10\d\d$/.test(code) || code === "ECONNREFUSED" || code === "ENOTFOUND";
}

/**
 * Wraps a route handler so no throw escapes as an unhandled 500 with internals
 * attached. `route` is used only for logging.
 */
export async function handleRoute(
  route: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      log.warn("request.rejected", { route, code: error.code, status: error.status });
      return fail(error.status, error.code, error.message, error.details);
    }

    if (error instanceof ZodError) {
      const details = zodDetails(error);
      log.warn("request.rejected", { route, code: "VALIDATION_ERROR", details });
      return fail(400, "VALIDATION_ERROR", "Request validation failed.", details);
    }

    if (error instanceof MissingEnvError) {
      // Name the variable for the operator's benefit; never its value.
      log.error("request.failed", { route, missingEnv: error.variable });
      return fail(
        503,
        "CONFIGURATION_ERROR",
        `Server is not configured correctly (missing ${error.variable}).`,
      );
    }

    if (isDatabaseConnectionError(error)) {
      log.error("db.error", { route, error });
      return fail(503, "SERVICE_UNAVAILABLE", "Database is unavailable. Please try again.");
    }

    log.error("request.failed", { route, error });
    return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
