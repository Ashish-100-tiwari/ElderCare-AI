import {
  ApiError,
  type Alert,
  type Conversation,
  type CreateWellnessReportPayload,
  type KnowledgeBase,
  type MeditationSession,
  type Mood,
  type ScheduleItem,
  type ScheduleItemUpdate,
  type SendMessagePayload,
  type SendMessageResult,
  type Senior,
  type SeniorUpdate,
  type WellnessReport,
} from "./types";

/**
 * Typed client for the ElderCare AI API.
 *
 * Every call goes to our own `/api/bff/*` routes, which talk to the backend
 * server-side. Two deliberate consequences:
 *
 *  - No API keys or model-provider credentials exist in the browser bundle.
 *  - The frontend never calls OpenAI/ChatGPT directly; all AI traffic goes
 *    through the backend.
 *
 * UI code should import these functions only — never `fetch` directly.
 */

/**
 * Our own BFF namespace. It is separate from the backend's `/api/*` routes on
 * purpose: those speak database shapes, these speak the UI's domain types, and
 * the mapping between them lives server-side in `lib/server/live.ts`.
 */
const BASE_PATH = "/api/bff";

async function request<T>(
  path: string,
  init: RequestInit & { parseAs?: "json" | "void" } = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_PATH}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiError(
      "We couldn't reach the ElderCare service. Please check your connection.",
      0,
      error instanceof Error ? error.message : undefined,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status, body?.detail);
  }

  if (init.parseAs === "void" || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------- Voice */

/*
 * These two bypass `request` on purpose: one sends multipart form data and the
 * other receives binary, so neither fits a helper that sets a JSON content type
 * and parses a JSON body. Both return `null` instead of throwing — voice is an
 * enhancement, and every caller has a working fallback.
 */

/**
 * Transcribes a recorded clip server-side.
 *
 * `null` means "could not transcribe" — the caller should leave the composer
 * alone so the senior can type. An empty string is different: the model heard
 * the audio and found no speech in it.
 */
export async function transcribeAudio(
  audio: Blob,
  language?: string,
): Promise<string | null> {
  const form = new FormData();
  // MediaRecorder Blobs have no name; the server needs an extension to identify
  // the container, so give it one derived from the recorded MIME type.
  form.append("audio", audio, `speech.${audio.type.includes("mp4") ? "mp4" : "webm"}`);
  if (language) form.append("language", language);

  try {
    const response = await fetch(`${BASE_PATH}/voice/transcribe`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { text?: string };
    return typeof body.text === "string" ? body.text : null;
  } catch {
    return null;
  }
}

/**
 * Renders a companion line to speech server-side.
 *
 * Returns an object URL the caller is responsible for revoking, or `null` when
 * synthesis is unavailable — at which point the browser's speechSynthesis
 * should say the line instead.
 */
export async function synthesizeSpeech(text: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_PATH}/voice/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const blob = await response.blob();
    return blob.size > 0 ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ Senior */

export function getSenior(): Promise<Senior> {
  return request<Senior>("/senior");
}

export function updateSenior(update: SeniorUpdate): Promise<Senior> {
  return request<Senior>("/senior", { method: "PATCH", body: JSON.stringify(update) });
}

/* ---------------------------------------------------------------- Schedule */

export function getSchedule(): Promise<ScheduleItem[]> {
  return request<ScheduleItem[]>("/schedule");
}

export function updateSchedule(id: string, update: ScheduleItemUpdate): Promise<ScheduleItem> {
  return request<ScheduleItem>(`/schedule/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

/* ----------------------------------------------------------- Conversations */

export function getConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/conversations");
}

export function sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
  return request<SendMessageResult>("/conversations/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* -------------------------------------------------------------- Well-being */

export function getWellnessReports(): Promise<WellnessReport[]> {
  return request<WellnessReport[]>("/wellness-reports");
}

export function createWellnessReport(
  payload: CreateWellnessReportPayload,
): Promise<{ report: WellnessReport; alert: Alert | null }> {
  return request<{ report: WellnessReport; alert: Alert | null }>("/wellness-reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Tapping a mood face — records a report and returns the companion's reply. */
export function submitWellnessCheck(mood: Mood): Promise<SendMessageResult> {
  return request<SendMessageResult>("/wellness-check", {
    method: "POST",
    body: JSON.stringify({ mood }),
  });
}

/* ------------------------------------------------------------------ Alerts */

export function getAlerts(): Promise<Alert[]> {
  return request<Alert[]>("/alerts");
}

export function acknowledgeAlert(id: string): Promise<Alert> {
  return request<Alert>(`/alerts/${encodeURIComponent(id)}/acknowledge`, { method: "POST" });
}

/* --------------------------------------------------------- Knowledge base */

export function getKnowledgeBase(): Promise<KnowledgeBase> {
  return request<KnowledgeBase>("/knowledge-base");
}

/* -------------------------------------------------------------- Meditation */

export function completeMeditation(
  actualMinutes: number,
): Promise<{ session: MeditationSession; scheduleItem: ScheduleItem | null }> {
  return request<{ session: MeditationSession; scheduleItem: ScheduleItem | null }>(
    "/meditation/complete",
    { method: "POST", body: JSON.stringify({ actualMinutes }) },
  );
}

/* ------------------------------------------------------------------- Demo */

export function resetDemo(): Promise<void> {
  return request<void>("/demo/reset", { method: "POST", parseAs: "void" });
}

/** Asks the server whether a live avatar provider is available. */
export function requestAvatarSession(): Promise<{
  configured: boolean;
  token?: string;
  sessionId?: string;
  avatarId?: string;
  reason?: string;
}> {
  return request("/avatar/session", { method: "POST" });
}
