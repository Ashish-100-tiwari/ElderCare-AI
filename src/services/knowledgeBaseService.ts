/**
 * The senior knowledge base.
 *
 * One function, one job: gather everything the companion is allowed to know
 * about a senior into a single object. This is the only place that decides what
 * the model gets to see, which makes the privacy boundary easy to audit.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/date";
import { ApiError } from "@/lib/http";

/** How much history is worth the tokens. Enough to feel continuous, not more. */
export const RECENT_CONVERSATION_LIMIT = 6;
export const RECENT_WELLNESS_LIMIT = 5;

/** Fields the companion is allowed to know. Deliberately excludes phone + webhook URL. */
const SENIOR_CONTEXT_FIELDS = {
  id: true,
  name: true,
  age: true,
  language: true,
  preferences: true,
  familyContactName: true,
} as const;

export type SeniorContext = {
  seniorProfile: {
    id: string;
    name: string;
    age: number;
    language: string;
    familyContactName: string;
  };
  preferences: string[];
  schedule: Array<{
    id: string;
    activity: string;
    description: string;
    scheduledTime: Date;
    status: string;
  }>;
  recentConversations: Array<{
    id: string;
    userMessage: string;
    aiResponse: string;
    createdAt: Date;
  }>;
  recentWellnessReports: Array<{
    id: string;
    message: string;
    category: string;
    severity: string;
    createdAt: Date;
  }>;
};

/**
 * Loads the full context for a senior.
 *
 * Throws a 404 ApiError if the senior does not exist — callers treat an unknown
 * seniorId as a client error, not an empty context.
 */
export async function getSeniorContext(seniorId: string): Promise<SeniorContext> {
  const { start, end } = dayRange();

  // One round trip. The senior lookup and its three history queries are
  // independent, so there is no reason to await them in sequence.
  const [senior, schedule, conversations, wellnessReports] = await prisma.$transaction([
    prisma.senior.findUnique({
      where: { id: seniorId },
      select: SENIOR_CONTEXT_FIELDS,
    }),
    prisma.schedule.findMany({
      where: { seniorId, scheduledTime: { gte: start, lt: end } },
      orderBy: { scheduledTime: "asc" },
      select: { id: true, activity: true, description: true, scheduledTime: true, status: true },
    }),
    prisma.conversation.findMany({
      where: { seniorId },
      orderBy: { createdAt: "desc" },
      take: RECENT_CONVERSATION_LIMIT,
      select: { id: true, userMessage: true, aiResponse: true, createdAt: true },
    }),
    prisma.wellnessReport.findMany({
      where: { seniorId },
      orderBy: { createdAt: "desc" },
      take: RECENT_WELLNESS_LIMIT,
      select: { id: true, message: true, category: true, severity: true, createdAt: true },
    }),
  ]);

  if (!senior) {
    throw ApiError.notFound("Senior not found.");
  }

  const { preferences, ...seniorProfile } = senior;

  return {
    seniorProfile,
    preferences,
    schedule,
    // Newest-first from the database, reversed so the model reads it as a transcript.
    recentConversations: conversations.reverse(),
    recentWellnessReports: wellnessReports,
  };
}

/** Cheap existence + notification details check, without loading history. */
export async function getSeniorForAlerting(seniorId: string) {
  const senior = await prisma.senior.findUnique({
    where: { id: seniorId },
    select: { id: true, name: true, familyContactName: true, familyWebhookUrl: true },
  });

  if (!senior) {
    throw ApiError.notFound("Senior not found.");
  }
  return senior;
}
