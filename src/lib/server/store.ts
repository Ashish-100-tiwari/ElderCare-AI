import { analyseMessage, replyForMood } from "./companion";
import type {
  Alert,
  Conversation,
  ConversationMessage,
  CreateWellnessReportPayload,
  KnowledgeBase,
  KnowledgeEntry,
  MeditationSession,
  Mood,
  ScheduleItem,
  ScheduleItemUpdate,
  SendMessagePayload,
  SendMessageResult,
  Senior,
  SeniorUpdate,
  Severity,
  WellnessReport,
} from "@/lib/types";

/**
 * In-memory demo store.
 *
 * This is the fallback that makes the frontend runnable on its own. Every
 * route handler tries the real backend first; when `BACKEND_API_URL` is not
 * set (or is unreachable) it falls through to these functions, so the demo
 * never breaks during a presentation.
 *
 * State is held on `globalThis` so Next.js hot reloads don't wipe a demo
 * that is already in progress.
 */

const WEBHOOK_ENDPOINT = "https://hooks.eldercare.ai/family/rahul-sharma";

function todayAt(time: string, dayOffset = 0): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toISOString();
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/* ------------------------------------------------------------------- seeds */

function seedSenior(): Senior {
  return {
    id: "senior_rajesh",
    name: "Rajesh Sharma",
    firstName: "Rajesh",
    age: 72,
    language: "Hindi",
    city: "Jaipur",
    status: "active",
    routine: {
      wakeUp: "07:00",
      meditation: "07:30",
      breakfast: "08:00",
      walking: "10:30",
      lunch: "13:00",
      rest: "16:00",
      relaxation: "20:00",
      sleep: "22:00",
    },
    preferences: {
      preferredLanguage: "Hindi",
      interests: ["Cricket", "Classical music", "Gardening", "Reading the newspaper"],
      communicationStyle: "Warm, slow and respectful",
      dailyActivityGoalSteps: 3000,
      meditationDurationMinutes: 10,
    },
    familyContact: {
      name: "Rahul Sharma",
      relationship: "Son",
      phone: "+91 98200 41122",
      email: "rahul.sharma@example.com",
      notifyOnDiscomfort: true,
    },
    lastCheckInAt: todayAt("10:32"),
    currentMood: "good",
  };
}

function seedSchedule(): ScheduleItem[] {
  return [
    {
      id: "sch_wake",
      time: "07:00",
      title: "Wake Up",
      kind: "wake",
      status: "completed",
      durationMinutes: 30,
      note: "A glass of warm water to start the day",
      completedAt: todayAt("07:05"),
    },
    {
      id: "sch_meditation",
      time: "07:30",
      title: "Meditation",
      kind: "meditation",
      status: "upcoming",
      durationMinutes: 10,
      note: "Ten calm minutes with your companion",
      completedAt: null,
    },
    {
      id: "sch_breakfast",
      time: "08:00",
      title: "Breakfast",
      kind: "meal",
      status: "completed",
      durationMinutes: 30,
      note: "Poha and fruit",
      completedAt: todayAt("08:10"),
    },
    {
      id: "sch_walk",
      time: "10:30",
      title: "Morning Walk",
      kind: "walk",
      status: "upcoming",
      durationMinutes: 30,
      note: "A gentle walk in the garden",
      completedAt: null,
    },
    {
      id: "sch_lunch",
      time: "13:00",
      title: "Lunch",
      kind: "meal",
      status: "upcoming",
      durationMinutes: 45,
      note: "Dal, roti and vegetables",
      completedAt: null,
    },
    {
      id: "sch_rest",
      time: "16:00",
      title: "Rest",
      kind: "rest",
      status: "upcoming",
      durationMinutes: 45,
      note: "A short afternoon nap",
      completedAt: null,
    },
    {
      id: "sch_relaxation",
      time: "20:00",
      title: "Relaxation",
      kind: "relaxation",
      status: "upcoming",
      durationMinutes: 30,
      note: "Music or a call with family",
      completedAt: null,
    },
    {
      id: "sch_sleep",
      time: "22:00",
      title: "Sleep",
      kind: "sleep",
      status: "scheduled",
      durationMinutes: 480,
      note: "Lights out, rest well",
      completedAt: null,
    },
  ];
}

function seedConversations(): Conversation[] {
  return [
    {
      id: "conv_today",
      seniorId: "senior_rajesh",
      startedAt: todayAt("10:30"),
      endedAt: null,
      summary: "Morning check-in — Rajesh said he slept well.",
      messages: [
        {
          id: "msg_1",
          role: "companion",
          text: "Good morning Rajesh. How did you sleep last night?",
          createdAt: todayAt("10:30"),
        },
        {
          id: "msg_2",
          role: "senior",
          text: "I slept well, thank you.",
          createdAt: todayAt("10:31"),
          signals: { mood: "good", topic: "sleep" },
        },
        {
          id: "msg_3",
          role: "companion",
          text: "That's wonderful to hear. I've noted that you're feeling good today.",
          createdAt: todayAt("10:32"),
        },
      ],
    },
    {
      id: "conv_yesterday",
      seniorId: "senior_rajesh",
      startedAt: todayAt("20:05", -1),
      endedAt: todayAt("20:12", -1),
      summary: "Evening chat about cricket — calm and cheerful.",
      messages: [
        {
          id: "msg_y1",
          role: "senior",
          text: "Did India win the match today?",
          createdAt: todayAt("20:05", -1),
          signals: { topic: "cricket" },
        },
        {
          id: "msg_y2",
          role: "companion",
          text: "They did, and by a good margin. Shall I read you the highlights?",
          createdAt: todayAt("20:06", -1),
        },
        {
          id: "msg_y3",
          role: "senior",
          text: "Yes please. I am feeling quite relaxed this evening.",
          createdAt: todayAt("20:08", -1),
          signals: { mood: "good", topic: "relaxation" },
        },
      ],
    },
    {
      id: "conv_two_days",
      seniorId: "senior_rajesh",
      startedAt: todayAt("17:40", -3),
      endedAt: todayAt("17:48", -3),
      summary: "Reported knee stiffness after his walk — family was notified.",
      messages: [
        {
          id: "msg_t1",
          role: "senior",
          text: "My knee felt stiff after the walk today.",
          createdAt: todayAt("17:40", -3),
          signals: { discomfort: true, mood: "unwell", topic: "discomfort: knee" },
        },
        {
          id: "msg_t2",
          role: "companion",
          text: "I'm sorry your knee is troubling you. I've recorded what you told me and will notify your family member.",
          createdAt: todayAt("17:41", -3),
        },
      ],
    },
  ];
}

function seedWellnessReports(): WellnessReport[] {
  return [
    {
      id: "wr_today_morning",
      seniorId: "senior_rajesh",
      createdAt: todayAt("10:32"),
      mood: "good",
      category: "mood-check",
      severity: "low",
      quote: "I slept well, thank you.",
      detail: "Morning check-in completed. Rajesh reported sleeping well and sounded cheerful.",
      familyNotified: false,
      webhookStatus: "not-required",
      conversationId: "conv_today",
    },
    {
      id: "wr_yesterday",
      seniorId: "senior_rajesh",
      createdAt: todayAt("20:10", -1),
      mood: "good",
      category: "general",
      severity: "low",
      quote: "I am feeling quite relaxed this evening.",
      detail: "Evening conversation about cricket. Mood steady and positive.",
      familyNotified: false,
      webhookStatus: "not-required",
      conversationId: "conv_yesterday",
    },
    {
      id: "wr_knee",
      seniorId: "senior_rajesh",
      createdAt: todayAt("17:41", -3),
      mood: "unwell",
      category: "discomfort",
      severity: "medium",
      quote: "My knee felt stiff after the walk today.",
      detail: "Rajesh described stiffness in his knee following his morning walk. Family notified.",
      familyNotified: true,
      webhookStatus: "sent",
      conversationId: "conv_two_days",
    },
  ];
}

function seedAlerts(): Alert[] {
  return [
    {
      id: "alert_knee",
      seniorId: "senior_rajesh",
      seniorName: "Rajesh Sharma",
      type: "discomfort",
      severity: "medium",
      title: "Discomfort reported",
      reportedText: "My knee felt stiff after the walk today.",
      createdAt: todayAt("17:41", -3),
      acknowledged: true,
      acknowledgedAt: todayAt("18:02", -3),
      webhook: {
        status: "sent",
        endpoint: WEBHOOK_ENDPOINT,
        sentAt: todayAt("17:41", -3),
        attempts: 1,
      },
      wellnessReportId: "wr_knee",
      conversationId: "conv_two_days",
    },
  ];
}

/* ------------------------------------------------------------------- state */

interface DemoState {
  senior: Senior;
  schedule: ScheduleItem[];
  conversations: Conversation[];
  wellnessReports: WellnessReport[];
  alerts: Alert[];
  meditationSessions: MeditationSession[];
  learnedKnowledge: KnowledgeBase["learned"];
}

function createState(): DemoState {
  return {
    senior: seedSenior(),
    schedule: seedSchedule(),
    conversations: seedConversations(),
    wellnessReports: seedWellnessReports(),
    alerts: seedAlerts(),
    meditationSessions: [],
    learnedKnowledge: [
      {
        id: "kn_1",
        label: "Favourite pastime",
        value: "Listens to classical music every evening around 8pm.",
        source: "conversation",
        updatedAt: todayAt("20:08", -1),
      },
      {
        id: "kn_2",
        label: "Mobility note",
        value: "Mentions knee stiffness after longer walks. Prefers the garden path.",
        source: "conversation",
        updatedAt: todayAt("17:41", -3),
      },
      {
        id: "kn_3",
        label: "Morning habit",
        value: "Reads the newspaper with tea straight after breakfast.",
        source: "conversation",
        updatedAt: todayAt("08:20", -2),
      },
    ],
  };
}

const globalForStore = globalThis as unknown as { __elderCareStore?: DemoState };

function state(): DemoState {
  if (!globalForStore.__elderCareStore) {
    globalForStore.__elderCareStore = createState();
  }
  return globalForStore.__elderCareStore;
}

/** Deep-ish clone so callers can never mutate the store by accident. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/* ---------------------------------------------------------------- readers */

export function getSenior(): Senior {
  return clone(state().senior);
}

export function getSchedule(): ScheduleItem[] {
  return clone(state().schedule);
}

export function getConversations(): Conversation[] {
  return clone(
    [...state().conversations].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    ),
  );
}

export function getWellnessReports(): WellnessReport[] {
  return clone(
    [...state().wellnessReports].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );
}

export function getAlerts(): Alert[] {
  return clone(
    [...state().alerts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );
}

/**
 * Builds the knowledge base from a senior profile.
 *
 * Both arguments are overridable so the same layout can be rendered from a live
 * backend profile. A live caller passes its own `learned` list (usually empty —
 * the backend does not extract facts from conversations yet) rather than letting
 * demo observations masquerade as real ones.
 */
export function getKnowledgeBase(
  seniorOverride?: Senior,
  learnedOverride?: KnowledgeEntry[],
): KnowledgeBase {
  const senior = seniorOverride ?? state().senior;
  const learnedKnowledge = learnedOverride ?? state().learnedKnowledge;
  const stamp = new Date().toISOString();

  const entry = (label: string, value: string, source: KnowledgeBase["learned"][number]["source"]) => ({
    id: `kb_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    label,
    value,
    source,
    updatedAt: stamp,
  });

  return clone({
    seniorId: senior.id,
    updatedAt: stamp,
    sections: [
      {
        id: "personal",
        title: "Personal Information",
        entries: [
          entry("Name", senior.name, "profile"),
          entry("Age", `${senior.age}`, "profile"),
          entry("Language", senior.language, "profile"),
          entry("City", senior.city, "profile"),
        ],
      },
      {
        id: "routine",
        title: "Daily Routine",
        entries: [
          entry("Wake", senior.routine.wakeUp, "profile"),
          entry("Meditation", senior.routine.meditation, "profile"),
          entry("Breakfast", senior.routine.breakfast, "profile"),
          entry("Walking", senior.routine.walking, "profile"),
          entry("Lunch", senior.routine.lunch, "profile"),
          entry("Rest", senior.routine.rest, "profile"),
          entry("Relaxation", senior.routine.relaxation, "profile"),
          entry("Sleep", senior.routine.sleep, "profile"),
        ],
      },
      {
        id: "preferences",
        title: "Preferences",
        entries: [
          entry("Preferred language", senior.preferences.preferredLanguage, "profile"),
          entry("Interests", senior.preferences.interests.join(", "), "caregiver"),
          entry("Communication style", senior.preferences.communicationStyle, "caregiver"),
          entry("Daily activity goal", `${senior.preferences.dailyActivityGoalSteps} steps`, "caregiver"),
          entry("Meditation duration", `${senior.preferences.meditationDurationMinutes} minutes`, "caregiver"),
        ],
      },
      {
        id: "family",
        title: "Family Contact",
        entries: [
          entry("Name", senior.familyContact.name, "profile"),
          entry("Relationship", senior.familyContact.relationship, "profile"),
          entry("Phone", senior.familyContact.phone, "profile"),
          entry("Email", senior.familyContact.email, "profile"),
          entry(
            "Alerts",
            senior.familyContact.notifyOnDiscomfort ? "Notified on discomfort" : "Notifications paused",
            "caregiver",
          ),
        ],
      },
    ],
    learned: [...learnedKnowledge].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  });
}

/* ---------------------------------------------------------------- writers */

export function updateSenior(update: SeniorUpdate): Senior {
  const current = state().senior;
  state().senior = {
    ...current,
    ...update,
    routine: { ...current.routine, ...(update.routine ?? {}) },
    preferences: { ...current.preferences, ...(update.preferences ?? {}) },
    familyContact: { ...current.familyContact, ...(update.familyContact ?? {}) },
  };

  // Keep the schedule in step with the routine the caregiver just edited.
  const routine = state().senior.routine;
  const timeByKind: Partial<Record<ScheduleItem["id"], string>> = {
    sch_wake: routine.wakeUp,
    sch_meditation: routine.meditation,
    sch_breakfast: routine.breakfast,
    sch_walk: routine.walking,
    sch_lunch: routine.lunch,
    sch_rest: routine.rest,
    sch_relaxation: routine.relaxation,
    sch_sleep: routine.sleep,
  };
  state().schedule = state()
    .schedule.map((item) => ({ ...item, time: timeByKind[item.id] ?? item.time }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return getSenior();
}

export function updateScheduleItem(id: string, update: ScheduleItemUpdate): ScheduleItem | null {
  const item = state().schedule.find((candidate) => candidate.id === id);
  if (!item) return null;

  item.status = update.status ?? item.status;
  if (update.completedAt !== undefined) {
    item.completedAt = update.completedAt;
  } else if (update.status === "completed" && !item.completedAt) {
    item.completedAt = new Date().toISOString();
  } else if (update.status && update.status !== "completed") {
    item.completedAt = null;
  }

  return clone(item);
}

export function completeMeditation(actualMinutes: number): {
  session: MeditationSession;
  scheduleItem: ScheduleItem | null;
} {
  const now = new Date().toISOString();
  const session: MeditationSession = {
    id: nextId("med"),
    seniorId: state().senior.id,
    startedAt: new Date(Date.now() - actualMinutes * 60_000).toISOString(),
    completedAt: now,
    plannedMinutes: state().senior.preferences.meditationDurationMinutes,
    actualMinutes,
    completed: true,
  };
  state().meditationSessions.unshift(session);

  const scheduleItem = updateScheduleItem("sch_meditation", { status: "completed", completedAt: now });
  state().senior.lastCheckInAt = now;

  return { session: clone(session), scheduleItem };
}

function severityFor(category: WellnessReport["category"], mood: Mood): Severity {
  if (category === "discomfort") return "medium";
  if (mood === "unwell") return "medium";
  if (mood === "okay") return "low";
  return "low";
}

export function createWellnessReport(payload: CreateWellnessReportPayload): {
  report: WellnessReport;
  alert: Alert | null;
} {
  const now = new Date().toISOString();
  const category = payload.category ?? (payload.mood === "unwell" ? "discomfort" : "mood-check");
  const escalate = category === "discomfort" || payload.mood === "unwell";

  const report: WellnessReport = {
    id: nextId("wr"),
    seniorId: state().senior.id,
    createdAt: now,
    mood: payload.mood,
    category,
    severity: severityFor(category, payload.mood),
    quote: payload.quote ?? "",
    detail:
      payload.detail ??
      (escalate
        ? "Rajesh described discomfort during a conversation with his companion. Recorded without interpretation and escalated to family."
        : "Routine well-being check-in recorded by the companion."),
    familyNotified: escalate && state().senior.familyContact.notifyOnDiscomfort,
    webhookStatus: escalate && state().senior.familyContact.notifyOnDiscomfort ? "sent" : "not-required",
    conversationId: payload.conversationId ?? null,
  };

  state().wellnessReports.unshift(report);
  state().senior.currentMood = payload.mood;
  state().senior.lastCheckInAt = now;

  let alert: Alert | null = null;
  if (escalate) {
    alert = {
      id: nextId("alert"),
      seniorId: state().senior.id,
      seniorName: state().senior.name,
      type: category === "discomfort" ? "discomfort" : "mood",
      severity: report.severity,
      title: category === "discomfort" ? "New Wellness Alert" : "Mood change reported",
      reportedText: report.quote || report.detail,
      createdAt: now,
      acknowledged: false,
      acknowledgedAt: null,
      webhook: {
        status: report.familyNotified ? "sent" : "not-required",
        endpoint: WEBHOOK_ENDPOINT,
        sentAt: report.familyNotified ? now : null,
        attempts: report.familyNotified ? 1 : 0,
      },
      wellnessReportId: report.id,
      conversationId: report.conversationId,
    };
    state().alerts.unshift(alert);
  }

  return { report: clone(report), alert: alert ? clone(alert) : null };
}

export function acknowledgeAlert(id: string): Alert | null {
  const alert = state().alerts.find((candidate) => candidate.id === id);
  if (!alert) return null;
  alert.acknowledged = true;
  alert.acknowledgedAt = new Date().toISOString();
  return clone(alert);
}

export function sendMessage(payload: SendMessagePayload): SendMessageResult {
  const { senior } = state();
  const now = new Date();

  let conversation = payload.conversationId
    ? state().conversations.find((candidate) => candidate.id === payload.conversationId)
    : state().conversations.find((candidate) => candidate.endedAt === null);

  if (!conversation) {
    conversation = {
      id: nextId("conv"),
      seniorId: senior.id,
      startedAt: now.toISOString(),
      endedAt: null,
      summary: "Live conversation with the companion.",
      messages: [],
    };
    state().conversations.unshift(conversation);
  }

  const analysis = analyseMessage(payload.text, senior.firstName);

  const seniorMessage: ConversationMessage = {
    id: nextId("msg"),
    role: "senior",
    text: payload.text.trim(),
    createdAt: now.toISOString(),
    signals: {
      discomfort: analysis.discomfort || undefined,
      mood: analysis.mood ?? undefined,
      topic: analysis.topic,
    },
  };

  const reply: ConversationMessage = {
    id: nextId("msg"),
    role: "companion",
    text: analysis.reply,
    createdAt: new Date(now.getTime() + 1200).toISOString(),
  };

  conversation.messages.push(seniorMessage, reply);
  conversation.summary = analysis.discomfort
    ? `Reported discomfort — "${seniorMessage.text}"`
    : `Talked about ${analysis.topic}.`;

  senior.lastCheckInAt = now.toISOString();
  if (analysis.mood) senior.currentMood = analysis.mood;

  let report: WellnessReport | undefined;
  let alert: Alert | undefined;

  if (analysis.discomfort) {
    const created = createWellnessReport({
      mood: "unwell",
      category: "discomfort",
      quote: seniorMessage.text,
      conversationId: conversation.id,
    });
    report = created.report;
    alert = created.alert ?? undefined;
  } else if (analysis.mood) {
    const created = createWellnessReport({
      mood: analysis.mood,
      category: "mood-check",
      quote: seniorMessage.text,
      conversationId: conversation.id,
    });
    report = created.report;
  }

  return {
    conversationId: conversation.id,
    message: clone(seniorMessage),
    reply: clone(reply),
    wellnessReport: report,
    alert,
  };
}

export function recordMood(mood: Mood): SendMessageResult {
  const { senior } = state();
  const now = new Date();

  let conversation = state().conversations.find((candidate) => candidate.endedAt === null);
  if (!conversation) {
    conversation = {
      id: nextId("conv"),
      seniorId: senior.id,
      startedAt: now.toISOString(),
      endedAt: null,
      summary: "Well-being check-in.",
      messages: [],
    };
    state().conversations.unshift(conversation);
  }

  const label: Record<Mood, string> = {
    good: "I'm feeling good today.",
    okay: "I'm feeling okay today.",
    unwell: "I'm not feeling well today.",
  };

  const seniorMessage: ConversationMessage = {
    id: nextId("msg"),
    role: "senior",
    text: label[mood],
    createdAt: now.toISOString(),
    signals: { mood, discomfort: mood === "unwell" || undefined, topic: "wellness check" },
  };

  const reply: ConversationMessage = {
    id: nextId("msg"),
    role: "companion",
    text: replyForMood(mood, senior.firstName),
    createdAt: new Date(now.getTime() + 900).toISOString(),
  };

  conversation.messages.push(seniorMessage, reply);

  const created = createWellnessReport({
    mood,
    category: mood === "unwell" ? "discomfort" : "mood-check",
    quote: label[mood],
    conversationId: conversation.id,
  });

  return {
    conversationId: conversation.id,
    message: clone(seniorMessage),
    reply: clone(reply),
    wellnessReport: created.report,
    alert: created.alert ?? undefined,
  };
}

/** Puts the demo back to its opening state — handy between presentations. */
export function resetDemo(): void {
  globalForStore.__elderCareStore = createState();
}
