/**
 * Wellness detection and recording.
 *
 * Detection runs server-side only and never reads a flag from the request body,
 * so a compromised or buggy client cannot fake or suppress an alert.
 *
 * Two layers:
 *   1. wellnessRules.analyzeWithRules — deterministic, instant, demo-safe.
 *   2. An optional model classifier, consulted only when the rules find nothing
 *      but the sentence still looks like it is about how the senior feels.
 */

import "server-only";

import { AlertType, WebhookStatus, WellnessCategory, WellnessSeverity } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { log, preview } from "@/lib/logger";
import { sanitizeText } from "@/lib/sanitize";
import { classifyWellnessWithModel } from "@/services/openaiService";
import { sendFamilyAlert } from "@/services/webhookService";
import {
  NOT_A_CONCERN,
  SELF_REPORT_HINTS,
  analyzeWithRules,
  type WellnessAnalysis,
} from "@/services/wellnessRules";

export type { WellnessAnalysis };

/**
 * Analyses a message. `allowModel` is opt-in so the rules path stays free and
 * synchronous; the model is a safety net, not the primary mechanism.
 */
export async function analyzeMessage(
  message: string,
  options: { allowModel?: boolean } = {},
): Promise<WellnessAnalysis> {
  const text = sanitizeText(message);
  if (!text) return NOT_A_CONCERN;

  const ruleResult = analyzeWithRules(text);
  if (ruleResult.isConcern) return ruleResult;

  const worthAsking = options.allowModel === true && SELF_REPORT_HINTS.test(text) && text.length <= 400;
  if (!worthAsking) return NOT_A_CONCERN;

  // Layer 2. Any failure here degrades to "no concern detected" rather than
  // breaking the conversation — the rules already caught the explicit cases.
  const classification = await classifyWellnessWithModel(text);
  if (!classification || !classification.isConcern) return NOT_A_CONCERN;

  return {
    isConcern: true,
    category: classification.category,
    severity: classification.severity,
    matched: [],
    source: "model",
  };
}

export type WellnessEvent = {
  report: { id: string; category: WellnessCategory; severity: WellnessSeverity };
  alert: { id: string; type: AlertType; webhookStatus: WebhookStatus };
};

/**
 * Records a detected concern: WellnessReport, then Alert, then the family
 * webhook.
 *
 * The two rows are written in a transaction so a caregiver never sees an alert
 * with no report behind it. The webhook is deliberately outside that
 * transaction — a slow third party must not hold a database lock — and its
 * outcome is written back to the alert afterwards. A webhook failure never
 * removes the report.
 */
export async function recordWellnessEvent(params: {
  senior: { id: string; name: string; familyWebhookUrl: string | null };
  message: string;
  analysis: WellnessAnalysis;
}): Promise<WellnessEvent> {
  const { senior, analysis } = params;
  const message = sanitizeText(params.message);

  const type =
    analysis.category === WellnessCategory.DISCOMFORT
      ? AlertType.DISCOMFORT_REPORTED
      : AlertType.WELLNESS_CONCERN;

  const [report, alert] = await prisma.$transaction([
    prisma.wellnessReport.create({
      data: {
        seniorId: senior.id,
        message,
        category: analysis.category,
        severity: analysis.severity,
      },
      select: { id: true, category: true, severity: true },
    }),
    prisma.alert.create({
      data: {
        seniorId: senior.id,
        type,
        // The alert quotes the senior verbatim. No interpretation added.
        message,
        webhookStatus: WebhookStatus.PENDING,
      },
      select: { id: true, type: true, webhookStatus: true },
    }),
  ]);

  log.info("wellness.report_created", {
    seniorId: senior.id,
    reportId: report.id,
    category: report.category,
    severity: report.severity,
    source: analysis.source,
  });
  log.info("alert.created", { seniorId: senior.id, alertId: alert.id, type: alert.type });

  const webhookStatus = await sendFamilyAlert({ senior, message, alertId: alert.id });

  // Persist the outcome. If this write itself fails we still return the alert —
  // the record exists and the dashboard will show it as PENDING.
  try {
    await prisma.alert.update({
      where: { id: alert.id },
      data: { webhookStatus },
      select: { id: true },
    });
  } catch (error) {
    log.error("db.error", { context: "alert.webhookStatus update", alertId: alert.id, error });
  }

  return { report, alert: { ...alert, webhookStatus } };
}

/** Convenience wrapper used by both /api/chat and /api/wellness. */
export async function detectAndRecord(params: {
  senior: { id: string; name: string; familyWebhookUrl: string | null };
  message: string;
  allowModel?: boolean;
}): Promise<{ analysis: WellnessAnalysis; event: WellnessEvent | null }> {
  const analysis = await analyzeMessage(params.message, { allowModel: params.allowModel });

  if (!analysis.isConcern) {
    return { analysis, event: null };
  }

  log.info("wellness.detected", {
    seniorId: params.senior.id,
    category: analysis.category,
    severity: analysis.severity,
    source: analysis.source,
    matched: analysis.matched,
    messagePreview: preview(params.message),
  });

  const event = await recordWellnessEvent({
    senior: params.senior,
    message: params.message,
    analysis,
  });

  return { analysis, event };
}
