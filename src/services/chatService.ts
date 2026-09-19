/**
 * Chat orchestration — the whole /api/chat flow in one readable function.
 *
 * Kept out of the route handler so the route stays a thin validate-and-respond
 * shell and this sequence can be read (and tested) on its own.
 */

import "server-only";

import type { WebhookStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { log, preview } from "@/lib/logger";
import { sanitizeText } from "@/lib/sanitize";
import { getSeniorContext, getSeniorForAlerting } from "@/services/knowledgeBaseService";
import { generateCompanionReply } from "@/services/openaiService";
import { detectAndRecord } from "@/services/wellnessService";

export type ChatResult = {
  response: string;
  wellnessAlert: boolean;
  alertId: string | null;
  webhookStatus: WebhookStatus | null;
  conversationId: string;
};

export async function handleChat(params: {
  seniorId: string;
  message: string;
}): Promise<ChatResult> {
  const seniorId = params.seniorId;
  const message = sanitizeText(params.message);

  log.info("chat.request", {
    seniorId,
    messageLength: message.length,
    messagePreview: preview(message),
  });

  /**
   * Steps 1-5: load everything we know about this senior.
   *
   * Two reads because they answer to different rules: the context is what the
   * model may see, while the alerting record carries the webhook URL, which the
   * model must never see. Both throw 404 for an unknown seniorId, so an invalid
   * id is rejected before any model spend.
   */
  const [context, senior] = await Promise.all([
    getSeniorContext(seniorId),
    getSeniorForAlerting(seniorId),
  ]);

  /**
   * Steps 6-11 run concurrently, and that ordering is deliberate.
   *
   * Wellness detection does not depend on the model's reply, so pairing them
   * saves a round trip — and more importantly it means that if OpenAI is down
   * when someone reports chest pain, the family alert still goes out. Safety
   * should not be downstream of a chat completion.
   */
  const [replyOutcome, wellnessOutcome] = await Promise.allSettled([
    generateCompanionReply({ context, message }),
    detectAndRecord({ senior, message, allowModel: true }),
  ]);

  // A detection failure degrades quietly: the senior still gets their reply.
  let wellnessAlert = false;
  let alertId: string | null = null;
  let webhookStatus: WebhookStatus | null = null;

  if (wellnessOutcome.status === "fulfilled") {
    const event = wellnessOutcome.value.event;
    if (event) {
      wellnessAlert = true;
      alertId = event.alert.id;
      webhookStatus = event.alert.webhookStatus;
    }
  } else {
    log.error("db.error", {
      context: "wellness detection",
      seniorId,
      error: wellnessOutcome.reason,
    });
  }

  // The reply is the one thing we cannot substitute, so its failure propagates
  // (the route turns it into a 503). Any alert raised above is already sent.
  if (replyOutcome.status === "rejected") {
    throw replyOutcome.reason;
  }
  const response = replyOutcome.value;

  // Step 9: persist the exchange.
  const conversation = await prisma.conversation.create({
    data: { seniorId, userMessage: message, aiResponse: response },
    select: { id: true },
  });

  log.info("chat.response", {
    seniorId,
    conversationId: conversation.id,
    responseLength: response.length,
    wellnessAlert,
    webhookStatus,
  });

  return {
    response,
    wellnessAlert,
    alertId,
    webhookStatus,
    conversationId: conversation.id,
  };
}
