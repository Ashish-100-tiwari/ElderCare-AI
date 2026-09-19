/**
 * Family alert webhook.
 *
 * Design rule: notifying the family is best-effort and must never take the
 * application down with it. Every path through this module returns a
 * WebhookStatus instead of throwing, so a missing URL, a timeout, or a 500 from
 * the receiving end all end up as a recorded status on the alert.
 */

import "server-only";

import { WebhookStatus } from "@/generated/prisma";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/** A slow receiver should not make the senior wait for their reply. */
const TIMEOUT_MS = 5000;

export type FamilyAlertPayload = {
  event: "senior_discomfort";
  seniorId: string;
  seniorName: string;
  message: string;
  timestamp: string;
};

/** Only real outbound HTTP. Guards against a mistyped or `file:` URL in config. */
function resolveUrl(perSeniorUrl: string | null): string | null {
  const candidate = perSeniorUrl?.trim() || env.familyWebhookUrl();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      log.warn("webhook.result", { status: "SIMULATED", reason: "unsupported_protocol" });
      return null;
    }
    return url.toString();
  } catch {
    log.warn("webhook.result", { status: "SIMULATED", reason: "malformed_url" });
    return null;
  }
}

/**
 * Posts a family alert.
 *
 * Returns SIMULATED when no webhook URL is configured — the hackathon default,
 * so the whole flow is demonstrable without any external service. Returns
 * FAILED on a non-2xx response, a timeout, or a network error; the caller keeps
 * the wellness report either way.
 */
export async function sendFamilyAlert(params: {
  senior: { id: string; name: string; familyWebhookUrl: string | null };
  message: string;
  alertId: string;
}): Promise<WebhookStatus> {
  const { senior, message, alertId } = params;

  const url = resolveUrl(senior.familyWebhookUrl);
  if (!url) {
    log.info("webhook.result", {
      alertId,
      seniorId: senior.id,
      status: WebhookStatus.SIMULATED,
      reason: "no_webhook_url_configured",
    });
    return WebhookStatus.SIMULATED;
  }

  const payload: FamilyAlertPayload = {
    event: "senior_discomfort",
    seniorId: senior.id,
    seniorName: senior.name,
    message,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Form back-ends such as Formspree answer a plain POST with a 302 to an
        // HTML thank-you page; with this they answer with a JSON status we can
        // read as SENT or FAILED.
        Accept: "application/json",
        "User-Agent": "ElderCareAI/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      log.warn("webhook.result", {
        alertId,
        seniorId: senior.id,
        status: WebhookStatus.FAILED,
        httpStatus: response.status,
      });
      return WebhookStatus.FAILED;
    }

    log.info("webhook.result", {
      alertId,
      seniorId: senior.id,
      status: WebhookStatus.SENT,
      httpStatus: response.status,
    });
    return WebhookStatus.SENT;
  } catch (error) {
    // Timeout, DNS failure, connection refused — all the same to us.
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error";
    log.warn("webhook.result", {
      alertId,
      seniorId: senior.id,
      status: WebhookStatus.FAILED,
      reason,
    });
    return WebhookStatus.FAILED;
  }
}
