/**
 * Response shaping.
 *
 * Two views of a senior exist on purpose:
 *
 *   publicSenior    — what the companion app needs. No phone number, no webhook.
 *   caregiverSenior — adds the family phone for the dashboard.
 *
 * Neither ever includes `familyWebhookUrl`: that is delivery infrastructure, not
 * profile data, and there is no reason for any client to see it. Dates are
 * emitted as explicit ISO strings so the API contract does not depend on how
 * the serialiser happens to treat a Date.
 */

import "server-only";

import type {
  Alert,
  Conversation,
  Schedule,
  Senior,
  WellnessReport,
} from "@/generated/prisma";
import { env } from "@/lib/env";

export function publicSenior(senior: Senior) {
  return {
    id: senior.id,
    name: senior.name,
    age: senior.age,
    language: senior.language,
    preferences: senior.preferences,
    familyContactName: senior.familyContactName,
    createdAt: senior.createdAt.toISOString(),
  };
}

export function caregiverSenior(senior: Senior) {
  return {
    ...publicSenior(senior),
    familyContactPhone: senior.familyContactPhone,
    /** Tells the dashboard whether alerts will really be delivered, not where. */
    webhookConfigured: Boolean(senior.familyWebhookUrl?.trim() || env.familyWebhookUrl()),
  };
}

export function scheduleItem(item: Schedule) {
  return {
    id: item.id,
    activity: item.activity,
    description: item.description,
    scheduledTime: item.scheduledTime.toISOString(),
    status: item.status,
  };
}

export function conversationItem(item: Conversation) {
  return {
    id: item.id,
    userMessage: item.userMessage,
    aiResponse: item.aiResponse,
    createdAt: item.createdAt.toISOString(),
  };
}

export function wellnessItem(item: WellnessReport) {
  return {
    id: item.id,
    message: item.message,
    category: item.category,
    severity: item.severity,
    createdAt: item.createdAt.toISOString(),
  };
}

export function alertItem(item: Alert) {
  return {
    id: item.id,
    type: item.type,
    message: item.message,
    webhookStatus: item.webhookStatus,
    createdAt: item.createdAt.toISOString(),
  };
}
