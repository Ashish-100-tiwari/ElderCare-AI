/**
 * Live backend adapter.
 *
 * The ElderCare backend speaks its own REST contract (`/api/seniors/:id/...`,
 * `/api/chat`, `/api/wellness`) with database-shaped payloads: `activity` +
 * `scheduledTime`, UPPERCASE enums, one conversation row per exchange. The UI
 * speaks the domain types in `lib/types.ts`. This module is the only place the
 * two meet.
 *
 * Every function returns `null` instead of throwing when the backend is not
 * configured, unreachable, or answers with an error. The `/api/bff/*` route
 * that called it then serves the in-memory demo store, so the presentation
 * never dies on a missing database. Server-side `console.warn` records why.
 *
 * Why HTTP and not a direct `import` of `@/services/*`: the backend's route
 * contract is its public surface, its function signatures are not. Going over
 * HTTP also means the same code path works when the backend moves out of this
 * app into a service of its own — set `BACKEND_API_URL` and nothing else
 * changes.
 *
 * Configuration (all server-side, never NEXT_PUBLIC_*):
 *   ELDERCARE_LIVE_API=1        use the backend routes in this same app
 *   BACKEND_API_URL=https://…   use a backend deployed somewhere else
 *   BACKEND_API_KEY=…           optional bearer token for the above
 *   DEMO_SENIOR_ID=senior-001   which senior this frontend is showing
 */

import "server-only";

import { headers } from "next/headers";

import { getSenior as getDemoSenior } from "@/lib/server/store";
import { istClock } from "@/lib/timezone";
import type {
  ActivityKind,
  Alert,
  Conversation,
  ConversationMessage,
  DailyRoutine,
  ScheduleItem,
  ScheduleStatus,
  SendMessagePayload,
  SendMessageResult,
  Senior,
  Severity,
  WebhookStatus,
  WellnessCategory,
  WellnessReport,
} from "@/lib/types";

const EXTERNAL_URL = process.env.BACKEND_API_URL?.replace(/\/$/, "");
const USE_IN_REPO = process.env.ELDERCARE_LIVE_API === "1";
const API_KEY = process.env.BACKEND_API_KEY;
const TIMEOUT_MS = Number(process.env.BACKEND_TIMEOUT_MS ?? 10_000);

/** Which senior this frontend instance is showing. Matches the seed data. */
export const SENIOR_ID = process.env.DEMO_SENIOR_ID ?? "senior-001";

/** True when a live backend should be attempted at all. */
export function isLiveEnabled(): boolean {
  return Boolean(EXTERNAL_URL) || USE_IN_REPO;
}

/* ------------------------------------------------------------------ transport */

/**
 * Same-origin when the backend lives in this app, absolute when it does not.
 * Derived from the incoming request's headers so it works on localhost, on a
 * preview URL and behind a proxy without any extra configuration.
 */
async function baseUrl(): Promise<string | null> {
  if (EXTERNAL_URL) return EXTERNAL_URL;
  if (!USE_IN_REPO) return null;

  const incoming = await headers();
  const host = incoming.get("host");
  if (!host) return null;

  const protocol =
    incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

interface CallOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}

/**
 * The caller's session cookie, so a server-to-server call to our own backend
 * routes arrives authenticated.
 *
 * Without this the BFF's fetch is anonymous, the backend answers 401, and `call`
 * quietly falls back to the demo store — the UI would look like it worked while
 * showing fabricated data. Only sent when the backend is this same app; an
 * external BACKEND_API_URL gets the bearer key instead and has no business
 * seeing our cookie.
 */
async function sessionCookieHeader(): Promise<Record<string, string>> {
  if (EXTERNAL_URL) return {};

  const incoming = await headers();
  const cookie = incoming.get("cookie");
  return cookie ? { cookie } : {};
}

/** One backend call. `null` means "fall back to the demo store". */
async function call<T>(path: string, options: CallOptions = {}): Promise<T | null> {
  const base = await baseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        ...(await sessionCookieHeader()),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      // The backend's error envelope is { error: { code, message } }. We log the
      // code, never the body, so nothing sensitive reaches the console.
      const envelope = (await response.json().catch(() => null)) as
        | { error?: { code?: string } }
        | null;
      console.warn(
        `[eldercare] backend ${options.method ?? "GET"} ${path} -> ${response.status}` +
          `${envelope?.error?.code ? ` (${envelope.error.code})` : ""}; using demo data`,
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn(`[eldercare] backend unreachable for ${path}; using demo data:`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- wire shapes */

interface WireSenior {
  id: string;
  name: string;
  age: number;
  language: string;
  preferences: string[];
  familyContactName: string;
  familyContactPhone?: string;
  createdAt: string;
}

interface WireSchedule {
  id: string;
  activity: string;
  description: string;
  scheduledTime: string;
  status: string;
}

interface WireConversation {
  id: string;
  userMessage: string;
  aiResponse: string;
  createdAt: string;
}

interface WireWellness {
  id: string;
  message: string;
  category: string;
  severity: string;
  createdAt: string;
}

interface WireAlert {
  id: string;
  type: string;
  message: string;
  webhookStatus: string;
  createdAt: string;
}

interface WireChatResult {
  response: string;
  wellnessAlert: boolean;
  alertId: string | null;
  webhookStatus: string | null;
  conversationId: string;
}

/* ------------------------------------------------------------------ mappings */

const scheduleStatusMap: Record<string, ScheduleStatus> = {
  UPCOMING: "upcoming",
  IN_PROGRESS: "in-progress",
  COMPLETED: "completed",
  SKIPPED: "missed",
};

const webhookStatusMap: Record<string, WebhookStatus> = {
  SENT: "sent",
  PENDING: "pending",
  FAILED: "failed",
  SIMULATED: "simulated",
};

const severityMap: Record<string, Severity> = { LOW: "low", MEDIUM: "medium", HIGH: "high" };

const categoryMap: Record<string, WellnessCategory> = {
  DISCOMFORT: "discomfort",
  EMOTIONAL: "general",
  GENERAL: "general",
  OTHER: "general",
};

/** Keyword match on the activity name — the backend stores free text. */
const activityKinds: [RegExp, ActivityKind][] = [
  [/medit|breath|mindful/i, "meditation"],
  [/walk|exercise|stroll|yoga/i, "walk"],
  [/breakfast|lunch|dinner|snack|meal|tea|eat/i, "meal"],
  [/medicine|medication|tablet|pill/i, "medication"],
  [/wake|morning/i, "wake"],
  [/sleep|bed|night/i, "sleep"],
  [/rest|nap|afternoon/i, "rest"],
  [/music|read|relax|television|tv|family/i, "relaxation"],
];

function activityKind(activity: string): ActivityKind {
  return activityKinds.find(([pattern]) => pattern.test(activity))?.[1] ?? "relaxation";
}

/** Sensible durations per activity — the backend does not model duration. */
const defaultDurations: Record<ActivityKind, number> = {
  wake: 15,
  meditation: 10,
  meal: 30,
  walk: 30,
  medication: 5,
  rest: 45,
  relaxation: 30,
  sleep: 480,
};

function toClock(iso: string): string {
  return istClock(new Date(iso));
}

function toScheduleItem(item: WireSchedule): ScheduleItem {
  const kind = activityKind(`${item.activity} ${item.description}`);
  const status = scheduleStatusMap[item.status] ?? "upcoming";

  return {
    id: item.id,
    time: toClock(item.scheduledTime),
    title: item.activity,
    kind,
    status,
    durationMinutes: defaultDurations[kind],
    note: item.description || undefined,
    // The backend does not expose a completion timestamp; the status is the fact.
    completedAt: null,
  };
}

/**
 * Rebuilds the routine block the profile screen edits from today's schedule.
 * Anything the schedule does not cover keeps the demo profile's time, so the
 * form never renders an empty time input.
 */
function toRoutine(schedule: ScheduleItem[], fallback: DailyRoutine): DailyRoutine {
  const firstTime = (kind: ActivityKind, matcher?: RegExp) =>
    schedule.find(
      (item) => item.kind === kind && (matcher ? matcher.test(item.title) : true),
    )?.time;

  return {
    wakeUp: firstTime("wake") ?? fallback.wakeUp,
    meditation: firstTime("meditation") ?? fallback.meditation,
    breakfast: firstTime("meal", /breakfast|tea/i) ?? fallback.breakfast,
    walking: firstTime("walk") ?? fallback.walking,
    lunch: firstTime("meal", /lunch/i) ?? fallback.lunch,
    rest: firstTime("rest") ?? fallback.rest,
    relaxation: firstTime("relaxation") ?? fallback.relaxation,
    sleep: firstTime("sleep") ?? fallback.sleep,
  };
}

/**
 * Merges the backend senior onto the demo profile.
 *
 * The backend models a deliberately small senior (name, age, language, free-form
 * preferences, one family contact name + phone). Fields it does not store are
 * left blank rather than invented — except frontend-only display preferences
 * such as the meditation timer length, which are not facts about the person.
 */
function toSenior(wire: WireSenior, schedule: ScheduleItem[], lastCheckInAt: string | null): Senior {
  const demo = getDemoSenior();

  return {
    id: wire.id,
    name: wire.name,
    firstName: wire.name.trim().split(/\s+/)[0] ?? wire.name,
    age: wire.age,
    language: wire.language,
    city: "",
    status: "active",
    routine: toRoutine(schedule, demo.routine),
    preferences: {
      preferredLanguage: wire.language,
      interests: wire.preferences,
      communicationStyle: demo.preferences.communicationStyle,
      dailyActivityGoalSteps: demo.preferences.dailyActivityGoalSteps,
      meditationDurationMinutes: demo.preferences.meditationDurationMinutes,
    },
    familyContact: {
      name: wire.familyContactName,
      relationship: "Family contact",
      phone: wire.familyContactPhone ?? "",
      email: "",
      notifyOnDiscomfort: true,
    },
    lastCheckInAt,
    currentMood: null,
  };
}

/**
 * One backend row is one exchange. The UI shows threads, so exchanges from the
 * same day are grouped into a single conversation, oldest message first.
 */
function toConversations(rows: WireConversation[], seniorId: string): Conversation[] {
  const byDay = new Map<string, WireConversation[]>();

  for (const row of [...rows].reverse()) {
    const day = row.createdAt.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(row);
    else byDay.set(day, [row]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, exchanges]) => {
      const messages: ConversationMessage[] = exchanges.flatMap((exchange) => [
        {
          id: `${exchange.id}-senior`,
          role: "senior" as const,
          text: exchange.userMessage,
          createdAt: exchange.createdAt,
        },
        {
          id: `${exchange.id}-companion`,
          role: "companion" as const,
          text: exchange.aiResponse,
          createdAt: exchange.createdAt,
        },
      ]);

      return {
        id: `day-${day}`,
        seniorId,
        startedAt: exchanges[0].createdAt,
        endedAt: exchanges[exchanges.length - 1].createdAt,
        summary: exchanges[0].userMessage.slice(0, 90),
        messages,
      };
    });
}

function toWellnessReport(wire: WireWellness, seniorId: string): WellnessReport {
  const category = categoryMap[wire.category] ?? "general";

  return {
    id: wire.id,
    seniorId,
    createdAt: wire.createdAt,
    mood: category === "discomfort" ? "unwell" : "okay",
    category,
    severity: severityMap[wire.severity] ?? "low",
    quote: wire.message,
    detail:
      category === "discomfort"
        ? "Rajesh described physical discomfort in conversation. Recorded for the family to follow up — this is not a medical assessment."
        : "Recorded from conversation. Not a medical assessment.",
    familyNotified: category === "discomfort",
    webhookStatus: category === "discomfort" ? "sent" : "not-required",
    conversationId: null,
  };
}

/** Display-only label. The real webhook URL is server-side and never sent here. */
function webhookLabel(status: WebhookStatus): string {
  return status === "simulated"
    ? "Simulated — no webhook URL configured"
    : "Family webhook (configured on the server)";
}

function toAlert(wire: WireAlert, seniorId: string, seniorName: string): Alert {
  const discomfort = wire.type === "DISCOMFORT_REPORTED";
  const status = webhookStatusMap[wire.webhookStatus] ?? "pending";

  return {
    id: wire.id,
    seniorId,
    seniorName,
    type: discomfort ? "discomfort" : "mood",
    // The backend records type, not severity; discomfort is the escalating case.
    severity: discomfort ? "high" : "medium",
    title: discomfort ? "Discomfort reported" : "Wellness concern",
    reportedText: wire.message,
    createdAt: wire.createdAt,
    acknowledged: false,
    acknowledgedAt: null,
    webhook: {
      status,
      endpoint: webhookLabel(status),
      sentAt: status === "sent" || status === "simulated" ? wire.createdAt : null,
      attempts: 1,
    },
    wellnessReportId: null,
    conversationId: null,
  };
}

/* ------------------------------------------------------------------- readers */

/**
 * Status changes the backend cannot persist yet.
 *
 * `PATCH /api/schedule/:id` is specified backend-side but not implemented, and
 * the demo has to be able to complete a meditation and watch the row turn green.
 * So a live status change is held here, in server memory, and layered over the
 * next read. It is a bridge, not a design: when that endpoint ships, delete this
 * map and the branch in `patchSchedule` below.
 */
const globalForOverlay = globalThis as unknown as {
  __elderCareLiveStatus?: Map<string, ScheduleStatus>;
};
const statusOverlay = (globalForOverlay.__elderCareLiveStatus ??= new Map<string, ScheduleStatus>());

export async function fetchSchedule(): Promise<ScheduleItem[] | null> {
  const body = await call<{ schedule: WireSchedule[] }>(`/api/seniors/${SENIOR_ID}/schedule`);
  if (!body) return null;

  return body.schedule.map((item) => {
    const mapped = toScheduleItem(item);
    const pending = statusOverlay.get(item.id);
    return pending ? { ...mapped, status: pending } : mapped;
  });
}

export async function fetchSenior(): Promise<Senior | null> {
  const body = await call<{ senior: WireSenior }>(`/api/seniors/${SENIOR_ID}`);
  if (!body) return null;

  // Both are cheap and independent; the routine block needs the schedule.
  const [schedule, conversations] = await Promise.all([
    fetchSchedule(),
    call<{ conversations: WireConversation[] }>(`/api/seniors/${SENIOR_ID}/conversations?limit=1`),
  ]);

  return toSenior(
    body.senior,
    schedule ?? [],
    conversations?.conversations[0]?.createdAt ?? null,
  );
}

export async function fetchConversations(): Promise<Conversation[] | null> {
  const body = await call<{ seniorId: string; conversations: WireConversation[] }>(
    `/api/seniors/${SENIOR_ID}/conversations`,
  );
  return body ? toConversations(body.conversations, body.seniorId) : null;
}

export async function fetchWellnessReports(): Promise<WellnessReport[] | null> {
  const body = await call<{ seniorId: string; wellnessReports: WireWellness[] }>(
    `/api/seniors/${SENIOR_ID}/wellness`,
  );
  return body
    ? body.wellnessReports.map((report) => toWellnessReport(report, body.seniorId))
    : null;
}

export async function fetchAlerts(): Promise<Alert[] | null> {
  const [body, senior] = await Promise.all([
    call<{ seniorId: string; alerts: WireAlert[] }>(`/api/seniors/${SENIOR_ID}/alerts`),
    call<{ senior: WireSenior }>(`/api/seniors/${SENIOR_ID}`),
  ]);
  if (!body) return null;

  const name = senior?.senior.name ?? getDemoSenior().name;
  return body.alerts.map((alert) => toAlert(alert, body.seniorId, name));
}

/* ------------------------------------------------------------------- writers */

/**
 * Sends a message through the backend's `/api/chat`, which owns the OpenAI call.
 * No model key exists on this side of the wire.
 *
 * `/api/chat` answers with the reply plus alert *ids*; the UI needs the alert and
 * report themselves, so we read them back when — and only when — one was raised.
 */
export async function postMessage(payload: SendMessagePayload): Promise<SendMessageResult | null> {
  const result = await call<WireChatResult>("/api/chat", {
    method: "POST",
    body: { seniorId: SENIOR_ID, message: payload.text },
  });
  if (!result) return null;

  const now = new Date().toISOString();
  const message: ConversationMessage = {
    id: `${result.conversationId}-senior`,
    role: "senior",
    text: payload.text,
    createdAt: now,
    signals: result.wellnessAlert ? { discomfort: true } : undefined,
  };
  const reply: ConversationMessage = {
    id: `${result.conversationId}-companion`,
    role: "companion",
    text: result.response,
    createdAt: now,
  };

  if (!result.wellnessAlert) {
    return { conversationId: result.conversationId, message, reply };
  }

  const [alerts, reports] = await Promise.all([fetchAlerts(), fetchWellnessReports()]);
  const alert = alerts?.find((candidate) => candidate.id === result.alertId) ?? undefined;

  return {
    conversationId: result.conversationId,
    message,
    reply,
    alert,
    wellnessReport: reports?.[0],
  };
}

/**
 * Records a mood tap through `/api/wellness`.
 *
 * The backend deliberately refuses a client-supplied category or severity — it
 * classifies the text itself — so we send the senior's words, not our verdict.
 */
export async function postWellnessCheck(
  quote: string,
): Promise<{ alertId: string | null; raised: boolean } | null> {
  const body = await call<{ wellnessAlert: boolean; alertId: string | null }>("/api/wellness", {
    method: "POST",
    body: { seniorId: SENIOR_ID, message: quote },
  });
  return body ? { alertId: body.alertId, raised: body.wellnessAlert } : null;
}

/**
 * Updates a schedule item's status.
 *
 * Tries the backend's `PATCH /api/schedule/:id` first. If it is not there yet,
 * the change is held in the overlay above so the read that follows reflects it.
 * Returns `null` only when there is no live backend at all, which sends the
 * caller to the demo store.
 */
export async function patchSchedule(
  id: string,
  status: ScheduleStatus,
): Promise<ScheduleItem | null> {
  if (!isLiveEnabled()) return null;

  const upper = Object.entries(scheduleStatusMap).find(([, value]) => value === status)?.[0];
  if (!upper) return null;

  const body = await call<WireSchedule>(`/api/schedule/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status: upper },
  });
  if (body) {
    statusOverlay.delete(id);
    return toScheduleItem(body);
  }

  statusOverlay.set(id, status);
  const schedule = await fetchSchedule();
  return schedule?.find((item) => item.id === id) ?? null;
}

/** Finds today's meditation slot, so completing it can flip the right row. */
export async function findMeditationItem(): Promise<ScheduleItem | null> {
  const schedule = await fetchSchedule();
  return schedule?.find((item) => item.kind === "meditation") ?? null;
}

/** Clears live-only demo state. The database itself is never touched from here. */
export function clearLiveOverlay(): void {
  statusOverlay.clear();
}
