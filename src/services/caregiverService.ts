/**
 * Caregiver dashboard.
 *
 * One endpoint, one round trip. The dashboard would otherwise fire five
 * requests and stitch them together on the client; batching the queries into a
 * single transaction is what makes it feel instant.
 */

import "server-only";

import { WellnessSeverity } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/date";
import { ApiError } from "@/lib/http";
import {
  alertItem,
  caregiverSenior,
  conversationItem,
  scheduleItem,
  wellnessItem,
} from "@/lib/serializers";

const CONVERSATION_LIMIT = 10;
const WELLNESS_LIMIT = 10;
const ALERT_LIMIT = 10;

/**
 * `latestWellnessStatus` is the severity of the most recent report, or
 * NO_CONCERNS when nothing has been reported — a single value the UI can render
 * as a status badge.
 */
export type LatestWellnessStatus = WellnessSeverity | "NO_CONCERNS";

export async function getCaregiverDashboard(seniorId: string) {
  const { start, end } = dayRange();

  const [senior, todaySchedule, recentConversations, wellnessReports, alerts, openAlerts] =
    await prisma.$transaction([
      prisma.senior.findUnique({ where: { id: seniorId } }),
      prisma.schedule.findMany({
        where: { seniorId, scheduledTime: { gte: start, lt: end } },
        orderBy: { scheduledTime: "asc" },
      }),
      prisma.conversation.findMany({
        where: { seniorId },
        orderBy: { createdAt: "desc" },
        take: CONVERSATION_LIMIT,
      }),
      prisma.wellnessReport.findMany({
        where: { seniorId },
        orderBy: { createdAt: "desc" },
        take: WELLNESS_LIMIT,
      }),
      prisma.alert.findMany({
        where: { seniorId },
        orderBy: { createdAt: "desc" },
        take: ALERT_LIMIT,
      }),
      // Alert has no resolved flag in the MVP schema, so "open" means raised
      // today — the set a caregiver still needs to act on.
      prisma.alert.count({ where: { seniorId, createdAt: { gte: start, lt: end } } }),
    ]);

  if (!senior) throw ApiError.notFound("Senior not found.");

  const completedActivities = todaySchedule.filter((item) => item.status === "COMPLETED").length;
  const latestWellnessStatus: LatestWellnessStatus = wellnessReports[0]?.severity ?? "NO_CONCERNS";

  return {
    senior: caregiverSenior(senior),
    todaySchedule: todaySchedule.map(scheduleItem),
    recentConversations: recentConversations.map(conversationItem),
    wellnessReports: wellnessReports.map(wellnessItem),
    alerts: alerts.map(alertItem),
    stats: {
      completedActivities,
      totalActivities: todaySchedule.length,
      /** When the senior last spoke to the companion. Null if never. */
      latestCheckIn: recentConversations[0]?.createdAt.toISOString() ?? null,
      openAlerts,
      latestWellnessStatus,
    },
  };
}
