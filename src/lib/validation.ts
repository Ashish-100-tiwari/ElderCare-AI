/**
 * Request validation.
 *
 * Every route parses input through one of these before touching the database.
 * Bodies are strict objects: unknown keys are rejected, which is what keeps a
 * client-supplied `wellnessAlert: true` or `severity: "HIGH"` from ever
 * reaching the wellness pipeline. The backend decides those on its own.
 */

import { z } from "zod";
import { ScheduleStatus } from "@/generated/prisma";
import { ApiError } from "@/lib/http";

/** Guards against unbounded input without getting in a real user's way. */
const MAX_MESSAGE_LENGTH = 2000;

/** Ids are cuids or hand-written seed ids like "senior-001". */
export const idSchema = z
  .string({ error: "id must be a string." })
  .trim()
  .min(1, "id is required.")
  .max(128, "id is too long.")
  .regex(/^[A-Za-z0-9_-]+$/, "id contains invalid characters.");

export const messageSchema = z
  .string({ error: "message must be a string." })
  .trim()
  .min(1, "message must not be empty.")
  .max(MAX_MESSAGE_LENGTH, `message must be at most ${MAX_MESSAGE_LENGTH} characters.`);

/** POST /api/chat */
export const chatRequestSchema = z.strictObject({
  seniorId: idSchema,
  message: messageSchema,
});

/** POST /api/wellness */
export const wellnessRequestSchema = z.strictObject({
  seniorId: idSchema,
  message: messageSchema,
});

/** PATCH /api/schedule/:id */
export const scheduleUpdateSchema = z.strictObject({
  status: z.enum(ScheduleStatus, {
    error: `status must be one of: ${Object.values(ScheduleStatus).join(", ")}.`,
  }),
});

/** `?limit=` on the list endpoints. */
export function parseLimit(value: string | null, fallback: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw ApiError.badRequest("limit must be a positive integer.");
  }
  return Math.min(parsed, max);
}

/**
 * Validates a dynamic route segment. Next gives us `string`, but it can still
 * be empty or junk, and we would rather 400 than run a doomed query.
 */
export function parseRouteId(value: string | undefined, label: string): string {
  const result = idSchema.safeParse(value);
  if (!result.success) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
  return result.data;
}
