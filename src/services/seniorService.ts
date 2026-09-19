/**
 * Senior, schedule, conversation, wellness and alert reads.
 *
 * Every function here scopes its query by seniorId. That is what stops
 * /api/seniors/A/alerts from ever returning B's data, and it is why the schedule
 * update takes both ids rather than trusting a bare schedule id.
 */

import "server-only";

import type { ScheduleStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/date";
import { ApiError } from "@/lib/http";

export const DEFAULT_CONVERSATION_LIMIT = 20;
export const DEFAULT_WELLNESS_LIMIT = 20;
export const DEFAULT_ALERT_LIMIT = 20;
export const MAX_LIMIT = 100;

export async function getSeniorProfile(seniorId: string) {
  const senior = await prisma.senior.findUnique({ where: { id: seniorId } });
  if (!senior) throw ApiError.notFound("Senior not found.");
  return senior;
}

/** Existence check for routes that only need to 404 early. */
export async function assertSeniorExists(seniorId: string): Promise<void> {
  const found = await prisma.senior.findUnique({ where: { id: seniorId }, select: { id: true } });
  if (!found) throw ApiError.notFound("Senior not found.");
}

/** Today's activities, chronological. */
export function getTodaySchedule(seniorId: string) {
  const { start, end } = dayRange();
  return prisma.schedule.findMany({
    where: { seniorId, scheduledTime: { gte: start, lt: end } },
    orderBy: { scheduledTime: "asc" },
  });
}

/** Most recent first — what a caregiver wants to see at the top. */
export function getRecentConversations(seniorId: string, limit = DEFAULT_CONVERSATION_LIMIT) {
  return prisma.conversation.findMany({
    where: { seniorId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function getWellnessReports(seniorId: string, limit = DEFAULT_WELLNESS_LIMIT) {
  return prisma.wellnessReport.findMany({
    where: { seniorId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function getAlerts(seniorId: string, limit = DEFAULT_ALERT_LIMIT) {
  return prisma.alert.findMany({
    where: { seniorId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Updates a schedule entry's status.
 *
 * Throws 404 for an unknown id rather than letting Prisma's P2025 surface as a
 * 500 — an invalid schedule id is a client mistake, not a server fault.
 *
 * `ownerSeniorId` scopes the write to the caller's own schedule. Another
 * senior's row reads as 404, not 403: a schedule id is opaque, and confirming it
 * exists would tell the caller something they should not learn from a guess.
 */
export async function updateScheduleStatus(
  scheduleId: string,
  status: ScheduleStatus,
  ownerSeniorId: string,
) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, seniorId: ownerSeniorId },
    select: { id: true },
  });
  if (!existing) throw ApiError.notFound("Schedule item not found.");

  return prisma.schedule.update({
    where: { id: scheduleId },
    data: { status },
  });
}
