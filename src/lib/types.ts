/**
 * Shared domain types for ElderCare AI.
 *
 * These mirror the backend contract. The mock layer in `lib/server/store.ts`
 * produces exactly these shapes, so swapping mocks for the real API is a
 * transport change only — no component needs to be touched.
 */

/* ------------------------------------------------------------------ Senior */

export type SeniorStatus = "active" | "resting" | "offline";

export interface DailyRoutine {
  wakeUp: string;
  meditation: string;
  breakfast: string;
  walking: string;
  lunch: string;
  rest: string;
  relaxation: string;
  sleep: string;
}

export interface SeniorPreferences {
  preferredLanguage: string;
  interests: string[];
  communicationStyle: string;
  dailyActivityGoalSteps: number;
  meditationDurationMinutes: number;
}

export interface FamilyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notifyOnDiscomfort: boolean;
}

export interface Senior {
  id: string;
  name: string;
  /** Short name used in greetings — "Rajesh". */
  firstName: string;
  age: number;
  language: string;
  city: string;
  avatarUrl?: string;
  status: SeniorStatus;
  routine: DailyRoutine;
  preferences: SeniorPreferences;
  familyContact: FamilyContact;
  /** ISO timestamp of the last time the senior interacted with the companion. */
  lastCheckInAt: string | null;
  currentMood: Mood | null;
}

/** Fields a caregiver may edit from the profile screen. */
export type SeniorUpdate = Partial<
  Pick<Senior, "name" | "firstName" | "age" | "language" | "city" | "status"> & {
    routine: Partial<DailyRoutine>;
    preferences: Partial<SeniorPreferences>;
    familyContact: Partial<FamilyContact>;
  }
>;

/* ---------------------------------------------------------------- Schedule */

export type ScheduleStatus = "completed" | "in-progress" | "upcoming" | "scheduled" | "missed";

export type ActivityKind =
  | "wake"
  | "meditation"
  | "meal"
  | "walk"
  | "rest"
  | "relaxation"
  | "sleep"
  | "medication";

export interface ScheduleItem {
  id: string;
  /** 24-hour wall clock, "HH:mm". */
  time: string;
  title: string;
  kind: ActivityKind;
  status: ScheduleStatus;
  durationMinutes: number;
  /** Short, friendly hint shown under the title. */
  note?: string;
  completedAt: string | null;
}

export interface ScheduleItemUpdate {
  status?: ScheduleStatus;
  completedAt?: string | null;
}

/* ----------------------------------------------------------- Conversations */

export type MessageRole = "senior" | "companion";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string;
  /** Signals the companion picked up on — drives wellness reports and alerts. */
  signals?: {
    discomfort?: boolean;
    mood?: Mood;
    topic?: string;
  };
}

export interface Conversation {
  id: string;
  seniorId: string;
  startedAt: string;
  endedAt: string | null;
  /** One-line recap shown on the caregiver dashboard. */
  summary: string;
  messages: ConversationMessage[];
}

export interface SendMessagePayload {
  text: string;
  conversationId?: string;
  /** Where the message came from, useful for backend analytics. */
  source?: "text" | "voice" | "quick-reply";
}

export interface SendMessageResult {
  conversationId: string;
  /** Echo of the stored senior message (server assigns the id). */
  message: ConversationMessage;
  reply: ConversationMessage;
  /** Present when the exchange produced a wellness record. */
  wellnessReport?: WellnessReport;
  /** Present when the exchange escalated to the family. */
  alert?: Alert;
}

/* -------------------------------------------------------------- Well-being */

export type Mood = "good" | "okay" | "unwell";

export type WellnessCategory = "mood-check" | "discomfort" | "general";

export type Severity = "low" | "medium" | "high";

/**
 * `simulated` means the alert was recorded and the delivery path ran, but no
 * webhook URL is configured — so nothing actually left the building. It is
 * shown distinctly from `sent` on purpose: a caregiver must never believe a
 * notification went out when it did not.
 */
export type WebhookStatus = "sent" | "simulated" | "pending" | "failed" | "not-required";

export interface WellnessReport {
  id: string;
  seniorId: string;
  createdAt: string;
  mood: Mood;
  category: WellnessCategory;
  severity: Severity;
  /** The senior's own words, quoted verbatim for the caregiver. */
  quote: string;
  /** Companion-written, non-diagnostic summary. */
  detail: string;
  familyNotified: boolean;
  webhookStatus: WebhookStatus;
  conversationId: string | null;
}

export interface CreateWellnessReportPayload {
  mood: Mood;
  category?: WellnessCategory;
  quote?: string;
  detail?: string;
  conversationId?: string | null;
}

/* ----------------------------------------------------------------- Alerts */

export type AlertType = "discomfort" | "mood" | "missed-activity";

export interface WebhookDelivery {
  status: WebhookStatus;
  /** Redacted, display-only label. Never a real secret. */
  endpoint: string;
  sentAt: string | null;
  attempts: number;
}

export interface Alert {
  id: string;
  seniorId: string;
  seniorName: string;
  type: AlertType;
  severity: Severity;
  title: string;
  /** What the senior actually said. */
  reportedText: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  webhook: WebhookDelivery;
  wellnessReportId: string | null;
  conversationId: string | null;
}

/* --------------------------------------------------------- Knowledge base */

export type KnowledgeSource = "profile" | "conversation" | "caregiver";

export interface KnowledgeEntry {
  id: string;
  label: string;
  value: string;
  source: KnowledgeSource;
  updatedAt: string;
}

export interface KnowledgeSection {
  id: string;
  title: string;
  entries: KnowledgeEntry[];
}

export interface KnowledgeBase {
  seniorId: string;
  updatedAt: string;
  sections: KnowledgeSection[];
  /** Facts the companion has picked up while chatting. */
  learned: KnowledgeEntry[];
}

/* -------------------------------------------------------------- Meditation */

export interface MeditationSession {
  id: string;
  seniorId: string;
  startedAt: string;
  completedAt: string | null;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
}

/* ------------------------------------------------------------- API plumbing */

/** Thrown by the API client so UI layers can show a friendly retry state. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status = 0, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export type ResourceStatus = "loading" | "error" | "empty" | "success";
